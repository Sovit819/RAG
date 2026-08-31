import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Mic, MicOff, Volume2, Send, Bot, User as UserIcon, Loader2, Sparkles, FileText, ChevronRight } from "lucide-react";
import { useSpeechToText } from "../hooks/useSpeechToText";
import { useTextToSpeech } from "../hooks/useTextToSpeech";
import type { CitationMetadata } from "./SourceInspectorDrawer";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  sources?: Array<CitationMetadata & { similarity?: number; breadcrumb?: string }>;
}

interface ChatWindowProps {
  modelChoice?: string;
  onSelectCitation?: (citation: CitationMetadata) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ onSelectCitation }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isSpeaking, speak, stop } = useTextToSpeech();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streaming]);

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || streaming) return;

    const userMsg: Message = { id: Date.now().toString(), sender: "user", text: textToSend };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);

    const token = localStorage.getItem("access_token");

    try {
      const response = await fetch(`${BASE_URL}/rag/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt: textToSend
        })
      });

      if (!response.body) throw new Error("No response body");

      const assistantMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        sender: "assistant", 
        text: "",
        sources: []
      };
      setMessages((prev) => [...prev, assistantMsg]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunkStr = decoder.decode(value);
        const lines = chunkStr.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const parsed = JSON.parse(line.replace("data: ", ""));
              
              // Handle incoming retrieved sources metadata
              if (parsed.type === "sources" && Array.isArray(parsed.sources)) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  if (updated[lastIdx].sender === "assistant") {
                    updated[lastIdx] = {
                      ...updated[lastIdx],
                      sources: parsed.sources
                    };
                  }
                  return updated;
                });
              } else if (parsed.token) {
                // Handle token streaming
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  if (updated[lastIdx].sender === "assistant") {
                    updated[lastIdx] = {
                      ...updated[lastIdx],
                      text: updated[lastIdx].text + parsed.token
                    };
                  }
                  return updated;
                });
              }
            } catch (e) {
              // Ignore partial parse
            }
          }
        }
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), sender: "assistant", text: "⚠️ Error generating response. Please verify backend connection." }
      ]);
    } finally {
      setStreaming(false);
    }
  };

  const { isListening, startListening, stopListening } = useSpeechToText((finalText) => {
    setInput(finalText);
    handleSend(finalText);
  });

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      maxHeight: "100%",
      backgroundColor: "#0b1329",
      borderRadius: "16px",
      border: "1px solid #1e293b",
      boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
      overflow: "hidden"
    }}>
      {/* Messages Area - Strict Inner Scroll */}
      <div style={{
        flex: 1,
        minHeight: 0,
        height: 0,
        overflowY: "auto",
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.2rem",
        scrollBehavior: "smooth"
      }}>
        {messages.length === 0 ? (
          <div style={{
            margin: "auto",
            textAlign: "center",
            color: "#64748b",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.8rem"
          }}>
            <div style={{
              width: "64px",
              height: "64px",
              borderRadius: "20px",
              backgroundColor: "rgba(2, 132, 199, 0.15)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <Sparkles size={32} style={{ color: "#38bdf8" }} />
            </div>
            <h3 style={{ color: "#f8fafc", margin: 0, fontSize: "1.1rem", fontWeight: "600" }}>Ready for Questions</h3>
            <p style={{ margin: 0, fontSize: "0.85rem", maxWidth: "320px", lineHeight: "1.5" }}>
              Upload your documents on the left, then ask questions using <strong>Text</strong> or <strong>Voice</strong>.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: "flex",
                gap: "0.8rem",
                alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%",
                alignItems: "flex-start"
              }}
            >
              {msg.sender === "assistant" && (
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}>
                  <Bot size={20} color="#fff" />
                </div>
              )}

              <div style={{
                backgroundColor: msg.sender === "user" ? "#0284c7" : "#1e293b",
                backgroundImage: msg.sender === "user" 
                  ? "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)"
                  : "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
                color: "#f8fafc",
                padding: "1rem 1.2rem",
                borderRadius: msg.sender === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                border: msg.sender === "user" ? "none" : "1px solid #334155",
                fontSize: "0.92rem",
                lineHeight: "1.6",
                textAlign: "left",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
              }}>
                <div style={{ textAlign: "left" }}>
                  <ReactMarkdown>{msg.text || (streaming && msg.sender === "assistant" ? "Thinking..." : "")}</ReactMarkdown>
                </div>

                {/* Grounding Source Citations Badge List */}
                {msg.sender === "assistant" && msg.sources && msg.sources.length > 0 && (
                  <div style={{ marginTop: "0.8rem", paddingTop: "0.6rem", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.4rem", fontWeight: "600" }}>
                      Grounded Sources ({msg.sources.length}):
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                      {msg.sources.map((src, idx) => (
                        <button
                          key={idx}
                          onClick={() => onSelectCitation && onSelectCitation(src)}
                          style={{
                            background: "rgba(15, 23, 42, 0.8)",
                            border: "1px solid #334155",
                            color: "#38bdf8",
                            padding: "0.25rem 0.6rem",
                            borderRadius: "6px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            fontSize: "0.75rem",
                            transition: "all 0.2s"
                          }}
                          title={src.breadcrumb ? `Section: ${src.breadcrumb}` : src.doc_name}
                        >
                          <FileText size={12} />
                          <span style={{ maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {src.doc_name}
                          </span>
                          {src.breadcrumb && (
                            <>
                              <ChevronRight size={10} style={{ color: "#64748b" }} />
                              <span style={{ maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#cbd5e1" }}>
                                {src.breadcrumb}
                              </span>
                            </>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {msg.sender === "assistant" && msg.text && (
                  <div style={{ marginTop: "0.8rem", paddingTop: "0.5rem", borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", gap: "0.5rem" }}>
                    <button
                      onClick={() => (isSpeaking ? stop() : speak(msg.text))}
                      style={{
                        background: "rgba(56, 189, 248, 0.15)",
                        border: "1px solid rgba(56, 189, 248, 0.3)",
                        color: "#38bdf8",
                        padding: "0.3rem 0.6rem",
                        borderRadius: "6px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        fontSize: "0.75rem",
                        fontWeight: "600",
                        transition: "all 0.2s"
                      }}
                    >
                      <Volume2 size={14} />
                      {isSpeaking ? "Stop Voice" : "Read Aloud"}
                    </button>
                  </div>
                )}
              </div>

              {msg.sender === "user" && (
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  backgroundColor: "#334155",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}>
                  <UserIcon size={20} color="#fff" />
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Control Bar */}
      <div style={{
        padding: "1rem 1.2rem",
        backgroundColor: "#111c38",
        borderTop: "1px solid #1e293b",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem"
      }}>
        <button
          onClick={isListening ? stopListening : startListening}
          style={{
            backgroundColor: isListening ? "#ef4444" : "#1e293b",
            color: isListening ? "#fff" : "#38bdf8",
            border: isListening ? "none" : "1px solid #334155",
            borderRadius: "12px",
            width: "46px",
            height: "46px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.2s",
            boxShadow: isListening ? "0 0 15px rgba(239, 68, 68, 0.5)" : "none"
          }}
          title={isListening ? "Stop Microphone" : "Speak your question (Web Speech)"}
        >
          {isListening ? <MicOff size={22} className="animate-pulse" /> : <Mic size={22} />}
        </button>

        <input
          type="text"
          placeholder={isListening ? "🎙️ Listening to your voice..." : "Ask your documents a question..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          disabled={streaming}
          style={{
            flex: 1,
            backgroundColor: "#0b1329",
            border: "1px solid #334155",
            color: "#f8fafc",
            padding: "0.8rem 1.2rem",
            borderRadius: "12px",
            fontSize: "0.95rem",
            outline: "none"
          }}
        />

        <button
          onClick={() => handleSend()}
          disabled={streaming || !input.trim()}
          style={{
            background: streaming || !input.trim() 
              ? "#334155" 
              : "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)",
            color: "#fff",
            border: "none",
            borderRadius: "12px",
            padding: "0.8rem 1.4rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontWeight: "600",
            cursor: streaming || !input.trim() ? "not-allowed" : "pointer",
            boxShadow: "0 4px 12px rgba(2, 132, 199, 0.3)"
          }}
        >
          {streaming ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
        </button>
      </div>
    </div>
  );
};
