"""
Pipeline 1: Basic Naive RAG
- Fixed blind Top-K retrieval
- Simple prompt concatenation
- Direct LLM completion
"""

import json
import requests
from typing import Dict, Any, List
from rag_system.core import embed_texts, query_user_chunks

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "qwen2.5vl:7b"

def run_basic_rag(user_id: str, query: str, top_k: int = 4) -> Dict[str, Any]:
    """
    Executes baseline Naive RAG without query expansion or sibling hierarchy.
    """
    # 1. Embed query directly
    query_emb = embed_texts([query], is_query=True)[0]
    
    # 2. Blind top-k vector search
    chunks = query_user_chunks(user_id=user_id, query_embedding=query_emb, top_k=top_k, expand_siblings=False)
    
    # 3. Simple context assembly
    context_str = "\n\n".join([f"Source: {c['metadata'].get('doc_name')}\n{c['text']}" for c in chunks])
    prompt = (
        f"Answer the question using only the context below:\n\n"
        f"CONTEXT:\n{context_str}\n\n"
        f"QUESTION: {query}\n\n"
        f"ANSWER:"
    )
    
    # 4. Generate response
    res = requests.post(
        OLLAMA_URL,
        json={"model": MODEL_NAME, "prompt": prompt, "stream": False, "options": {"temperature": 0.1}},
        timeout=60
    )
    
    answer = res.json().get("response", "").strip() if res.status_code == 200 else "Generation failed"
    return {
        "pipeline": "01_basic",
        "query": query,
        "retrieved_chunks_count": len(chunks),
        "chunks": chunks,
        "answer": answer
    }
