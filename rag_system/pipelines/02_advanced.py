"""
Pipeline 2: Deterministic Advanced RAG
- Multi-Query Intent Expansion
- Section-Aware Sibling Expansion (Parent-Child Hierarchy)
- Page-Level Provenance Grounding
- Structured Prompt Engineering
"""

import json
import requests
from typing import Dict, Any, List
from rag_system.core import embed_texts, query_user_chunks

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "qwen2.5vl:7b"

def run_advanced_rag(user_id: str, query: str, max_context_chunks: int = 20) -> Dict[str, Any]:
    """
    Executes Deterministic Advanced RAG with multi-query fusion and hierarchical section expansion.
    """
    # 1. Multi-Query Intent Expansion
    queries = [query]
    broad_keywords = ["course", "program", "major", "department", "degree", "requirement", "admission", "list", "all", "what are"]
    if any(k in query.lower() for k in broad_keywords):
        queries.append(f"academic programs, colleges, majors, and departments: {query}")
        queries.append(f"curriculum, degrees offered, and course focus areas: {query}")

    query_embeddings = embed_texts(queries, is_query=True)

    # 2. Multi-Query Retrieval with Sibling Expansion
    seen_texts = set()
    retrieved_chunks = []

    for q_emb in query_embeddings:
        results = query_user_chunks(
            user_id=user_id,
            query_embedding=q_emb,
            top_k=8,
            expand_siblings=True
        )
        for chunk in results:
            text_key = chunk.get("text", "")[:100]
            if text_key not in seen_texts:
                seen_texts.add(text_key)
                retrieved_chunks.append(chunk)

    # Sort chunks by document sequence index for natural reading order
    retrieved_chunks.sort(key=lambda x: x.get("metadata", {}).get("chunk_index", 0))
    final_chunks = retrieved_chunks[:max_context_chunks]

    # 3. Format structured hierarchical context
    context_parts = []
    for idx, c in enumerate(final_chunks, 1):
        doc = c.get("metadata", {}).get("doc_name", "Document")
        page = c.get("metadata", {}).get("page_number", 1)
        b_crumb = c.get("metadata", {}).get("breadcrumb", "")
        header = f"[{idx}] Source: {doc} (Page {page})"
        if b_crumb:
            header += f" | Section: {b_crumb}"
        context_parts.append(f"{header}\n{c['text']}")

    context_str = "\n\n---\n\n".join(context_parts)

    system_prompt = (
        "You are an expert AI assistant answering questions using only the provided document context.\n"
        "Instructions:\n"
        "1. Base your answer strictly on the provided DOCUMENT CONTEXT.\n"
        "2. If lists or tables are present, be comprehensive and include all items.\n"
        "3. Cite the document, section, and page number for facts."
    )

    full_prompt = f"{system_prompt}\n\nDOCUMENT CONTEXT:\n{context_str}\n\nQUESTION: {query}\n\nANSWER:"

    res = requests.post(
        OLLAMA_URL,
        json={"model": MODEL_NAME, "prompt": full_prompt, "stream": False, "options": {"temperature": 0.1, "num_ctx": 4096}},
        timeout=90
    )

    answer = res.json().get("response", "").strip() if res.status_code == 200 else "Generation failed"

    return {
        "pipeline": "02_advanced",
        "query": query,
        "retrieved_chunks_count": len(final_chunks),
        "chunks": final_chunks,
        "answer": answer
    }
