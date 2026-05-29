"use client";

import { useEffect, useState } from "react";

type Task = {
  id: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  deadline?: string;
  estimatedMinutes?: number;
  tags: string;
};

const PRIORITY_STYLE: { [k: string]: string } = {
  urgent: "text-rose-300 bg-rose-400/10 border-rose-400/20",
  high: "text-orange-300 bg-orange-400/10 border-orange-400/20",
  medium: "text-amber-300 bg-amber-400/10 border-amber-400/20",
  low: "text-[var(--text-dim)] bg-[var(--surface-strong)] border-[var(--line)]",
};
const PRIORITY_LABEL: { [k: string]: string } = {
  urgent: "紧急",
  high: "高",
  medium: "中",
  low: "低",
};

type Props = { refreshKey: number; onChange?: () => void };

export default function TaskList({ refreshKey, onChange }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<"pending" | "done">("pending");
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    fetch(`/api/tasks?status=${filter}`)
      .then((r) => r.json())
      .then((d) => setTasks(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }
  useEffect(reload, [filter, refreshKey]);

  async function toggleDone(task: Task) {
    const newStatus = task.status === "done" ? "pending" : "done";
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    onChange?.();
  }

  async function saveEdit(id: string, patch: { title: string; priority: string; deadline: string | null }) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setEditId(null);
    reload();
    onChange?.();
  }

  async function deleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    onChange?.();
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1.5 px-4 pt-3 pb-1 shrink-0">
        {(["pending", "done"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              filter === f
                ? "bg-[var(--surface-strong)] text-[var(--text)]"
                : "text-[var(--text-faint)] hover:text-[var(--text-dim)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            {f === "pending" ? "待办" : "已完成"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin px-4 pb-4 pt-1 space-y-2">
        {loading && <p className="text-center text-[var(--text-faint)] text-xs mt-6">加载中…</p>}

        {!loading && tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-1.5 py-8">
            <span className="text-2xl opacity-40">{filter === "pending" ? "🎉" : "📭"}</span>
            <p className="text-[var(--text-faint)] text-xs">
              {filter === "pending" ? "没有待办任务，轻松一下" : "还没有完成的任务"}
            </p>
          </div>
        )}

        {tasks.map((task) => {
          const tags = safeTags(task.tags);
          const overdue =
            task.deadline && task.status !== "done" && new Date(task.deadline) < new Date();
          if (editId === task.id) {
            return <EditTaskRow key={task.id} task={task} onSave={saveEdit} onCancel={() => setEditId(null)} />;
          }
          return (
            <div
              key={task.id}
              className={`group animate-rise rounded-xl border p-3 flex gap-3 items-start transition hover:bg-[var(--surface-hover)] ${
                overdue ? "border-rose-400/25 bg-rose-400/[0.06]" : "border-[var(--line)] bg-[var(--surface)]"
              }`}
            >
              <button
                onClick={() => toggleDone(task)}
                className={`mt-0.5 w-[18px] h-[18px] rounded-md border flex-shrink-0 grid place-items-center transition ${
                  task.status === "done"
                    ? "bg-gradient-to-br from-[#4f8ff7] to-[#7c6cf6] border-transparent"
                    : "border-[var(--text-faint)]/50 hover:border-[var(--accent)]"
                }`}
              >
                {task.status === "done" && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[13px] font-medium ${
                      task.status === "done" ? "line-through text-[var(--text-faint)]" : "text-[var(--text)]"
                    }`}
                  >
                    {task.title}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md border font-medium ${PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.low}`}
                  >
                    {PRIORITY_LABEL[task.priority] || task.priority}
                  </span>
                </div>
                {task.description && (
                  <p className="text-xs text-[var(--text-faint)] mt-0.5 truncate">{task.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {task.deadline && (
                    <span
                      className={`text-[11px] inline-flex items-center gap-1 ${
                        overdue ? "text-rose-300 font-medium" : "text-[var(--text-faint)]"
                      }`}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                        <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      {overdue ? "已逾期 · " : ""}
                      {fmtDeadline(task.deadline)}
                    </span>
                  )}
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] text-[var(--text-dim)] bg-[var(--surface-strong)] px-1.5 py-0.5 rounded-md"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0 mt-0.5">
                <button onClick={() => setEditId(task.id)} className="text-[var(--text-faint)] hover:text-[var(--accent)] text-xs" title="编辑">✎</button>
                <button onClick={() => deleteTask(task.id)} className="text-[var(--text-faint)] hover:text-rose-400 text-xs" title="删除">✕</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PRIORITIES = ["low", "medium", "high", "urgent"];

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function EditTaskRow({
  task,
  onSave,
  onCancel,
}: {
  task: Task;
  onSave: (id: string, patch: { title: string; priority: string; deadline: string | null }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState(task.priority);
  const [deadline, setDeadline] = useState(task.deadline ? toLocalInput(task.deadline) : "");

  return (
    <div className="animate-rise rounded-xl border border-[var(--accent)]/40 bg-[var(--surface)] p-3 space-y-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full bg-[var(--input-bg)] border border-[var(--line)] rounded-lg px-2 py-1 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)]/50"
        placeholder="任务标题"
      />
      <div className="flex gap-1.5">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="bg-[var(--input-bg)] border border-[var(--line)] rounded-lg px-2 py-1 text-xs text-[var(--text-dim)] outline-none"
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
          ))}
        </select>
        <input
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="flex-1 bg-[var(--input-bg)] border border-[var(--line)] rounded-lg px-2 py-1 text-[11px] text-[var(--text-dim)] outline-none"
        />
      </div>
      <div className="flex gap-1.5 justify-end">
        <button onClick={onCancel} className="text-xs px-2.5 py-1 rounded-lg text-[var(--text-faint)] hover:bg-[var(--surface-hover)]">取消</button>
        <button
          onClick={() => onSave(task.id, { title, priority, deadline: deadline || null })}
          className="text-xs px-2.5 py-1 rounded-lg bg-gradient-to-br from-[#4f8ff7] to-[#7c6cf6] text-white hover:brightness-110"
        >
          保存
        </button>
      </div>
    </div>
  );
}

function safeTags(raw: string): string[] {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function fmtDeadline(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
