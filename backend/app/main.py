import sys
from pathlib import Path

# Add project root to sys.path automatically so imports work anywhere
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.database import engine, Base
from backend.app.routers import auth_router, rag_router

# Create database tables automatically
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Local Zero-Cost RAG API",
    description="FastAPI Backend with Docling, ChromaDB, Qwen-2.5-Coder & LangExtract",
    version="1.0.0"
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(auth_router.router)
app.include_router(rag_router.router)

@app.get("/")
def root():
    return {"status": "online", "message": "Local RAG Backend is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
