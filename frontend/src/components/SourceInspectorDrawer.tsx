import React, { useState, useEffect } from "react";
import { X, FileText, Bookmark, Eye, Layers, Loader2, ExternalLink } from "lucide-react";
import { api } from "../api/client";

export interface CitationMetadata {
  doc_name: string;
  chunk_index?: number;
  page_number?: number;
  breadcrumb?: string;
  quote?: string;
  text?: string;
}

interface SourceInspectorDrawerProps {
  citation: CitationMetadata | null;
  onClose: () => void;
}

export const SourceInspectorDrawer: React.FC<SourceInspectorDrawerProps> = ({ citation, onClose }) => {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"document" | "extracted">("document");

  useEffect(() => {
    if (!citation?.doc_name) {
      setFileUrl(null);
      return;
    }

    setFileLoading(true);
    api
      .get(`/rag/documents/${encodeURIComponent(citation.doc_name)}/file`, { responseType: "blob" })
      .then((res) => {
        const url = URL.createObjectURL(res.data);
        setFileUrl(url);
      })
      .catch((err) => {
        console.error("Error loading citation file blob:", err);
      })
      .finally(() => setFileLoading(false));

    return () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [citation?.doc_name]);

  if (!citation) return null;

  const pageNum = citation.page_number || 1;
  const isPdf = citation.doc_name.toLowerCase().endsWith(".pdf");
  const isImage = [".png", ".jpg", ".jpeg", ".webp"].some(ext => citation.doc_name.toLowerCase().endsWith(ext));
  const pdfPageUrl = fileUrl ? `${fileUrl}#page=${pageNum}&view=FitH` : null;

  return (
    <div style={{
      position: "fixed",
      right: 0,
      top: 0,
      bottom: 0,
      width: "560px",
      backgroundColor: "#0f172a",
      borderLeft: "1px solid #334155",
      boxShadow: "-10px 0 30px rgba(0,0,0,0.6)",
      padding: "1.5rem",
      zIndex: 1000,
      color: "#f8fafc",
      display: "flex",
      flexDirection: "column",
      textAlign: "left"
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Bookmark size={20} style={{ color: "#38bdf8" }} />
          <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Real Document Grounding</h3>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}>
          <X size={20} />
        </button>
      </div>

      {/* Document & Page Badge */}
      <div style={{ backgroundColor: "#1e293b", padding: "0.9rem", borderRadius: "8px", marginBottom: "1rem", border: "1px solid #334155" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#38bdf8", fontWeight: "600", fontSize: "0.9rem" }}>
            <FileText size={16} />
            <span style={{ maxWidth: "320px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {citation.doc_name}
            </span>
          </div>
          <span style={{ backgroundColor: "#0284c7", color: "#fff", padding: "0.15rem 0.5rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "600" }}>
            Page {pageNum}
          </span>
        </div>
        {citation.breadcrumb && (
          <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.4rem" }}>
            📌 {citation.breadcrumb}
          </div>
        )}
      </div>

      {/* View Switcher Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", borderBottom: "1px solid #1e293b", paddingBottom: "0.5rem" }}>
        <button
          onClick={() => setActiveTab("document")}
          style={{
            background: activeTab === "document" ? "rgba(56, 189, 248, 0.15)" : "transparent",
            border: activeTab === "document" ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid transparent",
            color: activeTab === "document" ? "#38bdf8" : "#94a3b8",
            padding: "0.35rem 0.8rem",
            borderRadius: "6px",
            fontSize: "0.8rem",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem"
          }}
        >
          <Eye size={14} /> Real Original Page (Page {pageNum})
        </button>

        <button
          onClick={() => setActiveTab("extracted")}
          style={{
            background: activeTab === "extracted" ? "rgba(56, 189, 248, 0.15)" : "transparent",
            border: activeTab === "extracted" ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid transparent",
            color: activeTab === "extracted" ? "#38bdf8" : "#94a3b8",
            padding: "0.35rem 0.8rem",
            borderRadius: "6px",
            fontSize: "0.8rem",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem"
          }}
        >
          <Layers size={14} /> Vectorized Text
        </button>
      </div>

      {/* Tab Body */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {activeTab === "document" ? (
          <div style={{ flex: 1, backgroundColor: "#020617", borderRadius: "8px", overflow: "hidden", border: "1px solid #1e293b", position: "relative" }}>
            {fileLoading ? (
              <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#94a3b8", gap: "0.5rem" }}>
                <Loader2 className="animate-spin" size={20} style={{ color: "#38bdf8" }} />
                <span>Loading original document...</span>
              </div>
            ) : pdfPageUrl ? (
              isPdf ? (
                <iframe src={pdfPageUrl} style={{ width: "100%", height: "100%", border: "none" }} title={`Original Page ${pageNum}`} />
              ) : isImage ? (
                <div style={{ overflow: "auto", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
                  <img src={fileUrl!} alt="Document Page" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                </div>
              ) : (
                <div style={{ padding: "1rem", color: "#cbd5e1", overflowY: "auto", height: "100%", fontSize: "0.85rem", whiteSpace: "pre-wrap" }}>
                  {citation.text || "Plain text view"}
                </div>
              )
            ) : (
              <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                Document preview unavailable
              </div>
            )}
          </div>
        ) : (
          <div style={{
            flex: 1,
            overflowY: "auto",
            backgroundColor: "#1e293b",
            padding: "1rem",
            borderRadius: "8px",
            borderLeft: "4px solid #38bdf8",
            color: "#e2e8f0",
            fontSize: "0.85rem",
            lineHeight: "1.6",
            whiteSpace: "pre-wrap"
          }}>
            {citation.text || citation.quote || "No raw text available"}
          </div>
        )}
      </div>
    </div>
  );
};
