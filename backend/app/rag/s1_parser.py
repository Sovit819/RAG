import os
import io
import base64
import requests
from typing import Tuple, Optional, Any, List, Dict
import pypdfium2 as pdfium

from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import (
    PdfPipelineOptions, 
    TableFormerMode, 
    LayoutObjectDetectionOptions
)
try:
    from docling.datamodel.pipeline_options import OcrMacOptions
    _HAS_OCRMAC = True
except ImportError:
    _HAS_OCRMAC = False

OLLAMA_URL = "http://localhost:11434/api/generate"
VISION_MODEL = "qwen2.5vl:7b"

_converter = None

def get_converter() -> DocumentConverter:
    global _converter
    if _converter is None:
        pipeline_options = PdfPipelineOptions()
        pipeline_options.do_ocr = True
        
        if _HAS_OCRMAC:
            try:
                pipeline_options.ocr_options = OcrMacOptions()
            except Exception:
                pass
                
        pipeline_options.do_table_structure = True
        pipeline_options.table_structure_options.mode = TableFormerMode.ACCURATE
        pipeline_options.layout_options = LayoutObjectDetectionOptions(keep_empty_clusters=True)

        _converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
            }
        )
    return _converter

def parse_with_qwen_vl_pages(file_path: str) -> Optional[List[Dict[str, Any]]]:
    """
    Parses PDF or Images page-by-page using Qwen2.5-VL Vision, returning page-tagged markdown.
    """
    ext = os.path.splitext(file_path)[1].lower()
    page_data = []

    try:
        if ext == ".pdf":
            pdf = pdfium.PdfDocument(file_path)
            print(f"[PARSER] Rendering {len(pdf)} pages for Qwen2.5-VL Vision from '{os.path.basename(file_path)}'...")
            for page_idx, page in enumerate(pdf, 1):
                image = page.render(scale=2.0).to_pil()
                buf = io.BytesIO()
                image.save(buf, format="JPEG", quality=90)
                img_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
                
                print(f"[PARSER] Transcribing page {page_idx}/{len(pdf)} with Qwen2.5-VL Vision...")
                vision_prompt = (
                    f"Transcribe Page {page_idx} of this document into clean, structured GitHub Flavored Markdown (GFM).\n"
                    "Rules:\n"
                    "1. Convert all tables into clean Markdown tables with standard header separators (|---|---|).\n"
                    "2. Preserve all bullet indicators (●, •), contact information, URLs, phone numbers, and degree indicators.\n"
                    "3. Do not omit any row or column.\n"
                    "Output only the Markdown text."
                )
                payload = {
                    "model": VISION_MODEL,
                    "prompt": vision_prompt,
                    "images": [img_b64],
                    "stream": False,
                    "options": {"temperature": 0.1, "num_ctx": 4096}
                }
                res = requests.post(OLLAMA_URL, json=payload, timeout=120)
                if res.status_code == 200:
                    text = res.json().get("response", "").strip()
                    page_data.append({"page_number": page_idx, "text": text})
                else:
                    return None
        elif ext in [".png", ".jpg", ".jpeg", ".webp"]:
            with open(file_path, "rb") as f:
                img_b64 = base64.b64encode(f.read()).decode("utf-8")
            payload = {
                "model": VISION_MODEL,
                "prompt": "Transcribe this document image into clean GitHub Flavored Markdown tables and text.",
                "images": [img_b64],
                "stream": False,
                "options": {"temperature": 0.1, "num_ctx": 4096}
            }
            res = requests.post(OLLAMA_URL, json=payload, timeout=60)
            if res.status_code == 200:
                text = res.json().get("response", "").strip()
                page_data.append({"page_number": 1, "text": text})
        
        if page_data:
            return page_data
    except Exception as e:
        print(f"[PARSER] Qwen-VL Vision exception: {e}")
        return None
    return None

def parse_document(file_path: str, parser_choice: str = "docling") -> Tuple[Optional[Any], str, str, Optional[List[Dict[str, Any]]]]:
    """
    Dual-engine parser returning (docling_doc, full_markdown_text, engine_name, page_items)
    """
    ext = os.path.splitext(file_path)[1].lower()
    
    # 1. Plain text fast path
    if ext in [".txt", ".md"]:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        return None, content, "Plain Text", [{"page_number": 1, "text": content}]

    # 2. Qwen2.5-VL Vision selection
    if parser_choice.lower() in ["qwen", "vision"]:
        print(f"[PARSER] Selected engine: Qwen2.5-VL Vision for '{os.path.basename(file_path)}'...")
        pages = parse_with_qwen_vl_pages(file_path)
        if pages:
            full_md = "\n\n---\n\n".join([p["text"] for p in pages])
            return None, full_md, "Qwen2.5-VL (Vision)", pages
        print("[PARSER] Qwen Vision fallback to Docling...")

    # 3. Docling TableFormer engine (Default)
    print(f"[PARSER] Selected engine: Docling TableFormer for '{os.path.basename(file_path)}'...")
    try:
        converter = get_converter()
        result = converter.convert(file_path)
        doc = result.document
        markdown_text = doc.export_to_markdown()
        return doc, markdown_text, "Docling TableFormer (OCR)", None
    except Exception as e:
        if ext in [".csv", ".json", ".xml", ".yaml", ".yml"]:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            return None, content, "Plain Text", [{"page_number": 1, "text": content}]
        raise RuntimeError(f"Failed to parse document '{os.path.basename(file_path)}': {str(e)}")

def parse_document_to_markdown(file_path: str) -> str:
    _, md_text, _, _ = parse_document(file_path)
    return md_text
