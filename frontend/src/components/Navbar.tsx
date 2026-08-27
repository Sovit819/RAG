import React from "react";
import { useAuth } from "../context/AuthContext";
import { LogOut, Cpu, Zap } from "lucide-react";

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "1rem 2rem",
      backgroundColor: "#0f172a",
      color: "#f8fafc",
      borderBottom: "1px solid #1e293b"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <Zap style={{ color: "#38bdf8" }} size={24} />
        <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: "700" }}>Local RAG Pipeline</h1>
      </div>

      {user && (
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", color: "#94a3b8" }}>
            <Cpu size={16} />
            <span>{user.email}</span>
          </div>
          <button 
            onClick={logout} 
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              backgroundColor: "#ef4444",
              color: "#fff",
              border: "none",
              padding: "0.4rem 0.8rem",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: "600"
            }}
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      )}
    </header>
  );
};
