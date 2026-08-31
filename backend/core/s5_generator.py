import json
import requests
from typing import Generator, List, Dict, Any

OLLAMA_URL = "http://localhost:11434/api/generate"
DEFAULT_MODEL = "qwen2.5vl:7b"

def generate_completion(prompt: str, model_name: str = DEFAULT_MODEL, temperature: float = 0.1) -> str:
    res = requests.post(
        OLLAMA_URL,
        json={"model": model_name, "prompt": prompt, "stream": False, "options": {"temperature": temperature}},
        timeout=90
    )
    if res.status_code == 200:
        return res.json().get("response", "").strip()
    return "Generation failed."

def generate_rag_stream(
    prompt: str, 
    context_chunks: List[Dict[str, Any]], 
    model_name: str = DEFAULT_MODEL
) -> Generator[str, None, None]:
    sources_payload = [
        {
            "doc_name": c.get("metadata", {}).get("doc_name", "Document"),
            "chunk_index": c.get("metadata", {}).get("chunk_index", 0),
            "page_number": c.get("metadata", {}).get("page_number", 1),
            "breadcrumb": c.get("metadata", {}).get("breadcrumb", ""),
            "similarity": c.get("similarity", 1.0),
            "text": c.get("text", "")
        }
        for c in context_chunks
    ]
    
    yield f"data: {json.dumps({'type': 'sources', 'sources': sources_payload})}\n\n"

    if not context_chunks:
        msg = "No relevant context was found in your uploaded documents to answer this question."
        yield f"data: {json.dumps({'type': 'token', 'token': msg, 'done': True})}\n\n"
        return

    context_parts = []
    for idx, c in enumerate(context_chunks, 1):
        doc = c.get("metadata", {}).get("doc_name", "Doc")
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

    full_prompt = f"{system_prompt}\n\nDOCUMENT CONTEXT:\n{context_str}\n\nQUESTION: {prompt}\n\nANSWER:"

    payload = {
        "model": model_name,
        "prompt": full_prompt,
        "stream": True,
        "options": {
            "temperature": 0.1,
            "num_ctx": 4096
        }
    }

    try:
        response = requests.post(OLLAMA_URL, json=payload, stream=True, timeout=60)
        for line in response.iter_lines():
            if line:
                chunk = json.loads(line.decode("utf-8"))
                token = chunk.get("response", "")
                done = chunk.get("done", False)
                yield f"data: {json.dumps({'type': 'token', 'token': token, 'done': done})}\n\n"
                if done:
                    break
    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
