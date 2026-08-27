import React from "react";
import { X, FileText, Bookmark } from "lucide-react";

export interface CitationMetadata {
  doc_name: string;
  chunk_index?: number;
  quote?: string;
  text?: string;
}

interface SourceInspectorDrawerProps {
  citation: CitationMetadata | null;
  onClose: () => void;
}

export const SourceInspectorDrawer: React.FC<SourceInspectorDrawerProps> = ({ citation, onClose }) => {
  if (!citation) return null;

  return (
    <div style={{
      position: "fixed",
      right: 0,
      top: 0,
      bottom: 0,
      width: "380px",
      backgroundColor: "#0f172a",
      borderLeft: "1px solid #334155",
      boxShadow: "-4px 0 20px rgba(0,0,0,0.5)",
      padding: "1.5rem",
      zIndex: 1000,
      color: "#f8fafc",
      display: "flex",
      flexDirection: "column"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Bookmark size={20} style={{ color: "#38bdf8" }} />
          <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Source Citation Grounding</h3>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}>
          <X size={20} />
        </button>
      </div>

      <div style={{ backgroundColor: "#1e293b", padding: "1rem", borderRadius: "8px", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#38bdf8", fontWeight: "600", fontSize: "0.9rem" }}>
          <FileText size={16} />
          <span>{citation.doc_name}</span>
        </div>
        {citation.chunk_index !== undefined && (
          <span style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.2rem", display: "block" }}>
            Chunk Index: #{citation.chunk_index}
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        <h4 style={{ color: "#cbd5e1", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Extracted Document Text</h4>
        <div style={{
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
      </div>
    </div>
  );
};
