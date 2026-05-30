"use client";

import { useState } from "react";

export type Task = {
  id: string;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  category?: string | null;
  project?: string | null;
  deadline?: string | null;
  estimatedMinutes?: number | null;
  tags: string;
  links?: string;
};

function parseLinks(raw?: string): string[] {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

const PRIORITY_LABEL: { [k: string]: string } = { urgent: "紧急", high: "高", medium: "中", low: "低" };
const PRIORITIES = ["low", "medium", "high", "urgent"];

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function TaskModal({
  task,
  cats,
  projects,
  onSave,
  onDelete,
  onClose,
}: {
  task: Task;
  cats: string[];
  projects: string[];
  onSave: (id: string, patch: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [priority, setPriority] = useState(task.priority);
  const [category, setCategory] = useState(task.category || "");
  const [project, setProject] = useState(task.project || "");
  const [deadline, setDeadline] = useState(task.deadline ? toLocalInput(task.deadline) : "");
  const [estimated, setEstimated] = useState(task.estimatedMinutes ? String(task.estimatedMinutes) : "");
  const [links, setLinks] = useState<string[]>(parseLinks(task.links));
  const [newLink, setNewLink] = useState("");

  const field =
    "w-full bg-[var(--input-bg)] border border-[var(--line)] rounded-lg px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)]/50";
  const label = "text-[11px] font-medium text-[var(--text-faint)] mb-1 block";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="glass relative w-full max-w-lg max-h-[88vh] rounded-2xl flex flex-col overflow-hidden animate-rise">
        <div className="px-5 py-4 border-b border-[var(--panel-border)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-base">✅</span>
            <div>
              <h2 className="text-sm font-semibold">任务详情</h2>
              <p className="text-[11px] text-[var(--text-faint)]">查看与编辑任务的全部信息</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-faint)] hover:text-[var(--text)] w-7 h-7 grid place-items-center rounded-lg hover:bg-[var(--surface-hover)] transition"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scroll-thin p-5 space-y-3.5">
          <div>
            <label className={label}>标题</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} placeholder="任务标题" />
          </div>

          <div>
            <label className={label}>描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={`${field} resize-y leading-relaxed`}
              placeholder="补充说明（可空）"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>类别</label>
              <input
                list="tm-cats"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={field}
                placeholder="工作 / 生活…"
              />
              <datalist id="tm-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <label className={label}>项目</label>
              <input
                list="tm-projs"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className={field}
                placeholder="所属项目（可空）"
              />
              <datalist id="tm-projs">{projects.map((p) => <option key={p} value={p} />)}</datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>重要性</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className={field}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>预估时长（分钟）</label>
              <input
                type="number"
                value={estimated}
                onChange={(e) => setEstimated(e.target.value)}
                className={field}
                placeholder="例如 60"
                min={0}
              />
            </div>
          </div>

          <div>
            <label className={label}>截止时间</label>
            <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={field} />
          </div>

          <div>
            <label className={label}>链接（{links.length}）</label>
            <div className="space-y-1.5">
              {links.map((url, i) => (
                <div key={i} className="flex items-center gap-2 bg-[var(--input-bg)] border border-[var(--line)] rounded-lg px-2.5 py-1.5">
                  <span className="text-xs">🔗</span>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-0 text-[12px] text-[var(--accent-2)] hover:underline break-all"
                    title={url}
                  >
                    {url}
                  </a>
                  <button
                    onClick={() => setLinks((prev) => prev.filter((_, j) => j !== i))}
                    className="text-[var(--text-faint)] hover:text-rose-400 text-xs shrink-0"
                    title="移除"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="flex gap-1.5">
                <input
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newLink.trim()) {
                      e.preventDefault();
                      setLinks((prev) => [...new Set([...prev, newLink.trim()])]);
                      setNewLink("");
                    }
                  }}
                  className={field}
                  placeholder="粘贴链接后回车添加"
                />
                <button
                  onClick={() => {
                    if (newLink.trim()) {
                      setLinks((prev) => [...new Set([...prev, newLink.trim()])]);
                      setNewLink("");
                    }
                  }}
                  className="text-xs px-3 rounded-lg bg-[var(--surface-strong)] text-[var(--text-dim)] hover:text-[var(--text)] transition shrink-0"
                >
                  添加
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-[var(--panel-border)] flex items-center justify-between shrink-0">
          <button
            onClick={() => onDelete(task.id)}
            className="text-xs px-3 py-1.5 rounded-lg text-rose-400 hover:bg-rose-400/10 transition"
          >
            删除任务
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded-lg text-[var(--text-faint)] hover:bg-[var(--surface-hover)] transition"
            >
              取消
            </button>
            <button
              onClick={() =>
                onSave(task.id, {
                  title,
                  description: description || null,
                  priority,
                  category: category || null,
                  project: project || null,
                  estimatedMinutes: estimated ? Number(estimated) : null,
                  deadline: deadline || null,
                  links,
                })
              }
              className="text-xs font-medium px-4 py-1.5 rounded-lg bg-gradient-to-br from-[#4f8ff7] to-[#7c6cf6] text-white hover:brightness-110 transition shadow-lg shadow-indigo-500/15"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
