import hashlib
import uuid
from pathlib import Path
import chromadb

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
CHROMA_DIR = DATA_DIR / "chromadb"
CHROMA_DIR.mkdir(parents=True, exist_ok=True)

_client = None

def get_chroma_client():
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    return _client

def get_user_collection(user_id: str):
    """
    Returns a dedicated, isolated ChromaDB collection per user.
    Collection name is physically prefixed with user_id to guarantee 
    100% strict cross-user data isolation.
    """
    client = get_chroma_client()
    sanitized_user_id = user_id.replace("-", "_")
    collection_name = f"user_{sanitized_user_id}"
    return client.get_or_create_collection(name=collection_name)

def store_chunks(user_id: str, doc_name: str, chunks: list[dict], embeddings: list[list[float]]):
    """Stores chunks in the logged-in user's dedicated collection using unique IDs and breadcrumb metadata."""
    collection = get_user_collection(user_id)
    
    # Generate unique IDs using SHA-256 hash to prevent collisions
    ids = [
        f"{user_id}_{hashlib.sha256(f'{doc_name}_{i}_{uuid.uuid4()}'.encode()).hexdigest()[:16]}" 
        for i in range(len(chunks))
    ]
    
    documents = [c["text"] if isinstance(c, dict) else str(c) for c in chunks]
    metadatas = [
        {
            "user_id": user_id, 
            "doc_name": doc_name,
            "chunk_index": i,
            "breadcrumb": c.get("breadcrumb", "") if isinstance(c, dict) else ""
        } for i, c in enumerate(chunks)
    ]
    
    collection.add(
        ids=ids,
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas
    )

def query_user_chunks(user_id: str, query_embedding: list[float], top_k: int = 4) -> list[dict]:
    """Queries top K matching chunks strictly within the user's dedicated collection."""
    collection = get_user_collection(user_id)
    
    if collection.count() == 0:
        return []
    
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k, collection.count())
    )
    
    retrieved = []
    if results and results.get("documents") and results["documents"][0]:
        docs = results["documents"][0]
        metas = results["metadatas"][0]
        for doc, meta in zip(docs, metas):
            retrieved.append({
                "text": doc,
                "metadata": meta
            })
    return retrieved

def list_user_documents(user_id: str) -> list[dict]:
    """Lists all uploaded documents and their chunk counts for the active user."""
    collection = get_user_collection(user_id)
    if collection.count() == 0:
        return []
    
    all_data = collection.get(include=["metadatas"])
    doc_summary: dict[str, int] = {}
    
    if all_data and all_data.get("metadatas"):
        for meta in all_data["metadatas"]:
            doc_name = meta.get("doc_name", "Unknown Document")
            doc_summary[doc_name] = doc_summary.get(doc_name, 0) + 1
            
    return [
        {"doc_name": name, "chunks_count": count} 
        for name, count in doc_summary.items()
    ]

def get_user_document_preview(user_id: str, doc_name: str) -> dict:
    """Retrieves all stored chunks for a specific document to enable full UI preview."""
    collection = get_user_collection(user_id)
    if collection.count() == 0:
        return {"doc_name": doc_name, "chunks_count": 0, "chunks": []}
    
    results = collection.get(where={"doc_name": doc_name}, include=["documents", "metadatas"])
    chunks = []
    if results and results.get("documents"):
        docs = results["documents"]
        metas = results["metadatas"]
        for doc, meta in zip(docs, metas):
            chunks.append({
                "chunk_index": meta.get("chunk_index", 0),
                "breadcrumb": meta.get("breadcrumb", ""),
                "text": doc
            })
        # Sort by original chunk sequence index
        chunks.sort(key=lambda x: x["chunk_index"])
        
    return {
        "doc_name": doc_name,
        "chunks_count": len(chunks),
        "chunks": chunks
    }

def delete_user_document(user_id: str, doc_name: str) -> bool:
    """Deletes a specific document and its vector chunks from the user's dedicated collection."""
    collection = get_user_collection(user_id)
    if collection.count() == 0:
        return False
    
    collection.delete(where={"doc_name": doc_name})
    return True
