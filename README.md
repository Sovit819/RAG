# ⚡ Local Zero-Cost RAG Pipeline

A high-performance, private, zero-cost **Retrieval-Augmented Generation (RAG)** application running 100% locally on Apple Silicon (M-series Mac).

Built with **React**, **FastAPI**, **Docling**, **ChromaDB**, **Qwen-2.5-Coder-7B-Instruct**, **Google LangExtract** for character-level citations, and browser-native **Web Speech API** for voice input and audio readout.

---

## 🚀 How to Run (Simple Commands)

Make sure your virtual environment is active (`source venv/bin/activate`).

### 1. Run Frontend
From the root folder:
```bash
npm run dev
```
*(Open **`http://localhost:5173`** in your browser)*

---

### 2. Run Backend
From the root folder:
```bash
python backend/app/main.py
```
*(Runs FastAPI server on **`http://localhost:8000`**)*

---

### 3. Run Ollama (for Qwen 2.5 Coder reasoning)
```bash
ollama run qwen2.5-coder:7b
```

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React Frontend (Vite + TS)                      │
│  ├── Voice Input (Web Speech STT)  ──► Real-time transcription         │
│  ├── Document Upload Zone          ──► Drag & drop PDF/DOCX/MD         │
│  ├── Embedding Model Selector      ──► Nomic vs. Nemotron VL toggle    │
│  ├── Streaming Chat UI             ──► Live token-by-token response    │
│  ├── Read Aloud (Web Speech TTS)   ──► Built-in macOS system voice     │
│  └── Citation Inspector Drawer     ──► Interactive source highlights   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ REST / SSE (Bearer JWT)
┌───────────────────────────────────▼────────────────────────────────────┐
│                         FastAPI Backend Layer                          │
│  ├── JWT Authentication            ──► Isolated user document scopes   │
│  ├── Docling Extraction            ──► Layout-aware Markdown parser    │
│  ├── MarkdownTextSplitter          ──► Chunking preserving tables/tags │
│  ├── Dynamic Embedding Engine      ──► Nomic v1.5 / Nemotron VL (MPS)  │
│  ├── ChromaDB Vector Store         ──► Local vector database           │
│  └── Google LangExtract Engine     ──► Maps facts to exact text spans  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Local Inference
┌───────────────────────────────────▼────────────────────────────────────┐
│                 Local LLM Engine (Ollama / Apple Silicon)              │
│               Qwen-2.5-Coder-7B-Instruct (qwen2.5-coder:7b)             │
└────────────────────────────────────────────────────────────────────────┘
```
