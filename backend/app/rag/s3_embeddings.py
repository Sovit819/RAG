import torch
from sentence_transformers import SentenceTransformer

_models = {}

def get_device() -> str:
    if torch.backends.mps.is_available():
        return "mps"
    elif torch.cuda.is_available():
        return "cuda"
    return "cpu"

def get_embedding_model(model_choice: str = "nomic"):
    global _models
    device = get_device()
    
    if model_choice not in _models:
        if model_choice == "nemotron":
            model_name = "nvidia/Llama-3.2-NV-Embed-1B-v2"
        else:
            model_name = "nomic-ai/nomic-embed-text-v1.5"
            
        _models[model_choice] = SentenceTransformer(
            model_name, 
            trust_remote_code=True,
            device=device
        )
    return _models[model_choice]

def embed_texts(texts: list[str], model_choice: str = "nomic") -> list[list[float]]:
    model = get_embedding_model(model_choice)
    embeddings = model.encode(texts, convert_to_numpy=True)
    return embeddings.tolist()
