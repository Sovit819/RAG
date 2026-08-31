import mimetypes
from pathlib import Path
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel

from backend.app.auth import get_current_user
from backend.app.models import User
from backend.core import (
    parse_document,
    split_document,
    embed_texts,
    store_chunks,
    query_user_chunks,
    list_user_documents,
    get_user_document_preview,
    delete_user_document,
    generate_rag_stream
)

router = APIRouter(prefix="/api/v1/rag", tags=["rag"])

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
UPLOADS_DIR = DATA_DIR / "user_uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

class QueryRequest(BaseModel):
    prompt: str

GREETING_PATTERNS = {"hi", "hello", "hey", "good morning", "good evening", "good afternoon", "who are you", "what can you do"}

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    parser_choice: str = Form("docling"),
    current_user: User = Depends(get_current_user)
):
    user_upload_dir = UPLOADS_DIR / str(current_user.id)
    user_upload_dir.mkdir(parents=True, exist_ok=True)
    
    saved_file_path = user_upload_dir / file.filename
    content = await file.read()
    
    with open(saved_file_path, "wb") as f:
        f.write(content)

    try:
        # Step 1: Parse document
        doc, markdown_text, parser_engine, page_items = parse_document(
            str(saved_file_path), 
            parser_choice=parser_choice
        )
        
        # Step 2: Split document into chunks
        chunks = split_document(
            doc=doc, 
            markdown_text=markdown_text, 
            page_items=page_items
        )
        if not chunks:
            raise HTTPException(status_code=400, detail="No extractable text found in document.")
            
        # Step 3: Generate Embeddings
        chunk_context_texts = [c.get("context_text", c.get("text", "")) for c in chunks]
        embeddings = embed_texts(chunk_context_texts)
        
        # Step 4: Store in ChromaDB
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

@router.get("/documents/{doc_name}/pages/{page_number}/image")
async def get_document_page_image(doc_name: str, page_number: int, current_user: User = Depends(get_current_user)):
    """
    Renders high-res visual page image of the real document (LangExtract style).
    """
    import io
    from fastapi.responses import Response
    import pypdfium2 as pdfium

    user_file_path = UPLOADS_DIR / str(current_user.id) / doc_name
    if not user_file_path.exists():
        raise HTTPException(status_code=404, detail="Document file not found.")
    
    ext = user_file_path.suffix.lower()
    if ext == ".pdf":
        try:
            pdf = pdfium.PdfDocument(str(user_file_path))
            if page_number < 1 or page_number > len(pdf):
                page_number = 1
            page = pdf[page_number - 1]
            pil_image = page.render(scale=2.0).to_pil()
            buf = io.BytesIO()
            pil_image.save(buf, format="JPEG", quality=90)
            return Response(content=buf.getvalue(), media_type="image/jpeg")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to render page: {str(e)}")
    elif ext in [".png", ".jpg", ".jpeg", ".webp"]:
        with open(user_file_path, "rb") as f:
            return Response(content=f.read(), media_type=f"image/{ext.replace('.', '')}")
    else:
        raise HTTPException(status_code=400, detail="Page rendering only supported for PDF and image documents.")

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
    prompt = request.prompt.strip()
    clean_prompt = prompt.lower().strip("!?., ")

    # 1. Conversational Greeting Filter (Do not pull random vector chunks for 'hi' / 'hello')
    if clean_prompt in GREETING_PATTERNS or len(clean_prompt) <= 2:
        import json
        def greeting_stream():
            yield f"data: {json.dumps({'type': 'sources', 'sources': []})}\n\n"
            msg = "Hello! I am your document assistant. Ask me any question about your uploaded documents, and I will find the exact answers and citations for you."
            yield f"data: {json.dumps({'type': 'token', 'token': msg, 'done': True})}\n\n"
            
        return StreamingResponse(greeting_stream(), media_type="text/event-stream")

    # 2. Vector Retrieval (retrieve top 5 matching chunks)
    query_emb = embed_texts([prompt], is_query=True)[0]
    retrieved_chunks = query_user_chunks(
        user_id=current_user.id,
        query_embedding=query_emb,
        top_k=6
    )

    # 3. Stream generated response with real citations
    return StreamingResponse(
        generate_rag_stream(prompt, retrieved_chunks),
        media_type="text/event-stream"
    )
