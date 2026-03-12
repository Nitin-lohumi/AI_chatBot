"use client";

import React, { useState, useRef, useEffect } from "react";
import { FiSend, FiUpload, FiFile, FiX } from "react-icons/fi";

type Chat = {
  role: "user" | "ai";
  text: string;
  contextUsed?: boolean;
};

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [error, setError] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, loading]);

  const chatRef = useRef<Chat[]>([]);
  useEffect(() => {
    const savedChat = localStorage.getItem("chat_history");
    if (savedChat) {
      chatRef.current = JSON.parse(savedChat);
      setChat(chatRef.current);
    }
  }, []);

  const sendMessage = async () => {
    if (!message.trim() || loading) return;
    const userMessage = message.trim();
    setMessage("");
    setError("");
    chatRef.current = [...chatRef.current, { role: "user", text: userMessage }];
    setChat(chatRef.current);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          history: chatRef.current.slice(-10),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      chatRef.current = [
        ...chatRef.current,
        { role: "ai", text: data.answer, contextUsed: data.contextUsed },
      ];
      setChat(chatRef.current);
    } catch (err: any) {
      setError(err.message);
      chatRef.current = [
        ...chatRef.current,
        { role: "ai", text: `Error: ${err.message}` },
      ];
      setChat(chatRef.current);
    } finally {
      setLoading(false);
      localStorage.setItem("chat_history", JSON.stringify(chatRef.current)); 
    }
  };
  const uploadPDF = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setUploadedFiles((prev) => [...prev, file.name]);

      setChat((prev) => [
        ...prev,
        {
          role: "ai",
          text: `✅ ${data.fileName} uploaded in the context!`,
        },
      ]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  const startNewChat = async () => {
    localStorage.removeItem("chat_history");
    setChat([]);
    setUploadedFiles([]);
    setError("");
    try {
      await fetch("/api/clear-context", {
        method: "POST",
      });
    } catch (err) {
      console.error("Error clearing Qdrant context:", err);
    }
  };
  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-gradient-to-b from-black via-gray-950 to-black text-white">
      <div className="flex justify-between items-center w-full">
        {uploadedFiles.length > 0 && (
          <div className="md:max-w-7xl mx-auto w-full md:px-4 px-2 md:pt-2  pt-1 pb-2 flex flex-wrap gap-2">
            {uploadedFiles.map((f) => (
              <span
                key={f}
                className="flex items-center gap-1 text-xs bg-blue-500/10 border border-blue-500/30 px-2 py-1 rounded-full text-blue-300"
              >
                <FiFile size={12} /> {f}{" "}
              </span>
            ))}
          </div>
        )}
        {chat.length > 0 && (
          <>
            <div className="md:max-w-7xl mx-auto w-full md:px-4 px-2 md:pt-2 pt-1 pb-2 flex flex-wrap gap-2 justify-end">
              <button
                className="px-4 py-2 bg-green-600 hover:bg-green-500 cursor-pointer rounded-lg text-white"
                onClick={startNewChat}
              >
                Start New Chat
              </button>
            </div>
          </>
        )}
      </div>

      <div className="md:max-w-7xl w-full mx-auto h-[calc(100vh-15rem)] overflow-y-auto flex flex-col gap-2 p-2 scrollbar-hide">
        {chat.length === 0 && (
          <div className="text-center mt-32">
            <div className="text-5xl mb-3">🤖</div>
            <p className="text-lg text-gray-300">PDF AI Assistant</p>
          </div>
        )}

        {chat.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`px-4 py-3 rounded-2xl max-w-[80%] text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-sm"
                  : "bg-gray-800 text-gray-100 rounded-bl-sm"
              }`}
            >
              {msg.text}
              {msg.contextUsed && (
                <div className="text-xs text-blue-300 mt-1">PDF context</div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex gap-2">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-300"></span>
              </div>
            </div>
          </div>
        )}

        {uploading && (
          <div className="text-center text-yellow-400 text-sm animate-pulse">
            Uploading PDF...
          </div>
        )}

        <div ref={bottomRef}></div>
      </div>

      <div className="border-t border-gray-800 bg-black pt-5">
        <div className="max-w-7xl w-full mx-auto flex items-center gap-3 px-4">
          <input
            type="file"
            id="pdf-upload"
            className="hidden"
            accept=".pdf"
            onChange={uploadPDF}
          />
          <label
            htmlFor="pdf-upload"
            className="p-3 bg-gray-800 hover:bg-gray-700 rounded-xl cursor-pointer"
          >
            <FiUpload size={30} />
          </label>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything.."
            rows={2}
            className="flex-1 scrollbar-hide bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 resize-none"
          />

          <button
            onClick={sendMessage}
            disabled={loading}
            className="p-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700"
          >
            <FiSend size={30} />
          </button>
        </div>

        <p className="md:block hidden text-center text-xs text-gray-500 md:mt-2">
          Shift + Enter for new line • Enter to send
        </p>
      </div>
    </div>
  );
}
