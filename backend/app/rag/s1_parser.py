import os
from docling.document_converter import DocumentConverter, PdfFormatOption, ImageFormatOption
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions

_converter = None

def get_converter() -> DocumentConverter:
    global _converter
    if _converter is None:
        # Use Docling's native PDF text & TableFormer layout parser for accurate table structures
        pipeline_options = PdfPipelineOptions()
        pipeline_options.do_ocr = False
        pipeline_options.do_table_structure = True

        _converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
            }
        )
    return _converter

def parse_document_to_markdown(file_path: str) -> str:
    """
    Parses any supported document (PDF, DOCX, PPTX, XLSX, HTML, Images, MD, CSV, EPUB, etc.) 
    using Docling's TableFormer parser, falling back to direct UTF-8 read for plain text files.
    """
    ext = os.path.splitext(file_path)[1].lower()
    
    # Direct fast-path read for plain text and markdown files
    if ext in [".txt", ".md"]:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
        except Exception:
            pass

    try:
        converter = get_converter()
        result = converter.convert(file_path)
        markdown_text = result.document.export_to_markdown()
        return markdown_text
    except Exception:
        # Fallback UTF-8 text read if converter encounters unexpected format
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
