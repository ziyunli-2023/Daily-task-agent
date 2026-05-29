"use client";

import { useEffect, useMemo, useState } from "react";

type Task = {
  id: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  category?: string | null;
  project?: string | null;
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
const PRIORITY_LABEL: { [k: string]: string } = { urgent: "紧急", high: "高", medium: "中", low: "低" };
const PRIORITY_ORDER = ["urgent", "high", "medium", "low"];
const PRIORITIES = ["low", "medium", "high", "urgent"];

type GroupBy = "category" | "priority" | "project";
const GROUP_LABEL: { [k in GroupBy]: string } = { category: "类别", priority: "重要性", project: "项目" };

type Props = { refreshKey: number; onChange?: () => void };

export default function TaskList({ refreshKey, onChange }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<"pending" | "done">("pending");
  const [groupBy, setGroupBy] = useState<GroupBy>("category");
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

  async function saveEdit(id: string, patch: Record<string, unknown>) {
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

  // Distinct existing categories/projects for edit-form suggestions.
  const { allCats, allProjects } = useMemo(() => {
    return {
      allCats: [...new Set(tasks.map((t) => t.category).filter(Boolean) as string[])],
      allProjects: [...new Set(tasks.map((t) => t.project).filter(Boolean) as string[])],
    };
  }, [tasks]);

  // Group tasks by the selected dimension.
  const groups = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      let key: string;
      if (groupBy === "priority") key = t.priority || "low";
      else if (groupBy === "category") key = t.category || "未分类";
      else key = t.project || "无项目";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    let keys = [...map.keys()];
    if (groupBy === "priority") {
      keys.sort((a, b) => PRIORITY_ORDER.indexOf(a) - PRIORITY_ORDER.indexOf(b));
    } else {
      // Fallback bucket ("未分类"/"无项目") goes last, rest alphabetical.
      const fallback = groupBy === "category" ? "未分类" : "无项目";
      keys = keys.sort((a, b) => (a === fallback ? 1 : b === fallback ? -1 : a.localeCompare(b, "zh")));
    }
    return keys.map((k) => ({
      key: k,
      label: groupBy === "priority" ? PRIORITY_LABEL[k] || k : k,
      tasks: map.get(k)!,
    }));
  }, [tasks, groupBy]);

  return (
    <div className="flex flex-col h-full">
      {/* status tabs + group-by */}
      <div className="px-4 pt-3 pb-2 shrink-0 space-y-2">
        <div className="flex gap-1.5">
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
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-[var(--text-faint)]">分组</span>
          <div className="flex gap-0.5 bg-[var(--input-bg)] rounded-lg p-0.5">
            {(["category", "priority", "project"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                  groupBy === g ? "bg-[var(--surface-strong)] text-[var(--text)]" : "text-[var(--text-faint)]"
                }`}
              >
                {GROUP_LABEL[g]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin px-4 pb-4 pt-1 space-y-3">
        {loading && <p className="text-center text-[var(--text-faint)] text-xs mt-6">加载中…</p>}

        {!loading && tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-1.5 py-8">
            <span className="text-2xl opacity-40">{filter === "pending" ? "🎉" : "📭"}</span>
            <p className="text-[var(--text-faint)] text-xs">
              {filter === "pending" ? "没有待办任务，轻松一下" : "还没有完成的任务"}
            </p>
          </div>
        )}

        {!loading &&
          groups.map((group) => (
            <div key={group.key} className="space-y-2">
              <div className="flex items-center gap-2 px-0.5 sticky top-0">
                <span className="text-[11px] font-semibold text-[var(--text-dim)]">{group.label}</span>
                <span className="text-[10px] text-[var(--text-faint)] bg-[var(--surface-strong)] px-1.5 rounded-full">
                  {group.tasks.length}
                </span>
                <div className="flex-1 h-px bg-[var(--line)]" />
              </div>
              {group.tasks.map((task) =>
                editId === task.id ? (
                  <EditTaskRow
                    key={task.id}
                    task={task}
                    cats={allCats}
                    projects={allProjects}
                    onSave={saveEdit}
                    onCancel={() => setEditId(null)}
                  />
                ) : (
                  <TaskCard
                    key={task.id}
                    task={task}
                    groupBy={groupBy}
                    onToggle={() => toggleDone(task)}
                    onEdit={() => setEditId(task.id)}
                    onDelete={() => deleteTask(task.id)}
                  />
                )
              )}
            </div>
          ))}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  groupBy,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task;
  groupBy: GroupBy;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const tags = safeTags(task.tags);
  const overdue = task.deadline && task.status !== "done" && new Date(task.deadline) < new Date();
  return (
    <div
      className={`group animate-rise rounded-xl border p-3 flex gap-3 items-start transition hover:bg-[var(--surface-hover)] ${
        overdue ? "border-rose-400/25 bg-rose-400/[0.06]" : "border-[var(--line)] bg-[var(--surface)]"
      }`}
    >
      <button
        onClick={onToggle}
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
          {/* show priority badge unless we're already grouping by priority */}
          {groupBy !== "priority" && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-md border font-medium ${PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.low}`}
            >
              {PRIORITY_LABEL[task.priority] || task.priority}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {groupBy !== "category" && task.category && (
            <span className="text-[10px] text-[var(--text-dim)] bg-[var(--surface-strong)] px-1.5 py-0.5 rounded-md">
              {task.category}
            </span>
          )}
          {groupBy !== "project" && task.project && (
            <span className="text-[10px] text-violet-300 bg-violet-400/10 px-1.5 py-0.5 rounded-md">
              ◆ {task.project}
            </span>
          )}
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
            <span key={tag} className="text-[10px] text-[var(--text-faint)]">
              #{tag}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0 mt-0.5">
        <button onClick={onEdit} className="text-[var(--text-faint)] hover:text-[var(--accent)] text-xs" title="编辑">✎</button>
        <button onClick={onDelete} className="text-[var(--text-faint)] hover:text-rose-400 text-xs" title="删除">✕</button>
      </div>
    </div>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function EditTaskRow({
  task,
  cats,
  projects,
  onSave,
  onCancel,
}: {
  task: Task;
  cats: string[];
  projects: string[];
  onSave: (id: string, patch: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState(task.priority);
  const [category, setCategory] = useState(task.category || "");
  const [project, setProject] = useState(task.project || "");
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
        <input
          list="cat-suggestions"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="flex-1 min-w-0 bg-[var(--input-bg)] border border-[var(--line)] rounded-lg px-2 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]/50"
          placeholder="类别（如 工作/生活）"
        />
        <datalist id="cat-suggestions">
          {cats.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <input
          list="proj-suggestions"
          value={project}
          onChange={(e) => setProject(e.target.value)}
          className="flex-1 min-w-0 bg-[var(--input-bg)] border border-[var(--line)] rounded-lg px-2 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]/50"
          placeholder="项目（可空）"
        />
        <datalist id="proj-suggestions">
          {projects.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </div>
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
          className="flex-1 min-w-0 bg-[var(--input-bg)] border border-[var(--line)] rounded-lg px-2 py-1 text-[11px] text-[var(--text-dim)] outline-none"
        />
      </div>
      <div className="flex gap-1.5 justify-end">
        <button onClick={onCancel} className="text-xs px-2.5 py-1 rounded-lg text-[var(--text-faint)] hover:bg-[var(--surface-hover)]">取消</button>
        <button
          onClick={() =>
            onSave(task.id, { title, priority, category: category || null, project: project || null, deadline: deadline || null })
          }
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
  return new Date(iso).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
