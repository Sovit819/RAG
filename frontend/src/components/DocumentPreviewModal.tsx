import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../api/client";
import { X, FileText, Layers, Loader2, BookOpen, Download, Code, Eye, Columns, Bookmark, Sparkles, Cpu } from "lucide-react";

interface ChunkItem {
  chunk_index: number;
  breadcrumb?: string;
  text: string;
  parser_engine?: string;
}

interface PreviewData {
  doc_name: string;
  chunks_count: number;
  chunks: ChunkItem[];
  has_raw_file?: boolean;
  parser_engine?: string;
}

interface DocumentPreviewModalProps {
  docName: string | null;
  onClose: () => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({ docName, onClose }) => {
  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"split" | "raw" | "content" | "chunks">("split");
  const [viewMode, setViewMode] = useState<"rendered" | "source">("rendered");
  const [selectedChunkIndex, setSelectedChunkIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!docName) {
      setData(null);
      setFileUrl(null);
      return;
    }

    const fetchPreview = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/rag/documents/${encodeURIComponent(docName)}/preview`);
        setData(res.data);
      } catch (err) {
        console.error("Failed to load document preview:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [docName]);

  useEffect(() => {
    if (docName && !fileUrl) {
      setFileLoading(true);
      api
        .get(`/rag/documents/${encodeURIComponent(docName)}/file`, { responseType: "blob" })
        .then((res) => {
          const url = URL.createObjectURL(res.data);
          setFileUrl(url);
        })
        .catch((err) => console.error("Error loading file blob:", err))
        .finally(() => setFileLoading(false));
    }
  }, [docName, fileUrl]);

  useEffect(() => {
    return () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [fileUrl]);

  if (!docName) return null;

  const fullText = data?.chunks.map((c) => c.text).join("\n\n---\n\n") || "";
  const ext = docName.toLowerCase().slice(docName.lastIndexOf("."));
  const isPdf = ext === ".pdf";
  const isImage = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].includes(ext);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await api.get(`/rag/documents/${encodeURIComponent(docName)}/file`, {
        responseType: "blob"
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", docName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download file:", err);
      alert("Failed to download raw document file.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(3, 7, 18, 0.88)",
        backdropFilter: "blur(8px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        textAlign: "left"
      }}
    >
      <style>{`
        .markdown-preview table {
          border-collapse: collapse;
          width: 100%;
          margin: 1rem 0;
          background-color: #0b1329;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #334155;
          font-size: 0.85rem;
        }
        .markdown-preview th, .markdown-preview td {
          border: 1px solid #334155;
          padding: 0.5rem 0.8rem;
          text-align: left;
        }
        .markdown-preview th {
          background-color: #1e293b;
          color: #38bdf8;
          font-weight: 600;
        }
        .markdown-preview tr:nth-child(even) {
          background-color: rgba(255, 255, 255, 0.02);
        }
        .markdown-preview a {
          color: #38bdf8;
          text-decoration: underline;
        }
      `}</style>

      <div
        style={{
          backgroundColor: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: "14px",
          width: "100%",
          maxWidth: "1400px",
          height: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6)",
          overflow: "hidden",
          textAlign: "left"
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderBottom: "1px solid #1e293b",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#1e293b"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <FileText size={22} style={{ color: "#38bdf8" }} />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <h2 style={{ margin: 0, color: "#f8fafc", fontSize: "1.1rem", textAlign: "left" }}>{docName}</h2>
                {data?.parser_engine && (
                  <span style={{
                    backgroundColor: data.parser_engine.includes("Qwen") ? "rgba(16, 185, 129, 0.2)" : "rgba(2, 132, 199, 0.2)",
                    border: data.parser_engine.includes("Qwen") ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(56, 189, 248, 0.4)",
                    color: data.parser_engine.includes("Qwen") ? "#34d399" : "#38bdf8",
                    padding: "0.15rem 0.5rem",
                    borderRadius: "999px",
                    fontSize: "0.72rem",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.3rem"
                  }}>
                    {data.parser_engine.includes("Qwen") ? <Sparkles size={11} /> : <Cpu size={11} />}
                    {data.parser_engine}
                  </span>
                )}
              </div>
              <span style={{ color: "#94a3b8", fontSize: "0.75rem", textAlign: "left", display: "block", marginTop: "0.2rem" }}>
                {data ? `${data.chunks_count} Vector Chunks Grounded & Stored` : "Document Preview"}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            {data?.has_raw_file && (
              <button
                onClick={handleDownload}
                disabled={downloading}
                style={{
                  backgroundColor: "#0284c7",
                  color: "#fff",
                  border: "none",
                  padding: "0.45rem 0.9rem",
                  borderRadius: "6px",
                  fontSize: "0.8rem",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem"
                }}
              >
                {downloading ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                Download File
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                padding: "0.4rem",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center"
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tab Navigation Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e293b", backgroundColor: "#0f172a", padding: "0 1.5rem" }}>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => setActiveTab("split")}
              style={{
                padding: "0.8rem 1rem",
                background: "none",
                border: "none",
                borderBottom: activeTab === "split" ? "2px solid #0284c7" : "2px solid transparent",
                color: activeTab === "split" ? "#38bdf8" : "#94a3b8",
                fontWeight: "600",
                fontSize: "0.85rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem"
              }}
            >
              <Columns size={16} /> 🔀 Side-by-Side Visual Split (LangExtract)
            </button>

            <button
              onClick={() => setActiveTab("chunks")}
              style={{
                padding: "0.8rem 1rem",
                background: "none",
                border: "none",
                borderBottom: activeTab === "chunks" ? "2px solid #0284c7" : "2px solid transparent",
                color: activeTab === "chunks" ? "#38bdf8" : "#94a3b8",
                fontWeight: "600",
                fontSize: "0.85rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem"
              }}
            >
              <Layers size={16} /> Vector Chunks ({data?.chunks_count || 0})
            </button>

            <button
              onClick={() => setActiveTab("content")}
              style={{
                padding: "0.8rem 1rem",
                background: "none",
                border: "none",
                borderBottom: activeTab === "content" ? "2px solid #0284c7" : "2px solid transparent",
                color: activeTab === "content" ? "#38bdf8" : "#94a3b8",
                fontWeight: "600",
                fontSize: "0.85rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem"
              }}
            >
              <BookOpen size={16} /> Markdown Document
            </button>

            <button
              onClick={() => setActiveTab("raw")}
              style={{
                padding: "0.8rem 1rem",
                background: "none",
                border: "none",
                borderBottom: activeTab === "raw" ? "2px solid #0284c7" : "2px solid transparent",
                color: activeTab === "raw" ? "#38bdf8" : "#94a3b8",
                fontWeight: "600",
                fontSize: "0.85rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem"
              }}
            >
              <FileText size={16} /> Original Document
            </button>
          </div>

          {(activeTab === "content" || activeTab === "split") && (
            <div style={{ display: "flex", backgroundColor: "#1e293b", borderRadius: "6px", padding: "0.2rem", border: "1px solid #334155" }}>
              <button
                onClick={() => setViewMode("rendered")}
                style={{
                  backgroundColor: viewMode === "rendered" ? "#0284c7" : "transparent",
                  color: viewMode === "rendered" ? "#fff" : "#94a3b8",
                  border: "none",
                  borderRadius: "4px",
                  padding: "0.25rem 0.6rem",
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem"
                }}
              >
                <Eye size={12} /> Rendered Table
              </button>
              <button
                onClick={() => setViewMode("source")}
                style={{
                  backgroundColor: viewMode === "source" ? "#0284c7" : "transparent",
                  color: viewMode === "source" ? "#fff" : "#94a3b8",
                  border: "none",
                  borderRadius: "4px",
                  padding: "0.25rem 0.6rem",
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem"
                }}
              >
                <Code size={12} /> Raw Markdown
              </button>
            </div>
          )}
        </div>

        {/* Modal Main Content Body */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", backgroundColor: "#0b1329" }}>
          {loading ? (
            <div style={{ margin: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.8rem", color: "#94a3b8" }}>
              <Loader2 className="animate-spin" size={32} style={{ color: "#38bdf8" }} />
              <span>Loading structured document inspection...</span>
            </div>
          ) : activeTab === "split" ? (
            /* Side-by-Side Dual-Pane Visual View (LangExtract) */
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", width: "100%", height: "100%", overflow: "hidden" }}>
              {/* Left Pane: Original Document View */}
              <div style={{ borderRight: "1px solid #1e293b", height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#020617" }}>
                <div style={{ padding: "0.6rem 1rem", backgroundColor: "#0f172a", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <FileText size={16} style={{ color: "#38bdf8" }} />
                  <span style={{ color: "#cbd5e1", fontSize: "0.8rem", fontWeight: "600" }}>Original Document Page</span>
                </div>
                <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
                  {fileLoading ? (
                    <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
                      <Loader2 className="animate-spin" size={24} style={{ color: "#38bdf8" }} />
                    </div>
                  ) : fileUrl ? (
                    isPdf ? (
                      <iframe src={fileUrl} style={{ width: "100%", height: "100%", border: "none" }} title="Original PDF" />
                    ) : isImage ? (
                      <div style={{ overflow: "auto", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
                        <img src={fileUrl} alt="Document" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "8px" }} />
                      </div>
                    ) : (
                      <div style={{ padding: "1.5rem", color: "#cbd5e1", overflowY: "auto", height: "100%", fontSize: "0.85rem", whiteSpace: "pre-wrap" }}>
                        {fullText}
                      </div>
                    )
                  ) : (
                    <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                      No raw file preview available
                    </div>
                  )}
                </div>
              </div>

              {/* Right Pane: Extracted Structured Markdown & Chunks */}
              <div style={{ height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#0b1329" }}>
                <div style={{ padding: "0.6rem 1rem", backgroundColor: "#0f172a", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Layers size={16} style={{ color: "#38bdf8" }} />
                    <span style={{ color: "#cbd5e1", fontSize: "0.8rem", fontWeight: "600" }}>Parsed Tables & Vector Chunks</span>
                  </div>
                  <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>{data?.chunks.length || 0} Chunks</span>
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: "1.2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {data?.chunks && data.chunks.length > 0 ? (
                    data.chunks.map((c) => (
                      <div
                        key={c.chunk_index}
                        onClick={() => setSelectedChunkIndex(c.chunk_index)}
                        style={{
                          backgroundColor: selectedChunkIndex === c.chunk_index ? "#1e293b" : "#0f172a",
                          border: selectedChunkIndex === c.chunk_index ? "1px solid #38bdf8" : "1px solid #1e293b",
                          borderRadius: "10px",
                          padding: "1rem",
                          transition: "all 0.2s"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
                          <span style={{ backgroundColor: "#0284c7", color: "#fff", padding: "0.2rem 0.5rem", borderRadius: "4px", fontSize: "0.7rem", fontWeight: "600" }}>
                            Vector Chunk #{c.chunk_index + 1}
                          </span>
                          {c.breadcrumb && (
                            <span style={{ color: "#94a3b8", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                              <Bookmark size={12} style={{ color: "#38bdf8" }} /> {c.breadcrumb}
                            </span>
                          )}
                        </div>

                        <div className="markdown-preview" style={{ color: "#e2e8f0", fontSize: "0.85rem", lineHeight: "1.6" }}>
                          {viewMode === "rendered" ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{c.text}</ReactMarkdown>
                          ) : (
                            <pre style={{ backgroundColor: "#020617", padding: "0.8rem", borderRadius: "6px", overflowX: "auto", fontSize: "0.8rem", color: "#cbd5e1" }}>
                              {c.text}
                            </pre>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: "#64748b", margin: "auto" }}>No chunks available</div>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === "chunks" ? (
            /* Chunks View */
            <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              {data?.chunks.map((c) => (
                <div key={c.chunk_index} style={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "10px", padding: "1.2rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.8rem" }}>
                    <span style={{ backgroundColor: "#0284c7", color: "#fff", padding: "0.2rem 0.5rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "600" }}>
                      Vector Chunk #{c.chunk_index + 1}
                    </span>
                    {c.breadcrumb && <span style={{ color: "#38bdf8", fontSize: "0.75rem" }}>📌 {c.breadcrumb}</span>}
                  </div>
                  <div className="markdown-preview" style={{ color: "#e2e8f0", fontSize: "0.85rem" }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{c.text}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          ) : activeTab === "content" ? (
            /* Markdown Full View */
            <div style={{ flex: 1, overflowY: "auto", padding: "2rem" }}>
              <div className="markdown-preview" style={{ color: "#e2e8f0", maxWidth: "900px", margin: "0 auto" }}>
                {viewMode === "rendered" ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{fullText}</ReactMarkdown>
                ) : (
                  <pre style={{ backgroundColor: "#020617", padding: "1.5rem", borderRadius: "8px", overflowX: "auto", color: "#cbd5e1", fontSize: "0.85rem" }}>
                    {fullText}
                  </pre>
                )}
              </div>
            </div>
          ) : (
            /* Raw File Full View */
            <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
              {fileUrl ? (
                isPdf ? (
                  <iframe src={fileUrl} style={{ width: "100%", height: "100%", border: "none" }} title="Original File" />
                ) : isImage ? (
                  <div style={{ overflow: "auto", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
                    <img src={fileUrl} alt="Original File" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                  </div>
                ) : (
                  <div style={{ padding: "2rem", color: "#cbd5e1", overflowY: "auto", height: "100%", whiteSpace: "pre-wrap" }}>
                    {fullText}
                  </div>
                )
              ) : (
                <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                  File loading...
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
