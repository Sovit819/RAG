import html
import re
from typing import Optional, List, Dict, Any
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter

def clean_and_format_markdown_tables(md_text: str) -> str:
    if not md_text:
        return ""
    lines = md_text.splitlines()
    cleaned = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.strip().startswith("|") and set(line.strip().replace("|", "").replace("-", "").strip()).issubset(set()) and "---" in line:
            if i > 0 and lines[i-1].strip().startswith("|"):
                cols = len(lines[i-1].strip().split("|")) - 2
                if cols > 0:
                    cleaned.append("|" + "---|" * cols)
                    i += 1
                    continue
        cleaned.append(line)
        i += 1
    return "\n".join(cleaned)

def split_markdown_table_atomically(
    table_text: str,
    max_chars_per_chunk: int = 1200
) -> List[str]:
    lines = [l.rstrip() for l in table_text.strip().splitlines() if l.strip()]
    if len(lines) < 2:
        return [table_text]

    header_idx = -1
    sep_idx = -1
    for idx, l in enumerate(lines):
        if "---" in l and l.strip().startswith("|"):
            sep_idx = idx
            header_idx = idx - 1
            break

    if header_idx < 0 or sep_idx < 0:
        return [table_text]

    header_lines = lines[:sep_idx + 1]
    header_block = "\n".join(header_lines)
    data_rows = lines[sep_idx + 1:]

    if not data_rows:
        return [table_text]

    table_chunks = []
    current_rows = []
    current_len = len(header_block)

    for row in data_rows:
        row_len = len(row) + 1
        if current_rows and (current_len + row_len > max_chars_per_chunk):
            chunk_content = header_block + "\n" + "\n".join(current_rows)
            table_chunks.append(chunk_content)
            current_rows = [row]
            current_len = len(header_block) + row_len
        else:
            current_rows.append(row)
            current_len += row_len

    if current_rows:
        chunk_content = header_block + "\n" + "\n".join(current_rows)
        table_chunks.append(chunk_content)

    return table_chunks

def split_document(
    doc: Optional[Any] = None,
    markdown_text: str = "",
    page_items: Optional[List[Dict[str, Any]]] = None,
    chunk_size: int = 1000,
    chunk_overlap: int = 150
) -> List[Dict[str, Any]]:
    if page_items:
        all_chunks: List[Dict[str, Any]] = []
        for p in page_items:
            p_num = p.get("page_number", 1)
            p_text = p.get("text", "")
            sub_chunks = split_markdown_document(p_text, chunk_size=chunk_size, chunk_overlap=chunk_overlap, default_page=p_num)
            for c in sub_chunks:
                c["page_number"] = p_num
            all_chunks.extend(sub_chunks)
        if all_chunks:
            return all_chunks

    if doc is not None:
        try:
            markdown_text = doc.export_to_markdown()
        except Exception:
            pass

    return split_markdown_document(
        markdown_text=markdown_text,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        default_page=1
    )

def split_markdown_document(
    markdown_text: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 150,
    default_page: int = 1
) -> List[Dict[str, Any]]:
    if not markdown_text or not markdown_text.strip():
        return []

    cleaned_text = html.unescape(markdown_text).strip()
    cleaned_text = clean_and_format_markdown_tables(cleaned_text)

    headers_to_split_on = [
        ("#", "Header 1"),
        ("##", "Header 2"),
        ("###", "Header 3"),
        ("####", "Header 4"),
    ]

    header_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=headers_to_split_on,
        strip_headers=False
    )

    header_docs = header_splitter.split_text(cleaned_text)

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", " "]
    )

    final_chunks: List[Dict[str, Any]] = []

    for doc in header_docs:
        header_path_parts = []
        for _, header_name in headers_to_split_on:
            if header_name in doc.metadata:
                header_path_parts.append(doc.metadata[header_name])

        breadcrumb = " > ".join(header_path_parts) if header_path_parts else ""
        content = doc.page_content.strip()

        if not content:
            continue

        page_hint = default_page
        page_match = re.search(r'<!--\s*(?:page|Page)\s*:\s*(\d+)\s*-->', content)
        if page_match:
            try:
                page_hint = int(page_match.group(1))
            except Exception:
                pass

        if "\n|" in content and "---" in content:
            table_lines = []
            non_table_lines = []
            in_table = False

            for line in content.splitlines():
                if line.strip().startswith("|"):
                    in_table = True
                    table_lines.append(line)
                else:
                    if in_table:
                        if table_lines:
                            for tbl_chunk in split_markdown_table_atomically("\n".join(table_lines), max_chars_per_chunk=chunk_size):
                                ctx_text = f"[{breadcrumb}]\n{tbl_chunk}" if breadcrumb else tbl_chunk
                                final_chunks.append({
                                    "text": tbl_chunk,
                                    "context_text": ctx_text,
                                    "breadcrumb": breadcrumb,
                                    "page_number": page_hint
                                })
                            table_lines = []
                        in_table = False
                    non_table_lines.append(line)

            if table_lines:
                for tbl_chunk in split_markdown_table_atomically("\n".join(table_lines), max_chars_per_chunk=chunk_size):
                    ctx_text = f"[{breadcrumb}]\n{tbl_chunk}" if breadcrumb else tbl_chunk
                    final_chunks.append({
                        "text": tbl_chunk,
                        "context_text": ctx_text,
                        "breadcrumb": breadcrumb,
                        "page_number": page_hint
                    })

            meaningful_non_table = [l for l in non_table_lines if l.strip() and not l.strip().startswith("#")]
            non_tbl_content = "\n".join(meaningful_non_table).strip()
            if non_tbl_content:
                if len(non_tbl_content) <= chunk_size:
                    ctx_text = f"[{breadcrumb}]\n{non_tbl_content}" if breadcrumb else non_tbl_content
                    final_chunks.append({
                        "text": non_tbl_content,
                        "context_text": ctx_text,
                        "breadcrumb": breadcrumb,
                        "page_number": page_hint
                    })
                else:
                    for sub in text_splitter.split_text(non_tbl_content):
                        sub_text = sub.strip()
                        if sub_text:
                            ctx_text = f"[{breadcrumb}]\n{sub_text}" if breadcrumb else sub_text
                            final_chunks.append({
                                "text": sub_text,
                                "context_text": ctx_text,
                                "breadcrumb": breadcrumb,
                                "page_number": page_hint
                            })
        else:
            if len(content) <= chunk_size:
                ctx_text = f"[{breadcrumb}]\n{content}" if breadcrumb else content
                final_chunks.append({
                    "text": content,
                    "context_text": ctx_text,
                    "breadcrumb": breadcrumb,
                    "page_number": page_hint
                })
            else:
                sub_chunks = text_splitter.split_text(content)
                for sub in sub_chunks:
                    sub_text = sub.strip()
                    if not sub_text:
                        continue
                    ctx_text = f"[{breadcrumb}]\n{sub_text}" if breadcrumb else sub_text
                    final_chunks.append({
                        "text": sub_text,
                        "context_text": ctx_text,
                        "breadcrumb": breadcrumb,
                        "page_number": page_hint
                    })

    return final_chunks
