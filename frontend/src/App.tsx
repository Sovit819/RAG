import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Navbar } from "./components/Navbar";
import { ModelSelector } from "./components/ModelSelector";
import { FileUpload } from "./components/FileUpload";
import { ChatWindow } from "./components/ChatWindow";
import { SourceInspectorDrawer } from "./components/SourceInspectorDrawer";
import type { CitationMetadata } from "./components/SourceInspectorDrawer";
import { DocumentList } from "./components/DocumentList";

const MainDashboard: React.FC = () => {
  const [modelChoice, setModelChoice] = useState<"nomic" | "nemotron">("nomic");
  const [selectedCitation, setSelectedCitation] = useState<CitationMetadata | null>(null);
  const [docRefreshTrigger, setDocRefreshTrigger] = useState(0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", backgroundColor: "#090d16" }}>
      <Navbar />

      <main style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "340px 1fr",
        gap: "1rem",
        padding: "1rem",
        height: "calc(100vh - 65px)",
        overflow: "hidden"
      }}>
        {/* Left Control Sidebar - Fixed height, independently scrollable if needed */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", overflowY: "auto", height: "100%" }}>
          <div>
            <label style={{ color: "#94a3b8", fontSize: "0.8rem", fontWeight: "600", marginBottom: "0.4rem", display: "block" }}>
              EMBEDDING MODEL SELECTOR
            </label>
            <ModelSelector modelChoice={modelChoice} setModelChoice={setModelChoice} />
          </div>

          <FileUpload 
            modelChoice={modelChoice} 
            onUploadSuccess={() => setDocRefreshTrigger((prev) => prev + 1)} 
          />

          <DocumentList refreshTrigger={docRefreshTrigger} />
        </div>

        {/* Right Streaming Chat Window - Locked height */}
        <div style={{ height: "100%", overflow: "hidden" }}>
          <ChatWindow 
            modelChoice={modelChoice} 
          />
        </div>
      </main>

      <SourceInspectorDrawer 
        citation={selectedCitation} 
        onClose={() => setSelectedCitation(null)} 
      />
    </div>
  );
};

const AuthScreen: React.FC = () => {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (isRegister) {
        await register(email, password);
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Authentication failed");
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", backgroundColor: "#090d16", color: "#fff" }}>
      <form 
        onSubmit={handleSubmit}
        style={{
          backgroundColor: "#0f172a",
          padding: "2.5rem",
          borderRadius: "12px",
          border: "1px solid #1e293b",
          width: "100%",
          maxWidth: "380px"
        }}
      >
        <h2 style={{ margin: "0 0 0.5rem 0", fontSize: "1.5rem" }}>{isRegister ? "Create Account" : "Welcome Back"}</h2>
        <p style={{ margin: "0 0 1.5rem 0", color: "#94a3b8", fontSize: "0.85rem" }}>
          Local Zero-Cost RAG Pipeline
        </p>

        {error && (
          <div style={{ backgroundColor: "#7f1d1d", color: "#fca5a5", padding: "0.6rem", borderRadius: "6px", fontSize: "0.8rem", marginBottom: "1rem" }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", color: "#cbd5e1", fontSize: "0.8rem", marginBottom: "0.4rem" }}>Email Address</label>
          <input 
            type="email" 
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", backgroundColor: "#1e293b", border: "1px solid #334155", color: "#fff", outline: "none" }}
          />
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", color: "#cbd5e1", fontSize: "0.8rem", marginBottom: "0.4rem" }}>Password</label>
          <input 
            type="password" 
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", backgroundColor: "#1e293b", border: "1px solid #334155", color: "#fff", outline: "none" }}
          />
        </div>

        <button 
          type="submit"
          style={{ width: "100%", padding: "0.7rem", borderRadius: "6px", backgroundColor: "#0284c7", color: "#fff", border: "none", fontWeight: "600", cursor: "pointer", fontSize: "0.9rem" }}
        >
          {isRegister ? "Register Account" : "Sign In"}
        </button>

        <p style={{ marginTop: "1.2rem", textAlign: "center", fontSize: "0.8rem", color: "#94a3b8" }}>
          {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
          <button 
            type="button" 
            onClick={() => setIsRegister(!isRegister)}
            style={{ background: "none", border: "none", color: "#38bdf8", cursor: "pointer", fontWeight: "600" }}
          >
            {isRegister ? "Sign In" : "Register"}
          </button>
        </p>
      </form>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div style={{ backgroundColor: "#090d16", height: "100vh" }} />;
  return user ? <MainDashboard /> : <AuthScreen />;
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
