"""
Phase 1: Basic Naive RAG
- Fixed blind Top-K retrieval
- Simple prompt concatenation
- Direct LLM completion
"""

from typing import Dict, Any
from backend.core import embed_texts, query_user_chunks, generate_completion

def run_basic_rag(user_id: str, query: str, top_k: int = 4) -> Dict[str, Any]:
    """
    Baseline Naive RAG pipeline.
    """
    query_emb = embed_texts([query], is_query=True)[0]
    chunks = query_user_chunks(user_id=user_id, query_embedding=query_emb, top_k=top_k, expand_siblings=False)
    
    context_str = "\n\n".join([f"Source: {c['metadata'].get('doc_name')}\n{c['text']}" for c in chunks])
    prompt = (
        f"Answer the question using only the context below:\n\n"
        f"CONTEXT:\n{context_str}\n\n"
        f"QUESTION: {query}\n\n"
        f"ANSWER:"
    )
    
    answer = generate_completion(prompt)
    return {
        "pipeline": "01_basic",
        "query": query,
        "retrieved_chunks_count": len(chunks),
        "chunks": chunks,
        "answer": answer
    }
