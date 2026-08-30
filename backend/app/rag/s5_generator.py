import json
import requests
from typing import Generator

OLLAMA_URL = "http://localhost:11434/api/generate"
DEFAULT_MODEL = "qwen2.5-coder:7b"

def generate_rag_stream(prompt: str, context_chunks: list[dict], model_name: str = DEFAULT_MODEL) -> Generator[str, None, None]:
    """Generates a streaming response using Qwen-2.5-Coder-7B with retrieved context."""
    if not context_chunks:
        context_str = "No user document context found. Please upload a document to answer from context."
    else:
        context_str = "\n\n---\n\n".join([f"Source: {c['metadata'].get('doc_name', 'Document')}\n{c['text']}" for c in context_chunks])
    
    system_prompt = (
        "You are an expert AI assistant answering questions using only the provided document context.\n"
        "If the context does not contain the answer, state that clearly.\n"
        "Cite the document name when using facts from it."
    )
    
    full_prompt = f"{system_prompt}\n\nDOCUMENT CONTEXT:\n{context_str}\n\nUSER QUESTION: {prompt}\n\nANSWER:"
    
    payload = {
        "model": model_name,
        "prompt": full_prompt,
        "stream": True
    }
    
    try:
        # Added timeout=15 to prevent backend server hanging if Ollama is unreachable
        response = requests.post(OLLAMA_URL, json=payload, stream=True, timeout=15)
        response.raise_for_status()
        for line in response.iter_lines():
            if line:
                data = json.loads(line.decode("utf-8"))
                token = data.get("response", "")
                if token:
                    yield f"data: {json.dumps({'token': token})}\n\n"
    except requests.exceptions.Timeout:
        yield f"data: {json.dumps({'error': 'Ollama server request timed out. Please verify Ollama is running (`ollama serve`).'})}\n\n"
    except requests.exceptions.ConnectionError:
        yield f"data: {json.dumps({'error': 'Cannot connect to Ollama on http://localhost:11434. Please start Ollama (`ollama serve`).'})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
