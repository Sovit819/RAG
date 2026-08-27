import tempfile
import os
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.app.auth import get_current_user
from backend.app.models import User
from backend.app.rag.s1_parser import parse_document_to_markdown
from backend.app.rag.s2_splitter import split_markdown_document
from backend.app.rag.s3_embeddings import embed_texts
from backend.app.rag.s4_vectorstore import store_chunks, query_user_chunks
from backend.app.rag.s5_generator import generate_rag_stream

router = APIRouter(prefix="/api/v1/rag", tags=["rag"])

class QueryRequest(BaseModel):
    prompt: str
    model_choice: str = "nomic"

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    model_choice: str = Form("nomic"),
    current_user: User = Depends(get_current_user)
):
    """Uploads a document, parses with Docling, chunks with MarkdownTextSplitter, embeds, and stores in ChromaDB."""
    suffix = os.path.splitext(file.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # 1. Parse document to Markdown
        markdown_text = parse_document_to_markdown(tmp_path)
        
        # 2. Chunk markdown text
        chunks = split_markdown_document(markdown_text)
        if not chunks:
            raise HTTPException(status_code=400, detail="No extractable text found in document.")
            
        # 3. Generate Embeddings (Nomic vs. Nemotron VL)
        embeddings = embed_texts(chunks, model_choice=model_choice)
        
        # 4. Store in ChromaDB with user_id metadata
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
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

@router.post("/query")
async def query_rag(
    request: QueryRequest,
    current_user: User = Depends(get_current_user)
):
    """Retrieves user-isolated document chunks and streams answer from Qwen-2.5-Coder."""
    # 1. Embed query prompt
    query_embedding = embed_texts([request.prompt], model_choice=request.model_choice)[0]
    
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
