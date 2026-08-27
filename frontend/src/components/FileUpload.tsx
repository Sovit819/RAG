import React, { useState } from "react";
import { api } from "../api/client";
import { UploadCloud, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface FileUploadProps {
  modelChoice: string;
  onUploadSuccess: () => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ modelChoice, onUploadSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setMessage({
      type: "info",
      text: "Parsing document with Docling & loading model weights (First time takes 30-60s to cache models)..."
    });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("model_choice", modelChoice);

    try {
      const res = await api.post("/rag/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setMessage({
        type: "success",
        text: `Successfully indexed "${res.data.filename}" (${res.data.chunks_count} chunks created)`
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
      border: "1px solid #334155"
    }}>
      <h3 style={{ margin: "0 0 0.8rem 0", color: "#f8fafc", fontSize: "1rem" }}>Ingest Document (Docling)</h3>
      
      <div style={{
        border: "2px dashed #475569",
        padding: "1.5rem",
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
          <UploadCloud size={32} style={{ color: "#38bdf8", marginBottom: "0.5rem" }} />
          <p style={{ margin: 0, color: "#cbd5e1", fontSize: "0.85rem" }}>
            {file ? file.name : "Click or drag PDF/DOCX/MD document here"}
          </p>
        </label>
      </div>

      {file && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          style={{
            width: "100%",
            marginTop: "0.8rem",
            backgroundColor: "#0284c7",
            color: "#fff",
            border: "none",
            padding: "0.6rem",
            borderRadius: "6px",
            fontWeight: "600",
            cursor: uploading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem"
          }}
        >
          {uploading ? (
            <>
              <Loader2 className="animate-spin" size={18} /> Processing...
            </>
          ) : (
            "Parse & Vectorize Document"
          )}
        </button>
      )}

      {message && (
        <div style={{
          marginTop: "0.8rem",
          padding: "0.6rem",
          borderRadius: "6px",
          backgroundColor:
            message.type === "success"
              ? "#064e3b"
              : message.type === "info"
              ? "#1e3a8a"
              : "#7f1d1d",
          color:
            message.type === "success"
              ? "#6ee7b7"
              : message.type === "info"
              ? "#93c5fd"
              : "#fca5a5",
          fontSize: "0.8rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem"
        }}>
          {message.type === "success" ? (
            <CheckCircle size={16} />
          ) : message.type === "info" ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          <span>{message.text}</span>
        </div>
      )}
    </div>
  );
};
