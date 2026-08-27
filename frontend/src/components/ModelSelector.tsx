import React from "react";
import { Zap, Eye } from "lucide-react";

interface ModelSelectorProps {
  modelChoice: "nomic" | "nemotron";
  setModelChoice: (choice: "nomic" | "nemotron") => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ modelChoice, setModelChoice }) => {
  return (
    <div style={{
      display: "flex",
      gap: "0.5rem",
      backgroundColor: "#1e293b",
      padding: "0.3rem",
      borderRadius: "8px",
      border: "1px solid #334155"
    }}>
      <button
        onClick={() => setModelChoice("nomic")}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.4rem",
          padding: "0.4rem 0.8rem",
          borderRadius: "6px",
          border: "none",
          backgroundColor: modelChoice === "nomic" ? "#0284c7" : "transparent",
          color: modelChoice === "nomic" ? "#fff" : "#94a3b8",
          cursor: "pointer",
          fontSize: "0.8rem",
          fontWeight: "600",
          transition: "all 0.2s"
        }}
      >
        <Zap size={14} />
        Nomic v1.5 (Fast)
      </button>

      <button
        onClick={() => setModelChoice("nemotron")}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.4rem",
          padding: "0.4rem 0.8rem",
          borderRadius: "6px",
          border: "none",
          backgroundColor: modelChoice === "nemotron" ? "#0284c7" : "transparent",
          color: modelChoice === "nemotron" ? "#fff" : "#94a3b8",
          cursor: "pointer",
          fontSize: "0.8rem",
          fontWeight: "600",
          transition: "all 0.2s"
        }}
      >
        <Eye size={14} />
        Nemotron VL (Multimodal)
      </button>
    </div>
  );
};
