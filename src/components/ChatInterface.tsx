"use client";

import { useState, useRef, useEffect } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

type Props = {
  onDataChange: () => void;
};

const SUGGESTIONS = [
  "上午9点到11点写了周报",
  "明天下午3点要交项目方案",
  "我今天有什么安排？",
];

const STORAGE_KEY = "daily-assistant-chat";
const WELCOME: Message = {
  role: "assistant",
  content:
    "你好 👋 我是你的私人助理。你可以告诉我今天做了什么，我帮你记录；或者让我帮你安排任务、设定提醒。",
  timestamp: new Date(),
};

export default function ChatInterface({ onDataChange }: Props) {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hydrated = useRef(false);

  // Restore saved conversation on mount (after hydration to avoid SSR mismatch).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { role: "user" | "assistant"; content: string; timestamp: string }[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed.map((m) => ({ ...m, timestamp: new Date(m.timestamp) })));
        }
      }
    } catch {}
    hydrated.current = true;
  }, []);

  // Persist conversation (capped) whenever it changes.
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-100)));
    } catch {}
  }, [messages]);

  function clearChat() {
    setMessages([WELCOME]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const userMsg: Message = { role: "user", content, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const apiMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message, timestamp: new Date() },
      ]);
      if (data.actions?.some((a: { type: string }) => a.type !== "none")) {
        onDataChange();
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "抱歉，出了点问题，请重试。", timestamp: new Date() },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const showSuggestions = messages.length <= 1;

  return (
    <div className="flex flex-col h-full relative">
      {messages.length > 1 && (
        <button
          onClick={clearChat}
          className="absolute top-2 right-3 z-10 text-[11px] px-2 py-1 rounded-lg text-[var(--text-faint)] bg-[var(--input-bg)] border border-[var(--panel-border)] hover:text-[var(--text)] transition"
          title="清空对话（任务、记录等数据不受影响）"
        >
          清空对话
        </button>
      )}
      <div className="flex-1 overflow-y-auto scroll-thin px-5 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex animate-rise ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#4f8ff7] to-[#7c6cf6] flex items-center justify-center text-xs mr-2.5 mt-0.5 shrink-0">
                ✦
              </div>
            )}
            <div
              className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-gradient-to-br from-[#4f8ff7] to-[#7c6cf6] text-white rounded-br-md shadow-lg shadow-indigo-500/15"
                  : "bg-[var(--surface-strong)] border border-[var(--line)] text-[var(--text)] rounded-bl-md"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start animate-rise">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#4f8ff7] to-[#7c6cf6] flex items-center justify-center text-xs mr-2.5 mt-0.5 shrink-0">
              ✦
            </div>
            <div className="bg-[var(--surface-strong)] border border-[var(--line)] rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1">
              <span className="dot w-1.5 h-1.5 rounded-full bg-[var(--text-dim)]" style={{ animationDelay: "0ms" }} />
              <span className="dot w-1.5 h-1.5 rounded-full bg-[var(--text-dim)]" style={{ animationDelay: "180ms" }} />
              <span className="dot w-1.5 h-1.5 rounded-full bg-[var(--text-dim)]" style={{ animationDelay: "360ms" }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {showSuggestions && (
        <div className="px-5 pb-2 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="text-xs text-[var(--text-dim)] bg-[var(--input-bg)] hover:bg-[var(--surface-hover)] border border-[var(--line)] rounded-full px-3 py-1.5 transition"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="p-4 border-t border-[var(--panel-border)]">
        <div className="flex items-end gap-2 bg-[var(--input-bg)] border border-[var(--line)] rounded-2xl px-3 py-2 focus-within:border-[var(--accent)]/50 transition">
          <textarea
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-[13.5px] text-[var(--text)] placeholder:text-[var(--text-faint)] py-1.5 max-h-32 scroll-thin"
            placeholder="说点什么…（Enter 发送，Shift+Enter 换行）"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Don't send while an IME is composing — Enter then confirms the
              // candidate word, not the message. (isComposing / keyCode 229)
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-[#4f8ff7] to-[#7c6cf6] text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 transition shadow-lg shadow-indigo-500/15"
            aria-label="发送"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
