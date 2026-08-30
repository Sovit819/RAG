import React, { useEffect, useState, useCallback } from "react";
import { api } from "../api/client";
import { FileText, Trash2, Database, RefreshCw, Loader2, Eye } from "lucide-react";
import { DocumentPreviewModal } from "./DocumentPreviewModal";

export interface DocumentItem {
  doc_name: string;
  chunks_count: number;
}

interface DocumentListProps {
  refreshTrigger?: number;
}

export const DocumentList: React.FC<DocumentListProps> = ({ refreshTrigger }) => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null);
  const [previewDocName, setPreviewDocName] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/rag/documents");
      setDocuments(res.data.documents || []);
    } catch (err) {
      console.error("Failed to load user documents:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments, refreshTrigger]);

  const handleDelete = async (e: React.MouseEvent, docName: string) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${docName}" from your vector index?`)) return;
    setDeletingDoc(docName);
    try {
      await api.delete(`/rag/documents/${encodeURIComponent(docName)}`);
      setDocuments((prev) => prev.filter((d) => d.doc_name !== docName));
    } catch (err) {
      console.error("Failed to delete document:", err);
      alert("Failed to delete document from vector index.");
    } finally {
      setDeletingDoc(null);
    }
  };

  return (
    <>
      <div
        style={{
          backgroundColor: "#1e293b",
          padding: "1.2rem",
          borderRadius: "10px",
          border: "1px solid #334155",
          display: "flex",
          flexDirection: "column",
          gap: "0.8rem"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ margin: 0, color: "#f8fafc", fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Database size={16} style={{ color: "#38bdf8" }} /> Your Knowledge Base
            </h3>
            <span style={{ color: "#64748b", fontSize: "0.72rem", display: "block", marginTop: "0.2rem" }}>
              Persisted in your private account across logins & devices
            </span>
          </div>
          <button
            onClick={fetchDocuments}
            disabled={loading}
            title="Refresh document list"
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              display: "flex",
              alignItems: "center"
            }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#94a3b8", fontSize: "0.8rem", padding: "0.5rem 0" }}>
            <Loader2 className="animate-spin" size={16} /> Fetching account knowledge base...
          </div>
        ) : documents.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b", fontSize: "0.8rem", fontStyle: "italic" }}>
            No documents saved in your vector store yet.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "220px", overflowY: "auto" }}>
            {documents.map((doc) => (
              <div
                key={doc.doc_name}
                onClick={() => setPreviewDocName(doc.doc_name)}
                style={{
                  backgroundColor: "#0f172a",
                  padding: "0.6rem 0.8rem",
                  borderRadius: "6px",
                  border: "1px solid #334155",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  transition: "background 0.2s"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1e293b")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#0f172a")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0, flex: 1 }}>
                  <FileText size={16} style={{ color: "#0284c7", flexShrink: 0 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p
                      style={{
                        margin: 0,
                        color: "#e2e8f0",
                        fontSize: "0.8rem",
                        fontWeight: "500",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }}
                      title={`Click to preview "${doc.doc_name}"`}
                    >
                      {doc.doc_name}
                    </p>
                    <span style={{ color: "#64748b", fontSize: "0.7rem" }}>
                      {doc.chunks_count} vector {doc.chunks_count === 1 ? "chunk" : "chunks"}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <button
                    onClick={() => setPreviewDocName(doc.doc_name)}
                    title="Preview document"
                    style={{
                      background: "none",
                      border: "none",
                      color: "#38bdf8",
                      cursor: "pointer",
                      padding: "0.2rem",
                      display: "flex",
                      alignItems: "center"
                    }}
                  >
                    <Eye size={14} />
                  </button>

                  <button
                    onClick={(e) => handleDelete(e, doc.doc_name)}
                    disabled={deletingDoc === doc.doc_name}
                    title="Delete document permanently"
                    style={{
                      background: "none",
                      border: "none",
                      color: "#ef4444",
                      cursor: "pointer",
                      padding: "0.2rem",
                      display: "flex",
                      alignItems: "center"
                    }}
                  >
                    {deletingDoc === doc.doc_name ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <DocumentPreviewModal
        docName={previewDocName}
        onClose={() => setPreviewDocName(null)}
      />
    </>
  );
};
