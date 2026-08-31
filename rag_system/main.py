import sys
import argparse
from pathlib import Path

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from rag_system.pipelines.01_basic import run_basic_rag
from rag_system.pipelines.02_advanced import run_advanced_rag
from rag_system.pipelines.03_agentic import run_agentic_rag

def main():
    parser = argparse.ArgumentParser(description="Modular RAG System Benchmark & Dispatcher")
    parser.add_argument("--pipeline", choices=["01_basic", "02_advanced", "03_agentic"], default="02_advanced", help="Select pipeline to run")
    parser.add_argument("--query", type=str, default="What are the courses offered at KAIST?", help="Question to ask")
    parser.add_argument("--user_id", type=str, default="8346407f-7b9e-4caf-824c-db3ccc08f8ff", help="User ID for ChromaDB collection")
    parser.add_argument("--compare", action="store_true", help="Compare all 3 pipelines side-by-side")

    args = parser.parse_args()

    print(f"\n========================================================")
    print(f" RAG SYSTEM RUNNER")
    print(f" Query: '{args.query}'")
    print(f" User ID: '{args.user_id}'")
    print(f"========================================================\n")

    if args.compare:
        print(">>> 1. Running 01_basic (Naive RAG)...")
        res1 = run_basic_rag(user_id=args.user_id, query=args.query)
        print(f"Chunks retrieved: {res1['retrieved_chunks_count']}")
        print(f"Answer Preview:\n{res1['answer'][:250]}...\n")

        print(">>> 2. Running 02_advanced (Deterministic Section-Aware RAG)...")
        res2 = run_advanced_rag(user_id=args.user_id, query=args.query)
        print(f"Chunks retrieved: {res2['retrieved_chunks_count']}")
        print(f"Answer Preview:\n{res2['answer'][:250]}...\n")

        print(">>> 3. Running 03_agentic (Autonomous Multi-Hop RAG)...")
        res3 = run_agentic_rag(user_id=args.user_id, query=args.query)
        print(f"Answer Preview:\n{res3['answer'][:250]}...\n")
        return

    if args.pipeline == "01_basic":
        res = run_basic_rag(user_id=args.user_id, query=args.query)
    elif args.pipeline == "02_advanced":
        res = run_advanced_rag(user_id=args.user_id, query=args.query)
    elif args.pipeline == "03_agentic":
        res = run_agentic_rag(user_id=args.user_id, query=args.query)

    print(f"--- Pipeline: {res.get('pipeline')} ---")
    if "retrieved_chunks_count" in res:
        print(f"Retrieved Chunks: {res['retrieved_chunks_count']}")
    print(f"\nFINAL ANSWER:\n{res.get('answer')}\n")

if __name__ == "__main__":
    main()
