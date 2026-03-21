"use client";
import { useEffect, useRef, useState } from "react";
import { RetellWebClient } from "retell-client-js-sdk";
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaPhone,
  FaPhoneSlash,
  FaPaperPlane,
} from "react-icons/fa";

type TranscriptMessage = { role: "agent" | "user"; content: string };
type ChatMessage = { role: "user" | "ai"; content: string; time: string };
type Status = "idle" | "connecting" | "connected" | "ended" | "error";

const retellWebClient = new RetellWebClient();

export default function RetellPage() {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isAgentTalking, setIsAgentTalking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [activeTab, setActiveTab] = useState<"voice" | "chat">("voice");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // ✅ FIX: call_started pe hi connected set karo
    retellWebClient.on("call_started", () => {
      setStatus("connected");
      setIsCallActive(true);
    });

    retellWebClient.on("call_ended", () => {
      setStatus("ended");
      setIsCallActive(false);
      setIsAgentTalking(false);
      setIsMuted(false);
    });

    retellWebClient.on("agent_start_talking", () => setIsAgentTalking(true));
    retellWebClient.on("agent_stop_talking", () => setIsAgentTalking(false));

    retellWebClient.on("update", (update) => {
      if (update.transcript) {
        setTranscript(
          update.transcript.map((t: any) => ({
            role: t.role,
            content: t.content,
          })),
        );
      }
    });

    retellWebClient.on("error", (error) => {
      console.error("Retell error:", error);
      setStatus("error");
      setIsCallActive(false);
    });

    return () => {
      retellWebClient.stopCall();
    };
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const startCall = async () => {
    try {
      setStatus("connecting");
      const res = await fetch("/api/retell_ai", { method: "POST" });
      const data = await res.json();
      if (!data.access_token) throw new Error("No access token");
      // ✅ FIX: await nahi karo — ye event loop block karta tha
      // call_started event khud status "connected" set karega
      retellWebClient.startCall({ accessToken: data.access_token });
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  const stopCall = () => {
    retellWebClient.stopCall();
    setIsCallActive(false);
    setIsAgentTalking(false);
    setIsMuted(false);
    setStatus("ended");
  };

  const toggleMute = () => {
    if (isMuted) retellWebClient.unmute();
    else retellWebClient.mute();
    setIsMuted((p) => !p);
  };

  const sendChat = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    const now = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    setChatMessages((p) => [...p, { role: "user", content: msg, time: now }]);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await fetch("/api/retell_ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "chat", message: msg }),
      });
      const data = await res.json();
      const t = new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      setChatMessages((p) => [
        ...p,
        { role: "ai", content: data.text ?? "...", time: t },
      ]);
    } catch {
      setChatMessages((p) => [
        ...p,
        { role: "ai", content: "Error fetching response.", time: now },
      ]);
    }
    setChatLoading(false);
    chatInputRef.current?.focus();
  };

  // Status badge config
  const statusMap: Record<
    Status,
    { label: string; color: string; dot: string; pulse: boolean }
  > = {
    idle: {
      label: "Ready",
      color: "bg-gray-700 text-gray-400",
      dot: "bg-gray-500",
      pulse: false,
    },
    connecting: {
      label: "Connecting…",
      color: "bg-yellow-900/40 text-yellow-400",
      dot: "bg-yellow-400",
      pulse: true,
    },
    connected: {
      label: "● Live",
      color: "bg-green-900/40 text-green-400",
      dot: "bg-green-400",
      pulse: true,
    },
    ended: {
      label: "Ended",
      color: "bg-gray-700 text-gray-400",
      dot: "bg-gray-500",
      pulse: false,
    },
    error: {
      label: "Error",
      color: "bg-red-900/40 text-red-400",
      dot: "bg-red-400",
      pulse: false,
    },
  };
  const st = statusMap[status];

  return (
    <div className="bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-7xl bg-gray-900 border border-gray-900 rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between  px-6 py-4 border-b border-gray-800">
          <span
            className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full ${st.color}`}
          >
            <span
              className={`w-2 h-2 rounded-full ${st.dot} ${st.pulse ? "animate-pulse" : ""}`}
            />
            {st.label}
          </span>
        </div>

        <div className="flex border-b border-gray-800">
          {(["voice", "chat"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium transition-colors cursor-pointer
                ${
                  activeTab === tab
                    ? "text-white border-b-2 border-indigo-500 bg-indigo-500/5"
                    : "text-gray-500 hover:text-gray-300 border-b-2 border-transparent"
                }`}
            >
              {tab === "voice" ? "🎙️ Voice Call" : "💬 Text Chat"}
            </button>
          ))}
        </div>

        {activeTab === "voice" && (
          <>
            {isCallActive && (
              <div className="flex items-center justify-between px-6 py-2.5 bg-green-950/30 border-b border-green-900/30">
                <div className="flex items-center gap-3">
                  <div className="flex items-end gap-0.5 h-5">
                    {[6, 14, 18, 12, 6].map((h, i) => (
                      <span
                        key={i}
                        className={`w-1 rounded-full bg-green-400 transition-all
                          ${isAgentTalking ? "animate-pulse" : "opacity-25"}`}
                        style={{
                          height: isAgentTalking ? `${h}px` : "3px",
                          animationDelay: `${i * 0.15}s`,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-green-400 text-sm font-medium">
                    {isAgentTalking
                      ? "Agent is speaking…"
                      : "Listening to you…"}
                  </span>
                </div>
                {isMuted && (
                  <span className="text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/25 px-2.5 py-1 rounded-full">
                    🔇 Muted
                  </span>
                )}
              </div>
            )}

            <div className="h-96 overflow-y-auto px-5 py-4 flex flex-col gap-3 scroll-smooth">
              {transcript.length === 0 ? (
                <div className="m-auto text-center flex flex-col items-center gap-3">
                  <span className="text-5xl opacity-30">🎙️</span>
                  <p className="text-gray-400 font-semibold text-sm">
                    {status === "connecting"
                      ? "Connecting to agent…"
                      : "Start a call to begin"}
                  </p>
                  <p className="text-gray-600 text-xs">
                    {status === "idle" || status === "ended"
                      ? "Press Start Call and speak — transcript appears here"
                      : "Allow microphone access if prompted"}
                  </p>
                </div>
              ) : (
                transcript.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <span
                      className={`text-[10px] font-bold uppercase tracking-widest mb-1
                      ${msg.role === "user" ? "text-indigo-400/70" : "text-green-400/70"}`}
                    >
                      {msg.role === "user" ? "You" : "AI Agent"}
                    </span>
                    <div
                      className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed
                      ${
                        msg.role === "user"
                          ? "bg-indigo-600 text-white rounded-br-sm shadow-lg shadow-indigo-900/30"
                          : "bg-gray-800 border border-gray-700 text-gray-100 rounded-bl-sm"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
              <div ref={transcriptEndRef} />
            </div>

            <div className="flex items-center justify-center gap-3 px-6 py-4 border-t border-gray-800">
              {status === "connecting" ? (
                <>
                  <button
                    disabled
                    className="flex items-center gap-2 bg-indigo-600 text-white px-7 py-3 rounded-full font-semibold text-sm opacity-80 cursor-not-allowed animate-pulse"
                  >
                    ⏳ Connecting…
                  </button>
                  <button
                    onClick={stopCall}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-full font-semibold text-sm cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-900/30"
                  >
                    <FaPhoneSlash /> Cancel
                  </button>
                </>
              ) : !isCallActive ? (
                <button
                  onClick={startCall}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-full font-semibold text-sm cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-lg shadow-green-900/40"
                >
                  <FaPhone /> Start Call
                </button>
              ) : (
                <>
                  <button
                    onClick={toggleMute}
                    className={`flex items-center gap-2 px-5 py-3 rounded-full font-semibold text-sm cursor-pointer transition-all hover:scale-105 active:scale-95 border
                      ${
                        isMuted
                          ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/25"
                          : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
                      }`}
                  >
                    {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
                    {isMuted ? "Unmute" : "Mute"}
                  </button>
                  <button
                    onClick={stopCall}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-full font-semibold text-sm cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-900/30"
                  >
                    <FaPhoneSlash /> End Call
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {activeTab === "chat" && (
          <>
            <div className="h-96 overflow-y-auto px-5 py-4 flex flex-col gap-3 bg-gray-950/30 scroll-smooth">
              {chatMessages.length === 0 ? (
                <div className="m-auto text-center flex flex-col items-center gap-3">
                  <span className="text-5xl opacity-30">💬</span>
                  <p className="text-gray-400 font-semibold text-sm">
                    Text Chat
                  </p>
                  <p className="text-gray-600 text-xs">
                    Type a message below to chat with AI
                  </p>
                </div>
              ) : (
                chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {msg.role === "user" && (
                        <span className="text-gray-600 text-[10px]">
                          {msg.time}
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold uppercase tracking-widest
                        ${msg.role === "user" ? "text-indigo-400/70" : "text-green-400/70"}`}
                      >
                        {msg.role === "user" ? "You" : "AI Agent"}
                      </span>
                      {msg.role === "ai" && (
                        <span className="text-gray-600 text-[10px]">
                          {msg.time}
                        </span>
                      )}
                    </div>
                    <div
                      className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed
                      ${
                        msg.role === "user"
                          ? "bg-indigo-600 text-white rounded-br-sm shadow-lg shadow-indigo-900/30"
                          : "bg-gray-800 border border-gray-700 text-gray-100 rounded-bl-sm"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))
              )}

              {chatLoading && (
                <div className="flex items-start">
                  <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-800 bg-gray-950/30">
              <input
                ref={chatInputRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendChat();
                }}
                placeholder="Type a message…"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500 transition-colors"
              />
              <button
                onClick={sendChat}
                disabled={!chatInput.trim() || chatLoading}
                className="w-10 h-10 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-lg shadow-indigo-900/30 flex-shrink-0"
              >
                <FaPaperPlane size={13} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
