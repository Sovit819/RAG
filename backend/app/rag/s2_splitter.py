from typing import List
from langchain_text_splitters import MarkdownTextSplitter

def split_markdown_document(markdown_text: str, chunk_size: int = 1000, chunk_overlap: int = 150) -> List[str]:
    """Splits Markdown text along header hierarchies and block boundaries."""
    splitter = MarkdownTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap
    )
    return splitter.split_text(markdown_text)
