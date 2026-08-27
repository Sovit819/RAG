# ⚡ Local Zero-Cost RAG Pipeline

A high-performance, flexible **Retrieval-Augmented Generation (RAG)** application running locally with cross-platform support (**Windows**, **macOS**, and **Linux**).

---

## 🌟 Key Features

- 🔒 **Private Local Processing**: Core RAG pipeline, document extraction, vector database, and LLM inference run locally on your machine.
- ⚙️ **Dual Embedding Options**:
  - **Nomic Embed (`nomic-ai/nomic-embed-text-v1.5`)**: 100% private, fully local embedding execution.
  - **NVIDIA Nemotron (`nvidia/Llama-3.2-NV-Embed-1B-v2`)**: Advanced embedding option (loads model weights via HuggingFace SentenceTransformers with `trust_remote_code`).
- 📄 **Multi-Format Document Extraction**: Parses PDF, DOCX, PPTX, XLSX, HTML, Images (OCR), CSV, EPUB, and Markdown using **Docling**.
- 🧩 **Modular 5-Step RAG Pipeline**: Cleanly separated workflow steps (`s1` through `s5`) for document parsing, splitting, embedding, vector searching, and response generation.
- ⚡ **Cross-Platform Hardware Acceleration**: Automatic device detection supporting **CUDA** (NVIDIA GPUs on Windows/Linux), **MPS** (Apple Silicon Metal on macOS), and **CPU** fallback.
- 🎙️ **Browser-Native Voice & Audio Interface (Frontend Only)**:
  - **Speech-to-Text (STT)**: Real-time voice query input processed entirely client-side using the browser's `Web Speech Recognition API`.
  - **Text-to-Speech (TTS)**: Audio read-aloud playback using the browser's native `SpeechSynthesis API` with zero backend or server overhead.
- ⚡ **Real-Time Streaming Responses**: Server-Sent Events (SSE) streaming answers token-by-token using **Qwen-2.5-Coder-7B**.

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 PRESENTATION LAYER                                     │
│                              React + TypeScript (Vite)                                 │
│                                                                                        │
│  ┌─────────────────────────────────┐   ┌────────────────────────┐   ┌───────────────┐  │
│  │ 🎙️ Voice Input (Web Speech STT)  │   │ 📄 Drag & Drop Upload  │   │⚙️ Embedding   │  │
│  │    [Client-side Browser Only]   │   │    (PDF, DOCX, MD...)  │   │   Selector    │  │
│  └────────────────┬────────────────┘   └───────────┬────────────┘   └───────┬───────┘  │
│                   │                                │                        │          │
│  ┌────────────────▼────────────────┐   ┌───────────▼────────────┐   ┌───────▼───────┐  │
│  │ 💬 Streaming Chat UI            │   │ 🔊 Read Aloud (TTS)    │   │ 🔍 Citation   │  │
│  │    (Live Token-by-Token)        │   │   [Client Browser Only]│   │    Inspector  │  │
│  └─────────────────────────────────┘   └────────────────────────┘   └───────────────┘  │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ REST API / SSE (Bearer JWT Auth)
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│                                   BACKEND APPLICATION                                  │
│                                   FastAPI (Python 3.11)                                │
│                                                                                        │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐  │
│   │                         🔄 Modular 5-Step RAG Pipeline                          │  │
│   │                                                                                 │  │
│   │  [s1_parser.py]       ──► Layout-Aware Docling Markdown Extraction (w/ OCR)  │  │
│   │        │                                                                        │  │
│   │  [s2_splitter.py]     ──► Header-Preserving Markdown Chunking                   │  │
│   │        │                                                                        │  │
│   │  [s3_embeddings.py]   ──► Dynamic Vector Encoding                              │  │
│   │        │                  ├─► Nomic v1.5 (100% Local Private)                   │  │
│   │        │                  └─► NVIDIA Nemotron (Llama-3.2-NV-Embed-1B-v2)       │  │
│   │        │                  [Hardware Accelerated: CUDA / MPS / CPU]              │  │
│   │  [s4_vectorstore.py]  ──► User-Isolated ChromaDB Vector Index & Search          │  │
│   │        │                                                                        │  │
│   │  [s5_generator.py]   ──► Streaming Prompt Construction & SSE Token Dispatch    │  │
│   └────────────────────────────────────────┬────────────────────────────────────────┘  │
└────────────────────────────────────────────┼───────────────────────────────────────────┘
                                             │ HTTP REST (Inference Request)
┌────────────────────────────────────────────▼───────────────────────────────────────────┐
│                                    LOCAL INFERENCE ENGINE                              │
│                                           Ollama                                       │
│                                                                                        │
│                   🤖 Qwen-2.5-Coder-7B-Instruct (qwen2.5-coder:7b)                      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Step-by-Step Setup & Installation

