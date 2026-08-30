import tempfile
import os
import shutil
import mimetypes
from pathlib import Path
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel

from backend.app.auth import get_current_user
from backend.app.models import User
from backend.app.rag.s1_parser import parse_document_to_markdown
from backend.app.rag.s2_splitter import split_markdown_document
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
    model_choice: str = "nomic"

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    model_choice: str = Form("nomic"),
    current_user: User = Depends(get_current_user)
):
    """Uploads a document, saves original file, parses with Docling, chunks, embeds, and vectorizes."""
    user_upload_dir = UPLOADS_DIR / str(current_user.id)
    user_upload_dir.mkdir(parents=True, exist_ok=True)
    
    saved_file_path = user_upload_dir / file.filename
    content = await file.read()
    
    # Save original raw document file on disk for user
    with open(saved_file_path, "wb") as f:
        f.write(content)

    try:
        # 1. Parse document to Markdown using saved raw file
        markdown_text = parse_document_to_markdown(str(saved_file_path))
        
        # 2. Chunk markdown text
        chunks = split_markdown_document(markdown_text)
        if not chunks:
            raise HTTPException(status_code=400, detail="No extractable text found in document.")
            
        # 3. Generate Embeddings (Nomic vs. Nemotron VL)
        chunk_texts = [c["text"] if isinstance(c, dict) else str(c) for c in chunks]
        embeddings = embed_texts(chunk_texts, model_choice=model_choice)
        
        # 4. Store in user's dedicated ChromaDB collection
        store_chunks(
            user_id=current_user.id,
            doc_name=file.filename,
            chunks=chunks,
            embeddings=embeddings
        )
        
        return {
            "status": "success",
            "filename": file.filename,
            "chunks_count": len(chunks),
            "model_used": model_choice
        }
    except Exception as e:
        # If parsing/vectorizing fails, clean up saved raw file
        if saved_file_path.exists():
            saved_file_path.unlink()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/documents")
async def get_user_documents(current_user: User = Depends(get_current_user)):
    """Returns list of uploaded documents and chunk counts for the logged-in user only."""
    documents = list_user_documents(user_id=current_user.id)
    return {"documents": documents}

@router.get("/documents/{doc_name}/preview")
async def preview_user_document(doc_name: str, current_user: User = Depends(get_current_user)):
    """Returns all stored chunks for a specific document to enable full UI preview."""
    preview_data = get_user_document_preview(user_id=current_user.id, doc_name=doc_name)
    if not preview_data.get("chunks"):
        raise HTTPException(status_code=404, detail="Document not found or vector store empty.")
    
    user_file_path = UPLOADS_DIR / str(current_user.id) / doc_name
    preview_data["has_raw_file"] = user_file_path.exists()
    return preview_data

@router.get("/documents/{doc_name}/file")
async def download_user_document(doc_name: str, current_user: User = Depends(get_current_user)):
    """Serves/downloads the original raw uploaded document file for the active user."""
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
    """Deletes a specific uploaded document and its raw file from the active user's account."""
    success = delete_user_document(user_id=current_user.id, doc_name=doc_name)
    
    # Remove original saved file if present
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
    """Retrieves user-isolated document chunks and streams answer from Qwen-2.5-Coder."""
    # 1. Embed query prompt
    query_embedding = embed_texts([request.prompt], model_choice=request.model_choice, is_query=True)[0]
    
    # 2. Retrieve top matching chunks for this user only
    retrieved_chunks = query_user_chunks(
        user_id=current_user.id,
        query_embedding=query_embedding,
        top_k=4
    )
    
    # 3. Stream generated answer via SSE
    return StreamingResponse(
        generate_rag_stream(request.prompt, retrieved_chunks),
        media_type="text/event-stream"
    )
