import React, { useState } from "react";
import { api } from "../api/client";
import { UploadCloud, CheckCircle, AlertCircle, Loader2, Zap, Eye } from "lucide-react";

interface FileUploadProps {
  onUploadSuccess: () => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUploadSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [parserChoice, setParserChoice] = useState<"docling" | "qwen">("docling");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setMessage({
      type: "info",
      text: parserChoice === "docling" 
        ? "Ingesting document with Docling TableFormer + Apple Vision OCR (~10s)..."
        : "Transcribing document page-by-page using Qwen2.5-VL Vision (~45s per page)..."
    });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("parser_choice", parserChoice);

    try {
      const res = await api.post("/rag/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setMessage({
        type: "success",
        text: `Successfully indexed "${res.data.filename}" (${res.data.chunks_count} chunks via ${res.data.parser_engine || "Vision"})`
      });
      setFile(null);
      onUploadSuccess();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.detail || "Document upload failed"
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{
      backgroundColor: "#1e293b",
      padding: "1.2rem",
      borderRadius: "10px",
      border: "1px solid #334155",
      textAlign: "left"
    }}>
      <h3 style={{ margin: "0 0 0.8rem 0", color: "#f8fafc", fontSize: "1rem" }}>Ingest Document</h3>
      
      {/* Parser Engine Selection Toggle */}
      <div style={{ marginBottom: "0.9rem" }}>
        <label style={{ color: "#94a3b8", fontSize: "0.75rem", fontWeight: "600", marginBottom: "0.4rem", display: "block" }}>
          PARSER ENGINE
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem", backgroundColor: "#0f172a", padding: "0.25rem", borderRadius: "8px", border: "1px solid #334155" }}>
          <button
            type="button"
            onClick={() => setParserChoice("docling")}
            style={{
              padding: "0.4rem 0.6rem",
              borderRadius: "6px",
              border: "none",
              backgroundColor: parserChoice === "docling" ? "#0284c7" : "transparent",
              color: parserChoice === "docling" ? "#fff" : "#94a3b8",
              cursor: "pointer",
              fontSize: "0.78rem",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.3rem",
              transition: "all 0.2s"
            }}
          >
            <Zap size={13} /> Docling (~10s)
          </button>

          <button
            type="button"
            onClick={() => setParserChoice("qwen")}
            style={{
              padding: "0.4rem 0.6rem",
              borderRadius: "6px",
              border: "none",
              backgroundColor: parserChoice === "qwen" ? "#0284c7" : "transparent",
              color: parserChoice === "qwen" ? "#fff" : "#94a3b8",
              cursor: "pointer",
              fontSize: "0.78rem",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.3rem",
              transition: "all 0.2s"
            }}
          >
            <Eye size={13} /> Qwen-VL (Vision)
          </button>
        </div>
      </div>

      {/* Upload Drop Zone */}
      <div style={{
        border: "2px dashed #475569",
        padding: "1.2rem",
        borderRadius: "8px",
        textAlign: "center",
        backgroundColor: "#0f172a",
        cursor: "pointer"
      }}>
        <input 
          type="file" 
          id="file-input"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={{ display: "none" }}
        />
        <label htmlFor="file-input" style={{ cursor: "pointer", display: "block" }}>
          <UploadCloud size={28} style={{ color: "#38bdf8", marginBottom: "0.4rem" }} />
          <p style={{ margin: 0, color: "#cbd5e1", fontSize: "0.82rem" }}>
            {file ? file.name : "Click or drag PDF/DOCX/MD here"}
          </p>
        </label>
      </div>

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        style={{
          width: "100%",
          marginTop: "0.9rem",
          padding: "0.6rem",
          backgroundColor: !file || uploading ? "#334155" : "#0284c7",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          fontWeight: "600",
          fontSize: "0.85rem",
          cursor: !file || uploading ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.4rem"
        }}
      >
        {uploading ? <Loader2 className="animate-spin" size={16} /> : null}
        {uploading ? "Ingesting..." : "Upload & Index"}
      </button>

      {message && (
        <div style={{
          marginTop: "0.8rem",
          padding: "0.6rem",
          borderRadius: "6px",
          fontSize: "0.75rem",
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          backgroundColor: message.type === "success" ? "rgba(16, 185, 129, 0.15)" : message.type === "error" ? "rgba(239, 68, 68, 0.15)" : "rgba(2, 132, 199, 0.15)",
          color: message.type === "success" ? "#34d399" : message.type === "error" ? "#f87171" : "#38bdf8",
          border: message.type === "success" ? "1px solid rgba(16, 185, 129, 0.3)" : message.type === "error" ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid rgba(2, 132, 199, 0.3)"
        }}>
          {message.type === "success" && <CheckCircle size={14} />}
          {message.type === "error" && <AlertCircle size={14} />}
          {message.type === "info" && <Loader2 className="animate-spin" size={14} />}
          <span>{message.text}</span>
        </div>
      )}
    </div>
  );
};
