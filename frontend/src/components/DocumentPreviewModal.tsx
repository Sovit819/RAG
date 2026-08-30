import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../api/client";
import { X, FileText, Layers, Loader2, BookOpen, Download, Code, Eye } from "lucide-react";

interface ChunkItem {
  chunk_index: number;
  breadcrumb?: string;
  text: string;
}

interface PreviewData {
  doc_name: string;
  chunks_count: number;
  chunks: ChunkItem[];
  has_raw_file?: boolean;
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
  const [activeTab, setActiveTab] = useState<"raw" | "content" | "chunks">("raw");
  const [viewMode, setViewMode] = useState<"rendered" | "source">("rendered");

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
    if (data?.has_raw_file && docName && activeTab === "raw" && !fileUrl) {
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
  }, [data, docName, activeTab, fileUrl]);

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
        backgroundColor: "rgba(3, 7, 18, 0.85)",
        backdropFilter: "blur(6px)",
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
        }
        .markdown-preview th, .markdown-preview td {
          border: 1px solid #334155;
          padding: 0.6rem 0.9rem;
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
      `}</style>

      <div
        style={{
          backgroundColor: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: "12px",
          width: "100%",
          maxWidth: "960px",
          height: "88vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
          textAlign: "left"
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "1.2rem 1.5rem",
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
              <h2 style={{ margin: 0, color: "#f8fafc", fontSize: "1.1rem", textAlign: "left" }}>{docName}</h2>
              <span style={{ color: "#94a3b8", fontSize: "0.75rem", textAlign: "left", display: "block" }}>
                {data ? `${data.chunks_count} Vector Chunks Indexed` : "Document Preview"}
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
                {downloading ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <Download size={14} />
                )}
                Download Original File
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

        {/* Tab Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e293b", backgroundColor: "#0f172a", padding: "0 1.5rem" }}>
          <div style={{ display: "flex" }}>
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
              <BookOpen size={16} /> Docling Markdown Extraction
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
          </div>

          {activeTab === "content" && (
            <div style={{ display: "flex", backgroundColor: "#1e293b", borderRadius: "6px", padding: "0.2rem", border: "1px solid #334155" }}>
              <button
                onClick={() => setViewMode("rendered")}
                style={{
                  backgroundColor: viewMode === "rendered" ? "#0284c7" : "transparent",
                  color: viewMode === "rendered" ? "#fff" : "#94a3b8",
                  border: "none",
                  borderRadius: "4px",
                  padding: "0.3rem 0.6rem",
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem"
                }}
              >
                <Eye size={12} /> Rendered
              </button>
              <button
                onClick={() => setViewMode("source")}
                style={{
                  backgroundColor: viewMode === "source" ? "#0284c7" : "transparent",
                  color: viewMode === "source" ? "#fff" : "#94a3b8",
                  border: "none",
                  borderRadius: "4px",
                  padding: "0.3rem 0.6rem",
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

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem", textAlign: "left" }}>
          {loading ? (
            <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#94a3b8", gap: "0.6rem" }}>
              <Loader2 className="animate-spin" size={24} /> Loading document preview...
            </div>
          ) : !data ? (
            <p style={{ color: "#64748b", fontStyle: "italic", textAlign: "left" }}>No document data available.</p>
          ) : activeTab === "raw" ? (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: "1rem", textAlign: "left" }}>
              {data.has_raw_file ? (
                <div style={{ height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#1e293b", borderRadius: "8px", border: "1px solid #334155", overflow: "hidden" }}>
                  <div style={{ padding: "0.8rem 1rem", backgroundColor: "#0f172a", borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#cbd5e1", fontSize: "0.85rem", fontWeight: "600" }}>Raw File View ({docName})</span>
                    <button
                      onClick={handleDownload}
                      disabled={downloading}
                      style={{ background: "none", border: "none", color: "#38bdf8", cursor: "pointer", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.3rem" }}
                    >
                      <Download size={14} /> Download File
                    </button>
                  </div>

                  {fileLoading ? (
                    <div style={{ display: "flex", height: "350px", alignItems: "center", justifyContent: "center", color: "#94a3b8", gap: "0.5rem" }}>
                      <Loader2 className="animate-spin" size={20} /> Loading raw file view...
                    </div>
                  ) : fileUrl ? (
                    isPdf ? (
                      <iframe
                        src={fileUrl}
                        style={{ width: "100%", height: "550px", border: "none" }}
                        title="PDF Raw View"
                      />
                    ) : isImage ? (
                      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "1.5rem", height: "100%" }}>
                        <img src={fileUrl} alt={docName} style={{ maxWidth: "100%", maxHeight: "500px", borderRadius: "6px", objectFit: "contain" }} />
                      </div>
                    ) : (
                      <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
                        <FileText size={48} style={{ color: "#0284c7", marginBottom: "1rem" }} />
                        <p style={{ fontSize: "0.95rem", color: "#e2e8f0" }}>
                          Original document <strong>"{docName}"</strong> is securely saved in your account.
                        </p>
                        <button
                          onClick={handleDownload}
                          disabled={downloading}
                          style={{
                            marginTop: "0.8rem",
                            backgroundColor: "#0284c7",
                            color: "#fff",
                            border: "none",
                            padding: "0.6rem 1.2rem",
                            borderRadius: "6px",
                            fontWeight: "600",
                            cursor: "pointer"
                          }}
                        >
                          Download Raw File ({docName})
                        </button>
                      </div>
                    )
                  ) : (
                    <div style={{ padding: "2rem", textAlign: "center", color: "#ef4444" }}>
                      Failed to load file view. Click Download to retrieve file.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: "2.5rem", textAlign: "center", backgroundColor: "#1e293b", borderRadius: "8px", border: "1px solid #334155", color: "#94a3b8" }}>
                  <p style={{ margin: 0, fontSize: "0.9rem" }}>
                    This document was uploaded before raw file saving was enabled. Please re-upload the document to view the original file preview. You can view the extracted text in the <strong>Docling Markdown Extraction</strong> tab.
                  </p>
                </div>
              )}
            </div>
          ) : activeTab === "content" ? (
            viewMode === "rendered" ? (
              <div className="markdown-preview" style={{ color: "#e2e8f0", lineHeight: "1.7", fontSize: "0.9rem", textAlign: "left" }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{fullText}</ReactMarkdown>
              </div>
            ) : (
              <pre
                style={{
                  margin: 0,
                  color: "#38bdf8",
                  backgroundColor: "#0b1329",
                  padding: "1.2rem",
                  borderRadius: "8px",
                  border: "1px solid #1e293b",
                  fontSize: "0.85rem",
                  fontFamily: "'Fira Code', monospace",
                  lineHeight: "1.6",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  textAlign: "left"
                }}
              >
                {fullText}
              </pre>
            )
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", textAlign: "left" }}>
              {data.chunks.map((chunk) => (
                <div
                  key={chunk.chunk_index}
                  style={{
                    backgroundColor: "#1e293b",
                    padding: "1.2rem",
                    borderRadius: "8px",
                    border: "1px solid #334155",
                    textAlign: "left"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem", color: "#38bdf8", fontSize: "0.75rem", fontWeight: "600" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ backgroundColor: "#0f172a", padding: "0.2rem 0.6rem", borderRadius: "4px", border: "1px solid #334155" }}>
                        Vector Chunk #{chunk.chunk_index + 1}
                      </span>
                      {chunk.breadcrumb && (
                        <span style={{ backgroundColor: "#0284c7", color: "#fff", padding: "0.2rem 0.6rem", borderRadius: "4px", fontSize: "0.7rem", fontWeight: "600" }}>
                          {chunk.breadcrumb}
                        </span>
                      )}
                    </div>
                    <span style={{ color: "#94a3b8" }}>{chunk.text.length} Characters</span>
                  </div>
                  <div className="markdown-preview" style={{ color: "#cbd5e1", fontSize: "0.85rem", lineHeight: "1.6", textAlign: "left" }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{chunk.text}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
