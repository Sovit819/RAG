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
    ext = os.path.splitext(file_path)[1].lower()
    page_data = []

    try:
        if ext == ".pdf":
            pdf = pdfium.PdfDocument(file_path)
            print(f"[PARSER] Rendering {len(pdf)} pages for Qwen2.5-VL from '{os.path.basename(file_path)}'...")
            for page_idx, page in enumerate(pdf, 1):
                image = page.render(scale=2.0).to_pil()
                buf = io.BytesIO()
                image.save(buf, format="JPEG", quality=90)
                img_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
                
                print(f"[PARSER] Transcribing page {page_idx}/{len(pdf)} with Qwen2.5-VL...")
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
        print(f"[PARSER] Qwen-VL exception: {e}")
        return None
    return None

def extract_docling_pages(doc: Any) -> List[Dict[str, Any]]:
    """
    Extracts page-by-page markdown from Docling document using element provenance.
    """
    page_texts: Dict[int, List[str]] = {}
    
    # Process text items
    if hasattr(doc, "texts"):
        for item in doc.texts:
            p_no = 1
            if hasattr(item, "prov") and item.prov:
                p_no = getattr(item.prov[0], "page_no", 1)
            if p_no not in page_texts:
                page_texts[p_no] = []
            page_texts[p_no].append(item.text if hasattr(item, "text") else str(item))

    # Process tables with markdown export
    if hasattr(doc, "tables"):
        for table in doc.tables:
            p_no = 1
            if hasattr(table, "prov") and table.prov:
                p_no = getattr(table.prov[0], "page_no", 1)
            if p_no not in page_texts:
                page_texts[p_no] = []
            try:
                tbl_md = table.export_to_markdown()
                page_texts[p_no].append(tbl_md)
            except Exception:
                pass

    if not page_texts:
        return []

    sorted_pages = []
    for p_no in sorted(page_texts.keys()):
        sorted_pages.append({
            "page_number": p_no,
            "text": "\n\n".join(page_texts[p_no])
        })
    return sorted_pages

def parse_document(file_path: str, parser_choice: str = "docling") -> Tuple[Optional[Any], str, str, Optional[List[Dict[str, Any]]]]:
    ext = os.path.splitext(file_path)[1].lower()
    
    if ext in [".txt", ".md"]:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        return None, content, "Plain Text", [{"page_number": 1, "text": content}]

    if parser_choice.lower() in ["qwen", "vision"]:
        print(f"[PARSER] Selected engine: Qwen2.5-VL Vision for '{os.path.basename(file_path)}'...")
        pages = parse_with_qwen_vl_pages(file_path)
        if pages:
            full_md = "\n\n---\n\n".join([p["text"] for p in pages])
            return None, full_md, "Qwen2.5-VL (Vision)", pages
        print("[PARSER] Qwen Vision fallback to Docling...")

    print(f"[PARSER] Selected engine: Docling TableFormer for '{os.path.basename(file_path)}'...")
    try:
        converter = get_converter()
        result = converter.convert(file_path)
        doc = result.document
        markdown_text = doc.export_to_markdown()
        doc_pages = extract_docling_pages(doc)
        return doc, markdown_text, "Docling TableFormer (OCR)", doc_pages if doc_pages else None
    except Exception as e:
        if ext in [".csv", ".json", ".xml", ".yaml", ".yml"]:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            return None, content, "Plain Text", [{"page_number": 1, "text": content}]
        raise RuntimeError(f"Failed to parse document '{os.path.basename(file_path)}': {str(e)}")
