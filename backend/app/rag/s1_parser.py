from docling.document_converter import DocumentConverter, PdfFormatOption, ImageFormatOption
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions, RapidOcrOptions

_converter = None

def get_converter() -> DocumentConverter:
    global _converter
    if _converter is None:
        # Enable OCR for visual/raster formats (PDFs and Images)
        pipeline_options = PdfPipelineOptions()
        pipeline_options.do_ocr = True
        pipeline_options.ocr_options = RapidOcrOptions()

        # Docling automatically supports ALL document formats (DOCX, PPTX, XLSX, HTML, Markdown, CSV, EPUB, ODT, etc.)
        # out of the box using default format options. We only pass custom format options here for PDF and Image formats
        # to enable OCR layout pipeline options.
        _converter = DocumentConverter(
            format_options={
                InputFormat.IMAGE: ImageFormatOption(pipeline_options=pipeline_options),
                InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
            }
        )
    return _converter

def parse_document_to_markdown(file_path: str) -> str:
    """Parses any supported document (PDF, DOCX, PPTX, XLSX, HTML, Images, MD, CSV, EPUB, etc.) using Docling and returns clean Markdown."""
    converter = get_converter()
    result = converter.convert(file_path)
    markdown_text = result.document.export_to_markdown()
    return markdown_text

