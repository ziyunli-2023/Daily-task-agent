"use client";

import { useCallback, useEffect, useState } from "react";

type Memory = {
  id: string;
  type: string;
  title: string;
  content: string;
  importance: number;
  updatedAt: string;
};

const TYPE_META: { [k: string]: { label: string; icon: string; color: string } } = {
  project: { label: "项目", icon: "📁", color: "text-blue-300 bg-blue-400/10 border-blue-400/20" },
  preference: { label: "偏好", icon: "💜", color: "text-violet-300 bg-violet-400/10 border-violet-400/20" },
  habit: { label: "习惯", icon: "🔄", color: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20" },
  person: { label: "人物", icon: "👤", color: "text-amber-300 bg-amber-400/10 border-amber-400/20" },
  fact: { label: "事实", icon: "📌", color: "text-sky-300 bg-sky-400/10 border-sky-400/20" },
  todo: { label: "待办", icon: "⏳", color: "text-rose-300 bg-rose-400/10 border-rose-400/20" },
};
const TYPES = ["all", "project", "preference", "habit", "person", "fact", "todo"];

export default function MemoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter === "all" ? "/api/memories" : `/api/memories?type=${filter}`;
      const d = await fetch(url).then((r) => r.json());
      setMemories(Array.isArray(d) ? d : []);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function extract() {
    setExtracting(true);
    setToast("");
    try {
      const r = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sinceDays: 7 }),
      }).then((x) => x.json());
      setToast(r.saved > 0 ? `提炼出 ${r.saved} 条记忆` : "最近没有可提炼的新记忆");
      load();
    } catch {
      setToast("提炼失败，请重试");
    } finally {
      setExtracting(false);
    }
  }

  async function remove(id: string) {
    setMemories((prev) => prev.filter((m) => m.id !== id));
    await fetch(`/api/memories/${id}`, { method: "DELETE" });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="glass relative w-full max-w-3xl max-h-[88vh] rounded-2xl flex flex-col overflow-hidden animate-rise">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--panel-border)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-base">🧠</span>
            <div>
              <h2 className="text-sm font-semibold">记忆库</h2>
              <p className="text-[11px] text-[var(--text-faint)]">助理对你的长期记忆 · 本地存储</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/export"
              className="text-xs px-3 py-1.5 rounded-lg text-[var(--text-dim)] border border-[var(--panel-border)] hover:bg-[var(--surface-hover)] transition"
              title="导出全部数据为 Markdown"
            >
              导出
            </a>
            <button
              onClick={extract}
              disabled={extracting}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gradient-to-br from-[#4f8ff7] to-[#7c6cf6] text-white disabled:opacity-50 hover:brightness-110 transition shadow-lg shadow-indigo-500/15"
            >
              {extracting ? "提炼中…" : "从最近记录提炼"}
            </button>
            <button
              onClick={onClose}
              className="text-[var(--text-faint)] hover:text-[var(--text)] w-7 h-7 grid place-items-center rounded-lg hover:bg-[var(--surface-hover)] transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-5 py-2.5 border-b border-[var(--panel-border)] flex flex-wrap items-center gap-1.5 shrink-0">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`text-xs px-2.5 py-1 rounded-full transition ${
                filter === t
                  ? "bg-[var(--surface-strong)] text-[var(--text)]"
                  : "text-[var(--text-faint)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              {t === "all" ? "全部" : `${TYPE_META[t].icon} ${TYPE_META[t].label}`}
            </button>
          ))}
          {toast && <span className="ml-auto text-[11px] text-[var(--accent)]">{toast}</span>}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto scroll-thin p-5">
          {loading && <p className="text-center text-[var(--text-faint)] text-xs py-8">加载中…</p>}

          {!loading && memories.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center gap-2 py-12">
              <span className="text-3xl opacity-40">🧠</span>
              <p className="text-[var(--text-faint)] text-sm">还没有记忆</p>
              <p className="text-[var(--text-faint)] text-xs">
                先用对话记录几天工作，再点「从最近记录提炼」让助理沉淀记忆
              </p>
            </div>
          )}

          {!loading && memories.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-2.5">
              {memories.map((m) => {
                const meta = TYPE_META[m.type] || TYPE_META.fact;
                return (
                  <div
                    key={m.id}
                    className="group animate-rise rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5 hover:bg-[var(--surface-hover)] transition"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-medium ${meta.color}`}>
                        {meta.icon} {meta.label}
                      </span>
                      <span className="text-[10px] text-[var(--text-faint)]" title={`重要性 ${m.importance}/5`}>
                        {"★".repeat(m.importance)}
                        <span className="opacity-30">{"★".repeat(5 - m.importance)}</span>
                      </span>
                      <button
                        onClick={() => remove(m.id)}
                        className="ml-auto text-[var(--text-faint)] opacity-0 group-hover:opacity-100 hover:text-rose-400 text-xs transition"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="text-[13px] font-medium text-[var(--text)]">{m.title}</p>
                    <p className="text-xs text-[var(--text-dim)] mt-0.5 leading-relaxed">{m.content}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
