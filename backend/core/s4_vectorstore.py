import hashlib
import uuid
from pathlib import Path
from typing import List, Dict, Any, Optional
import chromadb

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CHROMA_DIR = DATA_DIR / "chromadb"
CHROMA_DIR.mkdir(parents=True, exist_ok=True)

_client = None

def get_chroma_client():
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    return _client

def get_user_collection(user_id: str):
    client = get_chroma_client()
    sanitized_user_id = str(user_id).replace("-", "_")
    collection_name = f"user_{sanitized_user_id}"
    
    return client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"}
    )

def store_chunks(
    user_id: str, 
    doc_name: str, 
    chunks: List[Dict[str, Any]], 
    embeddings: List[List[float]],
    parser_engine: str = "Docling TableFormer (OCR)",
    **kwargs
):
    collection = get_user_collection(user_id)
    
    ids = [
        f"{user_id}_{hashlib.sha256(f'{doc_name}_{i}_{uuid.uuid4()}'.encode()).hexdigest()[:16]}" 
        for i in range(len(chunks))
    ]
    
    documents = [c.get("text", str(c)) for c in chunks]
    metadatas = []
    for i, c in enumerate(chunks):
        breadcrumb = c.get("breadcrumb", "")
        context_text = c.get("context_text", c.get("text", ""))
        page_num = c.get("page_number", 1)
        metadatas.append({
            "user_id": str(user_id), 
            "doc_name": str(doc_name),
            "chunk_index": int(i),
            "page_number": int(page_num),
            "breadcrumb": str(breadcrumb),
            "context_preview": str(context_text)[:500],
            "parser_engine": str(parser_engine)
        })
    
    collection.add(
        ids=ids,
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas
    )

def get_section_sibling_chunks(
    user_id: str,
    doc_name: str,
    root_breadcrumb: str,
    max_chunks: int = 40
) -> List[Dict[str, Any]]:
    if not root_breadcrumb or not root_breadcrumb.strip():
        return []
        
    collection = get_user_collection(user_id)
    if collection.count() == 0:
        return []

    try:
        clean_root = root_breadcrumb.split(">")[0].strip()
        all_doc_chunks = collection.get(
            where={"doc_name": doc_name},
            include=["documents", "metadatas"]
        )
        
        siblings = []
        if all_doc_chunks and all_doc_chunks.get("documents"):
            docs = all_doc_chunks["documents"]
            metas = all_doc_chunks["metadatas"]
            for doc, meta in zip(docs, metas):
                b_crumb = meta.get("breadcrumb", "")
                if clean_root.lower() in b_crumb.lower() or b_crumb.lower() in clean_root.lower():
                    siblings.append({
                        "text": doc,
                        "metadata": meta,
                        "similarity": 0.95,
                        "distance": 0.05
                    })
                    
            siblings.sort(key=lambda x: x["metadata"].get("chunk_index", 0))
            return siblings[:max_chunks]
    except Exception:
        pass
        
    return []

def query_user_chunks(
    user_id: str, 
    query_embedding: List[float], 
    top_k: int = 6,
    expand_siblings: bool = False,
    **kwargs
) -> List[Dict[str, Any]]:
    collection = get_user_collection(user_id)
    
    if collection.count() == 0:
        return []
    
    n_results = min(top_k, collection.count())
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=n_results,
        include=["documents", "metadatas", "distances"]
    )
    
    retrieved = []
    if results and results.get("documents") and results["documents"][0]:
        docs = results["documents"][0]
        metas = results["metadatas"][0]
        distances = results.get("distances", [[0.0] * len(docs)])[0]
        
        for doc, meta, dist in zip(docs, metas, distances):
            d = float(dist)
            if d <= 1.0:
                sim = 1.0 - d
            else:
                sim = max(0.0, 1.0 - (d / 2.0))
            sim = max(0.0, min(1.0, sim))
            
            retrieved.append({
                "text": doc,
                "metadata": meta,
                "similarity": round(sim, 4),
                "distance": round(d, 4)
            })
                
    retrieved.sort(key=lambda x: x["similarity"], reverse=True)

    if expand_siblings and retrieved:
        top_match = retrieved[0]
        top_breadcrumb = top_match["metadata"].get("breadcrumb", "")
        doc_name = top_match["metadata"].get("doc_name", "")
        
        if top_breadcrumb and doc_name:
            siblings = get_section_sibling_chunks(
                user_id=user_id,
                doc_name=doc_name,
                root_breadcrumb=top_breadcrumb,
                max_chunks=25
            )
            if len(siblings) > len(retrieved):
                return siblings

    return retrieved

def list_user_documents(user_id: str, **kwargs) -> List[Dict[str, Any]]:
    collection = get_user_collection(user_id)
    if collection.count() == 0:
        return []
        
    all_data = collection.get(include=["metadatas"])
    doc_summary: Dict[str, Dict[str, Any]] = {}
    
    if all_data and all_data.get("metadatas"):
        for meta in all_data["metadatas"]:
            doc_name = meta.get("doc_name", "Unknown Document")
            parser_engine = meta.get("parser_engine", "Docling TableFormer")
            if doc_name not in doc_summary:
                doc_summary[doc_name] = {"doc_name": doc_name, "chunks_count": 0, "parser_engine": parser_engine}
            doc_summary[doc_name]["chunks_count"] += 1
            
    return list(doc_summary.values())

def get_user_document_preview(user_id: str, doc_name: str, **kwargs) -> Dict[str, Any]:
    collection = get_user_collection(user_id)
    if collection.count() == 0:
        return {"doc_name": doc_name, "chunks_count": 0, "chunks": [], "parser_engine": "Unknown"}
    
    results = collection.get(where={"doc_name": doc_name}, include=["documents", "metadatas"])
    chunks = []
    parser_engine = "Docling TableFormer"
    
    if results and results.get("documents"):
        docs = results["documents"]
        metas = results["metadatas"]
        for doc, meta in zip(docs, metas):
            parser_engine = meta.get("parser_engine", parser_engine)
            chunks.append({
                "chunk_index": meta.get("chunk_index", 0),
                "page_number": meta.get("page_number", 1),
                "breadcrumb": meta.get("breadcrumb", ""),
                "text": doc,
                "parser_engine": meta.get("parser_engine", parser_engine)
            })
        chunks.sort(key=lambda x: x["chunk_index"])
        
    return {
        "doc_name": doc_name,
        "chunks_count": len(chunks),
        "chunks": chunks,
        "parser_engine": parser_engine
    }

def delete_user_document(user_id: str, doc_name: str, **kwargs) -> bool:
    collection = get_user_collection(user_id)
    if collection.count() == 0:
        return False
        
    collection.delete(where={"doc_name": doc_name})
    return True
