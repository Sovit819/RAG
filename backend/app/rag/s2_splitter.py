import html
import re
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter

def _extract_table_header(text: str) -> str:
    """Extracts valid multi-line Markdown table headers leading up to the separator line (|---|---|)."""
    lines = [line.strip() for line in text.splitlines() if line.strip().startswith('|')]
    if len(lines) < 2:
        return ""
    
    sep_idx = -1
    for i, line in enumerate(lines):
        if "---" in line:
            sep_idx = i
            break
            
    if sep_idx > 0:
        header_lines = lines[:sep_idx + 1]
        combined_text = "".join(header_lines).replace("|", "").replace("-", "").strip()
        if len(combined_text) > 0:
            return "\n".join(header_lines)
            
    return ""

def split_markdown_document(
    markdown_text: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 150
) -> list[dict]:
    """
    Splits Markdown text using a two-pass context-preserving approach:
    1. Pass 1 (Header Awareness): Extracts section hierarchy (#, ##, ###) and attaches header metadata.
    2. Pass 2 (Size Control & Table Preservation):
       - Unescapes HTML entities (&amp; -> &).
       - Cleans broken table separator lines (--| -> '').
       - Preserves table column headers for split table chunks.
       - Attaches structural breadcrumbs as chunk metadata instead of polluting text body.
    Returns: list[dict] where each item is {"text": str, "breadcrumb": str}
    """
    if not markdown_text or not markdown_text.strip():
        return []

    # Unescape HTML entities (&amp; -> &, &lt; -> <) and clean malformed table delimiter lines
    cleaned_text = html.unescape(markdown_text)
    cleaned_text = re.sub(r'^\s*--+\|\s*$', '', cleaned_text, flags=re.MULTILINE)

    headers_to_split_on = [
        ("#", "Header 1"),
        ("##", "Header 2"),
        ("###", "Header 3"),
    ]

    header_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=headers_to_split_on,
        strip_headers=False
    )

    # Pass 1: Structural header splitting
    header_docs = header_splitter.split_text(cleaned_text)

    # Pass 2: Secondary character splitter for sections exceeding chunk_size
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", " ", ""]
    )

    final_chunks: list[dict] = []

    for doc in header_docs:
        # Build breadcrumb trail from header metadata
        header_path_parts = []
        for _, header_name in headers_to_split_on:
            if header_name in doc.metadata:
                header_path_parts.append(doc.metadata[header_name])

        breadcrumb = " > ".join(header_path_parts) if header_path_parts else ""
        content = doc.page_content.strip()

        if not content:
            continue

        # Extract table header if section contains a markdown table
        table_header = _extract_table_header(content)

        # If section content fits within target chunk_size, keep as single chunk
        if len(content) <= chunk_size:
            final_chunks.append({
                "text": content,
                "breadcrumb": breadcrumb
            })
        else:
            # Sub-split oversized section
            sub_chunks = text_splitter.split_text(content)
            for sub in sub_chunks:
                sub_text = sub.strip()
                if not sub_text:
                    continue

                # If sub-chunk contains table rows but lacks table header separator, prepend table header
                if table_header and sub_text.startswith("|") and ("---" not in sub_text):
                    sub_text = f"{table_header}\n{sub_text}"

                final_chunks.append({
                    "text": sub_text,
                    "breadcrumb": breadcrumb
                })

    return final_chunks
