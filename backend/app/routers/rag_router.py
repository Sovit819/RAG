import mimetypes
from pathlib import Path
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel

from backend.app.auth import get_current_user
from backend.app.models import User
from backend.app.rag.s1_parser import parse_document
from backend.app.rag.s2_splitter import split_document
from backend.app.rag.s3_embeddings import embed_texts
from backend.app.rag.s4_vectorstore import (
    store_chunks, 
    query_user_chunks, 
    list_user_documents, 
    get_user_document_preview,
    delete_user_document
)
from backend.app.rag.s5_generator import generate_rag_stream

router = APIRouter(prefix="/api/v1/rag", tags=["rag"])

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
UPLOADS_DIR = DATA_DIR / "user_uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

class QueryRequest(BaseModel):
    prompt: str

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    parser_choice: str = Form("docling"),
    current_user: User = Depends(get_current_user)
):
    """Uploads document with chosen parser (Docling vs Qwen2.5-VL), splits with page tagging, embeds, and vectorizes."""
    user_upload_dir = UPLOADS_DIR / str(current_user.id)
    user_upload_dir.mkdir(parents=True, exist_ok=True)
    
    saved_file_path = user_upload_dir / file.filename
    content = await file.read()
    
    with open(saved_file_path, "wb") as f:
        f.write(content)

    try:
        # 1. Parse document with selected engine
        doc, markdown_text, parser_engine, page_items = parse_document(
            str(saved_file_path), 
            parser_choice=parser_choice
        )
        
        # 2. Chunk document with atomic table rows and page numbers
        chunks = split_document(
            doc=doc, 
            markdown_text=markdown_text, 
            page_items=page_items
        )
        if not chunks:
            raise HTTPException(status_code=400, detail="No extractable text found in document.")
            
        # 3. Generate Embeddings on contextualized texts
        chunk_context_texts = [c.get("context_text", c.get("text", "")) for c in chunks]
        embeddings = embed_texts(chunk_context_texts)
        
        # 4. Store in user's dedicated ChromaDB collection with parser engine & page metadata
        store_chunks(
            user_id=current_user.id,
            doc_name=file.filename,
            chunks=chunks,
            embeddings=embeddings,
            parser_engine=parser_engine
        )
        
        return {
            "status": "success",
            "filename": file.filename,
            "chunks_count": len(chunks),
            "parser_engine": parser_engine
        }
    except HTTPException:
        raise
    except Exception as e:
        if saved_file_path.exists():
            saved_file_path.unlink()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/documents")
async def get_user_documents(current_user: User = Depends(get_current_user)):
    documents = list_user_documents(user_id=current_user.id)
    return {"documents": documents}

@router.get("/documents/{doc_name}/preview")
async def preview_user_document(doc_name: str, current_user: User = Depends(get_current_user)):
    preview_data = get_user_document_preview(user_id=current_user.id, doc_name=doc_name)
    if not preview_data.get("chunks"):
        raise HTTPException(status_code=404, detail="Document not found or vector store empty.")
    
    user_file_path = UPLOADS_DIR / str(current_user.id) / doc_name
    preview_data["has_raw_file"] = user_file_path.exists()
    return preview_data

@router.get("/documents/{doc_name}/file")
async def download_user_document(doc_name: str, current_user: User = Depends(get_current_user)):
    user_file_path = UPLOADS_DIR / str(current_user.id) / doc_name
    if not user_file_path.exists():
        raise HTTPException(status_code=404, detail="Original document file not found.")
    
    media_type, _ = mimetypes.guess_type(str(user_file_path))
    if not media_type:
        media_type = "application/octet-stream"
        
    return FileResponse(
        path=user_file_path,
        filename=doc_name,
        media_type=media_type
    )

@router.delete("/documents/{doc_name}")
async def remove_user_document(doc_name: str, current_user: User = Depends(get_current_user)):
    success = delete_user_document(user_id=current_user.id, doc_name=doc_name)
    
    user_file_path = UPLOADS_DIR / str(current_user.id) / doc_name
    if user_file_path.exists():
        user_file_path.unlink()
        
    if not success:
        raise HTTPException(status_code=404, detail="Document not found or vector store empty.")
        
    return {"status": "success", "message": f"Deleted '{doc_name}' from account."}

@router.post("/query")
async def query_rag(
    request: QueryRequest,
    current_user: User = Depends(get_current_user)
):
    """Retrieves user-isolated document chunks with multi-query fusion and dynamic sibling expansion."""
    prompt = request.prompt.strip()
    
    # 1. Multi-Query Intent Expansion
    queries_to_embed = [prompt]
    broad_keywords = ["course", "program", "major", "department", "degree", "requirement", "admission", "list", "all", "what are"]
    if any(k in prompt.lower() for k in broad_keywords):
        queries_to_embed.append(f"academic programs, colleges, majors, and departments: {prompt}")
        queries_to_embed.append(f"curriculum, degrees offered, and course focus areas: {prompt}")

    query_embeddings = embed_texts(queries_to_embed, is_query=True)
    
    # 2. Retrieve top matching chunks and fuse unique results with sibling expansion
    seen_texts = set()
    retrieved_chunks = []
    
    for q_emb in query_embeddings:
        results = query_user_chunks(
            user_id=current_user.id,
            query_embedding=q_emb,
            top_k=8,
            expand_siblings=True
        )
        for chunk in results:
            text_key = chunk.get("text", "")[:100]
            if text_key not in seen_texts:
                seen_texts.add(text_key)
                retrieved_chunks.append(chunk)
                
    # Sort fused results by sequence chunk index or similarity
    retrieved_chunks.sort(key=lambda x: x.get("metadata", {}).get("chunk_index", 0))
    
    # Take up to 25 contiguous chunks for broad multi-page sections (Qwen 128k context)
    final_context_chunks = retrieved_chunks[:25]
    
    # 3. Stream answer & sources via SSE
    return StreamingResponse(
        generate_rag_stream(prompt, final_context_chunks),
        media_type="text/event-stream"
    )
