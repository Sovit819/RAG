import torch
from sentence_transformers import SentenceTransformer

_model = None

def get_device() -> str:
    if torch.backends.mps.is_available():
        return "mps"
    elif torch.cuda.is_available():
        return "cuda"
    return "cpu"

def get_embedding_model():
    global _model
    if _model is None:
        device = get_device()
        model_name = "nomic-ai/nomic-embed-text-v1.5"
        _model = SentenceTransformer(
            model_name, 
            trust_remote_code=True,
            device=device
        )
        if hasattr(_model, "tokenizer") and hasattr(_model.tokenizer, "model_max_length"):
            _model.tokenizer.model_max_length = getattr(_model, "max_seq_length", 8192) or 8192

    return _model

def embed_texts(texts: list[str], is_query: bool = False, **kwargs) -> list[list[float]]:
    """
    Computes normalized vector embeddings using local Nomic Embed Text v1.5 with hardware acceleration.
    """
    if not texts:
        return []

    model = get_embedding_model()
    prefix = "search_query: " if is_query else "search_document: "
    formatted_texts = [f"{prefix}{t}" for t in texts]

    embeddings = model.encode(
        formatted_texts, 
        convert_to_numpy=True, 
        normalize_embeddings=True,
        batch_size=16
    )
    return embeddings.tolist()
