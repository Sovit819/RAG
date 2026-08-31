"""
Pipeline 3: Autonomous Agentic RAG
- ReAct Agent loop (Thought -> Action -> Observation -> Final Answer)
- Tool-calling: Vector Search, Page-Level Inspector, Section Aggregator
- Multi-Hop self-correcting query planning
"""

import json
import re
import requests
from typing import Dict, Any, List
from rag_system.core import embed_texts, query_user_chunks, get_section_sibling_chunks, get_user_collection

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "qwen2.5vl:7b"

class AgenticTools:
    def __init__(self, user_id: str):
        self.user_id = user_id

    def search_documents(self, query: str) -> str:
        """Searches vector chunks for semantic keywords."""
        q_emb = embed_texts([query], is_query=True)[0]
        results = query_user_chunks(user_id=self.user_id, query_embedding=q_emb, top_k=6, expand_siblings=False)
        if not results:
            return "No matching chunks found."
        formatted = []
        for r in results:
            doc = r.get("metadata", {}).get("doc_name")
            page = r.get("metadata", {}).get("page_number", 1)
            b = r.get("metadata", {}).get("breadcrumb", "")
            formatted.append(f"[Doc: {doc} | Page {page} | Section: {b}]\n{r['text']}")
        return "\n\n---\n\n".join(formatted)

    def fetch_full_section(self, doc_name: str, section_title: str) -> str:
        """Retrieves all chunks across pages for a specific section title."""
        siblings = get_section_sibling_chunks(user_id=self.user_id, doc_name=doc_name, root_breadcrumb=section_title, max_chunks=30)
        if not siblings:
            return f"No section matching '{section_title}' in {doc_name}."
        return "\n\n".join([f"[Page {s['metadata'].get('page_number')}]\n{s['text']}" for s in siblings])

def run_agentic_rag(user_id: str, query: str, max_iterations: int = 3) -> Dict[str, Any]:
    """
    Executes Agentic Multi-Hop RAG with autonomous tool-calling loops.
    """
    tools = AgenticTools(user_id=user_id)
    history = []
    
    agent_prompt = (
        "You are an autonomous AI Agent answering complex user questions using available document tools.\n"
        "You have access to the following tools:\n"
        "1. `search_documents(query=\"...\")`: Searches for specific facts/keywords.\n"
        "2. `fetch_full_section(doc_name=\"...\", section_title=\"...\")`: Fetches the entire multi-page section.\n\n"
        "Format your responses as follows:\n"
        "Thought: [Explain your reasoning step and what information you still need]\n"
        "Action: tool_name(param=\"...\")\n"
        "When you have collected all required information to fully answer the question, write:\n"
        "Thought: I now have the full evidence.\n"
        "Final Answer: [Your comprehensive, grounded answer with citations]\n\n"
        f"USER QUESTION: {query}"
    )

    current_prompt = agent_prompt

    for step in range(max_iterations):
        res = requests.post(
            OLLAMA_URL,
            json={"model": MODEL_NAME, "prompt": current_prompt, "stream": False, "options": {"temperature": 0.1}},
            timeout=90
        )
        if res.status_code != 200:
            break

        output = res.json().get("response", "").strip()
        history.append({"step": step + 1, "output": output})

        # Check if Final Answer reached
        if "Final Answer:" in output:
            final_answer = output.split("Final Answer:")[-1].strip()
            return {
                "pipeline": "03_agentic",
                "query": query,
                "iterations": step + 1,
                "history": history,
                "answer": final_answer
            }

        # Parse Action
        action_match = re.search(r'Action:\s*(\w+)\((.*?)\)', output)
        if action_match:
            tool_name = action_match.group(1).strip()
            args_str = action_match.group(2).strip()
            
            observation = ""
            if tool_name == "search_documents":
                clean_q = args_str.replace('query=', '').replace('"', '').replace("'", '').strip()
                observation = tools.search_documents(clean_q)
            elif tool_name == "fetch_full_section":
                parts = [p.strip().replace('"', '').replace("'", '') for p in args_str.split(",")]
                d_name = parts[0].replace('doc_name=', '').strip() if len(parts) > 0 else ""
                s_title = parts[1].replace('section_title=', '').strip() if len(parts) > 1 else ""
                observation = tools.fetch_full_section(d_name, s_title)
            else:
                observation = f"Unknown tool: {tool_name}"

            current_prompt += f"\n\n{output}\nObservation:\n{observation}\n\nContinue reasoning."
        else:
            break

    # Fallback to advanced pipeline if agent did not terminate
    from rag_system.pipelines.02_advanced import run_advanced_rag
    return run_advanced_rag(user_id=user_id, query=query)