### 📋 Prerequisites

Before starting, ensure you have installed:
- **Python** (v3.10 or higher) — [Download Python](https://www.python.org/downloads/)
- **Node.js** (v18 or higher) & **npm** — [Download Node.js](https://nodejs.org/)
- **Ollama** — [Download Ollama](https://ollama.com/)

---

### Step 1: Clone the Repository

```bash
git clone https://github.com/Sovit819/RAG.git
cd RAG
```

---

### Step 2: Set Up Python Virtual Environment

Create and activate an isolated Python virtual environment based on your Operating System:

#### 🍏 macOS & 🐧 Linux

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate
```

#### 🪟 Windows (Command Prompt / PowerShell)

```powershell
# Create virtual environment
python -m venv venv

# Activate on PowerShell
.\venv\Scripts\Activate.ps1

# OR activate on Command Prompt (cmd)
.\venv\Scripts\activate.bat
```

> **Note:** Once activated, your terminal prompt will display `(venv)`.

---

### Step 3: Install Backend Dependencies

With your virtual environment active, run:

```bash
pip install --upgrade pip
pip install -r backend/requirements.txt
```

---

### Step 4: Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

---

### Step 5: Download & Start Ollama LLM Model

1. Ensure the Ollama service is running on your machine:
   ```bash
   ollama serve
   ```
2. Pull the **Qwen-2.5-Coder 7B** model:
   ```bash
   ollama pull qwen2.5-coder:7b
   ```

---

### Step 6: Run the Application

You can start the backend and frontend in separate terminal windows (ensure `venv` is active for backend):

#### Terminal 1: Backend Server (FastAPI)
From the project root folder:
```bash
# Using Python directly
python backend/app/main.py

# OR using npm runner
npm run backend
```
* Backend API runs at: **`http://localhost:8000`**  
* Interactive Swagger Docs: **`http://localhost:8000/docs`**

#### Terminal 2: Frontend Server (React + Vite)
From the project root folder:
```bash
npm run dev
```
* Open **`http://localhost:5173`** in your web browser.

---

## 📁 Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI main entrypoint & CORS setup
│   │   ├── auth.py                # JWT authentication & password hashing
│   │   ├── database.py            # SQLite database initialization
│   │   ├── models.py              # User & Document ORM schemas
│   │   ├── rag/                   # 🔄 Modular RAG Step Pipeline
│   │   │   ├── s1_parser.py       # Step 1: Docling document conversion to Markdown
│   │   │   ├── s2_splitter.py     # Step 2: Header-aware text chunking
│   │   │   ├── s3_embeddings.py   # Step 3: Vector embeddings (Nomic / NVIDIA Nemotron)
│   │   │   ├── s4_vectorstore.py  # Step 4: ChromaDB vector storage & similarity search
│   │   │   └── s5_generator.py   # Step 5: Streaming LLM response generation
│   │   └── routers/               # API Router endpoints
│   │       ├── auth_router.py     # User registration & JWT login
│   │       └── rag_router.py      # Document upload & RAG query streaming
│   └── requirements.txt           # Python backend dependencies
├── frontend/
│   ├── src/                       # React frontend source code
│   │   ├── components/            # Chat, Upload, Navbar, Citation Drawer
│   │   ├── context/               # Auth Context provider
│   │   ├── hooks/                 # STT and TTS Web Speech hooks (Client-side)
│   │   └── api/                   # Axios API client
│   ├── package.json               # Frontend dependencies & scripts
│   └── vite.config.ts             # Vite configuration
├── README.md                      # Project documentation
└── package.json                   # Root scripts runner
```

---

## ⚡ RAG Pipeline Workflow

| Step | File | Module Function | Description |
| :--- | :--- | :--- | :--- |
| **1** | [s1_parser.py](backend/app/rag/s1_parser.py) | `parse_document_to_markdown()` | Converts documents (PDF, Images, Office docs) to clean Markdown using Docling OCR. |
| **2** | [s2_splitter.py](backend/app/rag/s2_splitter.py) | `split_markdown_document()` | Splits Markdown into chunks while preserving table and header structures. |
| **3** | [s3_embeddings.py](backend/app/rag/s3_embeddings.py) | `embed_texts()` | Computes dense vector embeddings (Nomic local / NVIDIA Nemotron option) with CUDA/MPS/CPU acceleration. |
| **4** | [s4_vectorstore.py](backend/app/rag/s4_vectorstore.py) | `store_chunks()`, `query_user_chunks()` | Manages user-isolated vector collections in local ChromaDB storage. |
| **5** | [s5_generator.py](backend/app/rag/s5_generator.py) | `generate_rag_stream()` | Streams LLM response tokens via Server-Sent Events (SSE). |

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
