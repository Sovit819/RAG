import os
from typing import List
import torch
from sentence_transformers import SentenceTransformer

MODEL_NAME = "nomic-ai/nomic-embed-text-v1.5"
_model = None

def get_device() -> str:
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"

def get_embedding_model() -> SentenceTransformer:
    global _model
    if _model is None:
        device = get_device()
        print(f"[EMBEDDINGS] Loading {MODEL_NAME} on {device.upper()} (MPS/Apple Silicon Accelerated)...")
        _model = SentenceTransformer(
            MODEL_NAME, 
            trust_remote_code=True,
            device=device
        )
        _model.tokenizer.model_max_length = 8192
    return _model

def embed_texts(texts: List[str], is_query: bool = False) -> List[List[float]]:
    if not texts:
        return []
    
    model = get_embedding_model()
    prefix = "search_query: " if is_query else "search_document: "
    prefixed_texts = [f"{prefix}{t}" for t in texts]
    
    embeddings = model.encode(
        prefixed_texts,
        normalize_embeddings=True,
        show_progress_bar=False,
        batch_size=32
    )
    return embeddings.tolist()
