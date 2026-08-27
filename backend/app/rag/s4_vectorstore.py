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

def get_user_collection(collection_name: str = "user_documents"):
    client = get_chroma_client()
    return client.get_or_create_collection(name=collection_name)

def store_chunks(user_id: str, doc_name: str, chunks: list[str], embeddings: list[list[float]]):
    collection = get_user_collection()
    
    ids = [f"{user_id}_{doc_name}_{i}" for i in range(len(chunks))]
    metadatas = [
        {
            "user_id": user_id, 
            "doc_name": doc_name,
            "chunk_index": i
        } for i in range(len(chunks))
    ]
    
    collection.add(
        ids=ids,
        documents=chunks,
        embeddings=embeddings,
        metadatas=metadatas
    )

def query_user_chunks(user_id: str, query_embedding: list[float], top_k: int = 4) -> list[dict]:
    collection = get_user_collection()
    
    results = collection.query(
        query_embeddings=[query_embedding],
        where={"user_id": user_id},
        n_results=top_k
    )
    
    retrieved = []
    if results and results.get("documents"):
        docs = results["documents"][0]
        metas = results["metadatas"][0]
        for doc, meta in zip(docs, metas):
            retrieved.append({
                "text": doc,
                "metadata": meta
            })
    return retrieved
