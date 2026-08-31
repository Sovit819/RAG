import json
import requests
from typing import Generator, List, Dict, Any

OLLAMA_URL = "http://localhost:11434/api/generate"
DEFAULT_MODEL = "qwen2.5vl:7b"

def generate_rag_stream(
    prompt: str, 
    context_chunks: List[Dict[str, Any]], 
    model_name: str = DEFAULT_MODEL
) -> Generator[str, None, None]:
    """
    Generates a streaming response using Qwen-2.5-Coder with contextualized retrieval grounding.
    Emits a structured 'sources' metadata event followed by streaming token events.
    """
    # 1. Prepare and emit retrieved sources event for frontend grounding
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

    # 2. If no context found, return informative response immediately
    if not context_chunks:
        msg = "No relevant context was found in your uploaded documents to answer this question. Please ensure your document contains this information or try rephrasing."
        yield f"data: {json.dumps({'type': 'token', 'token': msg, 'done': True})}\n\n"
        return

    # 3. Format structured context with document & section hierarchy
    context_blocks = []
    for idx, c in enumerate(context_chunks, 1):
        doc_name = c.get("metadata", {}).get("doc_name", "Document")
        breadcrumb = c.get("metadata", {}).get("breadcrumb", "")
        header = f"[{idx}] Source Document: {doc_name}"
        if breadcrumb:
            header += f" | Section: {breadcrumb}"
        context_blocks.append(f"{header}\n{c.get('text', '')}")

    context_str = "\n\n---\n\n".join(context_blocks)

    system_prompt = (
        "You are an expert AI assistant answering questions using only the provided document context.\n"
        "Guidelines:\n"
        "1. Base your answer strictly on the provided DOCUMENT CONTEXT.\n"
        "2. If the context does not contain the answer, explicitly state that the documents do not provide this information.\n"
        "3. Maintain exact numeric values, dates, tables, and specific terminology from the source.\n"
        "4. Reference the document and section when citing facts."
    )

    full_prompt = (
        f"{system_prompt}\n\n"
        f"DOCUMENT CONTEXT:\n{context_str}\n\n"
        f"USER QUESTION: {prompt}\n\n"
        f"ANSWER:"
    )

    payload = {
        "model": model_name,
        "prompt": full_prompt,
        "stream": True,
        "options": {
            "temperature": 0.1,
            "top_p": 0.9,
            "num_ctx": 4096
        }
    }

    try:
        response = requests.post(OLLAMA_URL, json=payload, stream=True, timeout=30)
        response.raise_for_status()
        for line in response.iter_lines():
            if line:
                data = json.loads(line.decode("utf-8"))
                token = data.get("response", "")
                is_done = data.get("done", False)
                if token or is_done:
                    yield f"data: {json.dumps({'type': 'token', 'token': token, 'done': is_done})}\n\n"
    except requests.exceptions.Timeout:
        yield f"data: {json.dumps({'type': 'error', 'error': 'Ollama server request timed out. Please verify Ollama is running (`ollama serve`).'})}\n\n"
    except requests.exceptions.ConnectionError:
        yield f"data: {json.dumps({'type': 'error', 'error': 'Cannot connect to Ollama on http://localhost:11434. Please start Ollama (`ollama serve`).'})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
