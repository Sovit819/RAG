import sys
import argparse
import importlib
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

def run_server():
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)

def run_cli_basic():
    p1 = importlib.import_module("backend.pipelines.01_basic")

    parser = argparse.ArgumentParser(description="Basic RAG Pipeline Runner")
    parser.add_argument("--server", action="store_true", help="Start FastAPI Web Server")
    parser.add_argument("--query", type=str, default="What are the courses offered at KAIST?", help="Question to ask")
    parser.add_argument("--user_id", type=str, default="8346407f-7b9e-4caf-824c-db3ccc08f8ff", help="User ID for ChromaDB collection")
    parser.add_argument("--top_k", type=int, default=4, help="Top-K chunks to retrieve")

    args = parser.parse_args()

    if args.server or len(sys.argv) == 1:
        run_server()
        return

    print(f"\n========================================================")
    print(f" BASIC RAG PIPELINE (Phase 1)")
    print(f" Query: '{args.query}'")
    print(f" User ID: '{args.user_id}'")
    print(f" Top-K: {args.top_k}")
    print(f"========================================================\n")

    res = p1.run_basic_rag(user_id=args.user_id, query=args.query, top_k=args.top_k)

    print(f"Retrieved Chunks Count: {res['retrieved_chunks_count']}")
    print(f"\nFINAL ANSWER:\n{res['answer']}\n")

if __name__ == "__main__":
    if len(sys.argv) == 1:
        run_server()
    else:
        run_cli_basic()
