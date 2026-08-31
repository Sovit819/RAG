import React, { useState, useEffect } from "react";
import { X, FileText, Bookmark, Eye, Layers, Loader2, Sparkles, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";
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
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageImageUrl, setPageImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [activeTab, setActiveTab] = useState<"visual" | "text">("visual");
  const [zoom, setZoom] = useState(100);

  // Sync current page with citation whenever citation changes
  useEffect(() => {
    if (citation?.page_number) {
      setCurrentPage(citation.page_number);
    } else {
      setCurrentPage(1);
    }
  }, [citation]);

  useEffect(() => {
    if (!citation?.doc_name) {
      setPageImageUrl(null);
      return;
    }

    setLoadingImage(true);
    api
      .get(`/rag/documents/${encodeURIComponent(citation.doc_name)}/pages/${currentPage}/image`, {
        responseType: "blob"
      })
      .then((res) => {
        const url = URL.createObjectURL(res.data);
        setPageImageUrl(url);
      })
      .catch((err) => {
        console.error("Error loading page image:", err);
      })
      .finally(() => setLoadingImage(false));

    return () => {
      if (pageImageUrl) {
        URL.revokeObjectURL(pageImageUrl);
      }
    };
  }, [citation?.doc_name, currentPage]);

  if (!citation) return null;

  const isCitedPage = citation.page_number === currentPage;

  return (
    <div style={{
      position: "fixed",
      right: 0,
      top: 0,
      bottom: 0,
      width: "620px",
      backgroundColor: "#0f172a",
      borderLeft: "1px solid #334155",
      boxShadow: "-12px 0 35px rgba(0,0,0,0.65)",
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
          <Sparkles size={20} style={{ color: "#38bdf8" }} />
          <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Visual Document Inspector</h3>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}>
          <X size={20} />
        </button>
      </div>

      {/* Document & Citation Banner */}
      <div style={{ backgroundColor: "#1e293b", padding: "0.9rem 1.1rem", borderRadius: "8px", marginBottom: "1rem", border: "1px solid #334155" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#38bdf8", fontWeight: "600", fontSize: "0.9rem" }}>
            <FileText size={16} />
            <span style={{ maxWidth: "340px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {citation.doc_name}
            </span>
          </div>

          {/* Page Navigator in Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", backgroundColor: "#0f172a", padding: "0.2rem 0.5rem", borderRadius: "6px", border: "1px solid #334155" }}>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage <= 1}
              style={{ background: "none", border: "none", color: currentPage <= 1 ? "#475569" : "#38bdf8", cursor: currentPage <= 1 ? "not-allowed" : "pointer", padding: "0.1rem" }}
              title="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: "0.78rem", fontWeight: "600", color: isCitedPage ? "#38bdf8" : "#f8fafc" }}>
              Page {currentPage} {isCitedPage ? "(Cited)" : ""}
            </span>
            <button
              onClick={() => setCurrentPage(prev => prev + 1)}
              style={{ background: "none", border: "none", color: "#38bdf8", cursor: "pointer", padding: "0.1rem" }}
              title="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {citation.breadcrumb && isCitedPage && (
          <div style={{ fontSize: "0.78rem", color: "#cbd5e1", marginTop: "0.5rem", fontWeight: "500", display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <Bookmark size={13} style={{ color: "#38bdf8" }} /> Section: {citation.breadcrumb}
          </div>
        )}
      </div>

      {/* Tabs & Zoom Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem", borderBottom: "1px solid #1e293b", paddingBottom: "0.5rem" }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => setActiveTab("visual")}
            style={{
              background: activeTab === "visual" ? "rgba(56, 189, 248, 0.15)" : "transparent",
              border: activeTab === "visual" ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid transparent",
              color: activeTab === "visual" ? "#38bdf8" : "#94a3b8",
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
            <Eye size={14} /> Real Document Page
          </button>

          <button
            onClick={() => setActiveTab("text")}
            style={{
              background: activeTab === "text" ? "rgba(56, 189, 248, 0.15)" : "transparent",
              border: activeTab === "text" ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid transparent",
              color: activeTab === "text" ? "#38bdf8" : "#94a3b8",
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

        {activeTab === "visual" && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <button
              onClick={() => setZoom(prev => Math.max(60, prev - 15))}
              style={{ background: "#1e293b", border: "1px solid #334155", color: "#cbd5e1", borderRadius: "4px", padding: "0.2rem 0.4rem", cursor: "pointer" }}
              title="Zoom out"
            >
              <ZoomOut size={13} />
            </button>
            <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{zoom}%</span>
            <button
              onClick={() => setZoom(prev => Math.min(180, prev + 15))}
              style={{ background: "#1e293b", border: "1px solid #334155", color: "#cbd5e1", borderRadius: "4px", padding: "0.2rem 0.4rem", cursor: "pointer" }}
              title="Zoom in"
            >
              <ZoomIn size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Main Grounding Content Body */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {activeTab === "visual" ? (
          <div style={{
            flex: 1,
            backgroundColor: "#020617",
            borderRadius: "8px",
            overflow: "auto",
            border: "1px solid #1e293b",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "1rem",
            position: "relative"
          }}>
            {loadingImage ? (
              <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#94a3b8", gap: "0.5rem" }}>
                <Loader2 className="animate-spin" size={24} style={{ color: "#38bdf8" }} />
                <span>Loading Page {currentPage}...</span>
              </div>
            ) : pageImageUrl ? (
              <div style={{ width: `${zoom}%`, transition: "width 0.2s", position: "relative", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}>
                {/* Visual Highlight Banner on top of Real Document Image */}
                {isCitedPage && (
                  <div style={{
                    position: "sticky",
                    top: "0.5rem",
                    zIndex: 10,
                    backgroundColor: "rgba(2, 132, 199, 0.92)",
                    backdropFilter: "blur(4px)",
                    color: "#fff",
                    padding: "0.4rem 0.8rem",
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "0.6rem",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.4)"
                  }}>
                    <span>📍 Grounded Answer Cited from Page {currentPage}</span>
                    {citation.breadcrumb && <span style={{ opacity: 0.9 }}>{citation.breadcrumb}</span>}
                  </div>
                )}

                {/* Real High-Res Document Page Image */}
                <img
                  src={pageImageUrl}
                  alt={`Document Page ${currentPage}`}
                  style={{
                    width: "100%",
                    height: "auto",
                    borderRadius: "6px",
                    display: "block",
                    border: isCitedPage ? "2px solid #38bdf8" : "1px solid #334155"
                  }}
                />
              </div>
            ) : (
              <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                Page rendering unavailable
              </div>
            )}
          </div>
        ) : (
          <div style={{
            flex: 1,
            overflowY: "auto",
            backgroundColor: "#020617",
            padding: "1.2rem",
            borderRadius: "8px",
            border: "1px solid #1e293b"
          }}>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600", marginBottom: "0.6rem" }}>
              Extracted Vector Chunk Text:
            </div>
            <pre style={{
              backgroundColor: "#0f172a",
              padding: "1rem",
              borderRadius: "6px",
              borderLeft: "4px solid #38bdf8",
              color: "#e2e8f0",
              fontSize: "0.82rem",
              lineHeight: "1.6",
              whiteSpace: "pre-wrap",
              fontFamily: "monospace"
            }}>
              {citation.text || citation.quote || "No text available"}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
