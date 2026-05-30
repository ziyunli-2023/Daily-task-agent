"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Activity = {
  id: string;
  title: string;
  category: string;
  start: string;
  end: string | null;
  energyLevel: number | null;
};
type TaskEvent = {
  id: string;
  title: string;
  priority: string;
  status: string;
  deadline: string;
};
type CalData = { activities: Activity[]; tasks: TaskEvent[] };

const CAT: { [k: string]: { bg: string; dot: string; text: string; label: string } } = {
  work: { bg: "bg-blue-500", dot: "bg-blue-400", text: "text-blue-100", label: "工作" },
  personal: { bg: "bg-violet-500", dot: "bg-violet-400", text: "text-violet-100", label: "个人" },
  health: { bg: "bg-emerald-600", dot: "bg-emerald-400", text: "text-emerald-100", label: "健康" },
  learning: { bg: "bg-amber-600", dot: "bg-amber-400", text: "text-amber-100", label: "学习" },
  general: { bg: "bg-zinc-500", dot: "bg-zinc-400", text: "text-zinc-100", label: "其他" },
};
const cat = (c: string) => CAT[c] || CAT.general;

const PRIO_BG: { [k: string]: string } = {
  urgent: "bg-rose-500",
  high: "bg-orange-500",
  medium: "bg-amber-600",
  low: "bg-zinc-500",
};

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function hm(iso: string) {
  return new Date(iso).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

export default function CalendarView({ refreshKey, onChange }: { refreshKey: number; onChange?: () => void }) {
  const [mode, setMode] = useState<"month" | "day">("month");
  const [cursor, setCursor] = useState(new Date());
  const [data, setData] = useState<CalData>({ activities: [], tasks: [] });
  const today = new Date();

  // Visible range depends on mode.
  const range = useMemo(() => {
    if (mode === "day") return { from: ymd(cursor), to: ymd(cursor) };
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startOffset = (first.getDay() + 6) % 7; // Monday-start
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - startOffset);
    const gridEnd = new Date(gridStart);
    gridEnd.setDate(gridStart.getDate() + 41); // 6 weeks
    return { from: ymd(gridStart), to: ymd(gridEnd) };
  }, [mode, cursor]);

  const load = useCallback(async () => {
    const d = await fetch(`/api/calendar?from=${range.from}&to=${range.to}`, { cache: "no-store" }).then((r) => r.json());
    setData({ activities: d.activities || [], tasks: d.tasks || [] });
  }, [range.from, range.to]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <div className="glass rounded-2xl flex flex-col h-full overflow-hidden">
      <CalHeader
        mode={mode}
        cursor={cursor}
        onMode={setMode}
        onPrev={() => {
          const d = new Date(cursor);
          if (mode === "month") d.setMonth(d.getMonth() - 1);
          else d.setDate(d.getDate() - 1);
          setCursor(d);
        }}
        onNext={() => {
          const d = new Date(cursor);
          if (mode === "month") d.setMonth(d.getMonth() + 1);
          else d.setDate(d.getDate() + 1);
          setCursor(d);
        }}
        onToday={() => setCursor(new Date())}
      />
      {mode === "month" ? (
        <MonthGrid
          cursor={cursor}
          today={today}
          data={data}
          onPickDay={(d) => {
            setCursor(d);
            setMode("day");
          }}
        />
      ) : (
        <DayPlanner cursor={cursor} today={today} data={data} refreshKey={refreshKey} onChange={onChange} />
      )}
    </div>
  );
}

function CalHeader({
  mode,
  cursor,
  onMode,
  onPrev,
  onNext,
  onToday,
}: {
  mode: "month" | "day";
  cursor: Date;
  onMode: (m: "month" | "day") => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const title =
    mode === "month"
      ? cursor.toLocaleDateString("zh-CN", { year: "numeric", month: "long" })
      : cursor.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
  return (
    <div className="px-5 py-3.5 border-b border-[var(--panel-border)] flex items-center gap-3 shrink-0">
      <div className="flex items-center gap-1">
        <button onClick={onPrev} className="w-7 h-7 grid place-items-center rounded-lg text-[var(--text-dim)] hover:bg-[var(--surface-hover)] transition">‹</button>
        <button onClick={onToday} className="text-[14px] px-2.5 py-1 rounded-lg text-[var(--text-dim)] hover:bg-[var(--surface-hover)] transition">今天</button>
        <button onClick={onNext} className="w-7 h-7 grid place-items-center rounded-lg text-[var(--text-dim)] hover:bg-[var(--surface-hover)] transition">›</button>
      </div>
      <h2 className="text-[17px] font-semibold">{title}</h2>
      <div className="ml-auto flex gap-1 bg-[var(--input-bg)] rounded-lg p-0.5">
        {(["month", "day"] as const).map((m) => (
          <button
            key={m}
            onClick={() => onMode(m)}
            className={`px-3 py-1 rounded-md text-[14px] font-medium transition ${
              mode === m ? "bg-[var(--surface-strong)] text-[var(--text)]" : "text-[var(--text-faint)]"
            }`}
          >
            {m === "month" ? "月" : "日"}
          </button>
        ))}
      </div>
    </div>
  );
}

function MonthGrid({
  cursor,
  today,
  data,
  onPickDay,
}: {
  cursor: Date;
  today: Date;
  data: CalData;
  onPickDay: (d: Date) => void;
}) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - startOffset);
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  // Bucket events by day key.
  const byDay = useMemo(() => {
    const m: { [k: string]: { acts: Activity[]; tasks: TaskEvent[] } } = {};
    for (const a of data.activities) {
      const k = ymd(new Date(a.start));
      (m[k] ||= { acts: [], tasks: [] }).acts.push(a);
    }
    for (const t of data.tasks) {
      const k = ymd(new Date(t.deadline));
      (m[k] ||= { acts: [], tasks: [] }).tasks.push(t);
    }
    return m;
  }, [data]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="grid grid-cols-7 border-b border-[var(--panel-border)] shrink-0">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-[14px] font-semibold text-[var(--text-dim)] py-1.5">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6 flex-1 min-h-0">
        {days.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = sameDay(d, today);
          const bucket = byDay[ymd(d)];
          const acts = bucket?.acts || [];
          const tasks = bucket?.tasks || [];
          const items = acts.length + tasks.length;
          const shown = 3;
          return (
            <button
              key={i}
              onClick={() => onPickDay(d)}
              className={`text-left border-b border-r border-[var(--panel-border)] p-1 overflow-hidden flex flex-col gap-0.5 hover:bg-[var(--surface-hover)] transition ${
                inMonth ? "" : "opacity-40"
              } ${i % 7 === 6 ? "border-r-0" : ""}`}
            >
              <span
                className={`text-[14px] w-6 h-6 grid place-items-center rounded-full shrink-0 font-semibold ${
                  isToday ? "bg-gradient-to-br from-[#4f8ff7] to-[#7c6cf6] text-white" : "text-[var(--text)]"
                }`}
              >
                {d.getDate()}
              </span>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {tasks.slice(0, shown).map((t) => (
                  <span
                    key={t.id}
                    className="text-[13px] font-medium leading-snug px-1 py-0.5 rounded bg-rose-500 text-white truncate"
                    title={`截止：${t.title}`}
                  >
                    📌 {t.title}
                  </span>
                ))}
                {acts.slice(0, Math.max(0, shown - tasks.length)).map((a) => (
                  <span
                    key={a.id}
                    className={`text-[13px] font-medium leading-snug px-1 py-0.5 rounded text-white truncate ${cat(a.category).bg}`}
                    title={a.title}
                  >
                    {a.title}
                  </span>
                ))}
                {items > shown && (
                  <span className="text-[12px] font-medium text-[var(--text-dim)] pl-1">+{items - shown}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ===== Interactive day planner (drag to move, resize, drag tasks in) =====

type PlanBlock = {
  id: string;
  taskId: string;
  title: string;
  priority: string;
  status: string;
  category?: string | null;
  start: string;
  end: string | null;
};
type PendingTask = {
  id: string;
  title: string;
  priority: string;
  category?: string | null;
  estimatedMinutes?: number | null;
};

const HOUR = 56; // px per hour
const SNAP = 15; // minutes

function laneLayout(blocks: PlanBlock[]) {
  const items = blocks
    .map((b) => {
      const s = new Date(b.start);
      const e = b.end ? new Date(b.end) : null;
      const startMin = s.getHours() * 60 + s.getMinutes();
      const endMin = e ? e.getHours() * 60 + e.getMinutes() : startMin + 60;
      return { b, startMin, endMin: Math.max(endMin, startMin + 15) };
    })
    .sort((a, b) => a.startMin - b.startMin);

  const out: { b: PlanBlock; startMin: number; endMin: number; lane: number; lanes: number }[] = [];
  let cluster: typeof items = [];
  let clusterEnd = -1;
  const flush = () => {
    const laneEnds: number[] = [];
    const placed = cluster.map((it) => {
      let lane = laneEnds.findIndex((end) => end <= it.startMin);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(it.endMin);
      } else laneEnds[lane] = it.endMin;
      return { ...it, lane };
    });
    for (const p of placed) out.push({ ...p, lanes: laneEnds.length });
    cluster = [];
    clusterEnd = -1;
  };
  for (const it of items) {
    if (cluster.length && it.startMin >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.endMin);
  }
  if (cluster.length) flush();
  return out;
}

function DayPlanner({
  cursor,
  today,
  data,
  refreshKey,
  onChange,
}: {
  cursor: Date;
  today: Date;
  data: CalData;
  refreshKey: number;
  onChange?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [blocks, setBlocks] = useState<PlanBlock[]>([]);
  const [pending, setPending] = useState<PendingTask[]>([]);
  const [planning, setPlanning] = useState(false);
  const blocksRef = useRef<PlanBlock[]>([]);
  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  const dateStr = ymd(cursor);
  const isToday = sameDay(cursor, today);

  const load = useCallback(async () => {
    const [pj, tj] = await Promise.all([
      fetch(`/api/plan?date=${dateStr}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/tasks?status=pending`, { cache: "no-store" }).then((r) => r.json()),
    ]);
    const bl: PlanBlock[] = Array.isArray(pj.blocks) ? pj.blocks : [];
    setBlocks(bl);
    const scheduled = new Set(bl.map((b) => b.taskId));
    setPending((Array.isArray(tj) ? tj : []).filter((t: PendingTask) => !scheduled.has(t.id)));
  }, [dateStr]);
  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // Scroll to ~8:00 on open.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 8 * HOUR - 16;
  }, [dateStr]);

  // ---- time/position helpers ----
  const snap = (m: number) => Math.max(0, Math.min(24 * 60, Math.round(m / SNAP) * SNAP));
  const minOf = (iso: string) => {
    const d = new Date(iso);
    return d.getHours() * 60 + d.getMinutes();
  };
  const isoAt = (mins: number) => {
    const d = new Date(cursor);
    d.setHours(0, 0, 0, 0);
    d.setMinutes(mins);
    return d.toISOString();
  };
  const yToMin = (clientY: number) => {
    const rect = gridRef.current!.getBoundingClientRect();
    return snap(((clientY - rect.top) / HOUR) * 60);
  };

  // ---- drag move / resize (pointer capture) ----
  const dragRef = useRef<{ id: string; mode: "move" | "resize"; startY: number; origStart: number; origEnd: number } | null>(null);

  function onPointerDownBlock(e: React.PointerEvent, b: PlanBlock, mode: "move" | "resize") {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const s = minOf(b.start);
    const en = b.end ? minOf(b.end) : s + 60;
    dragRef.current = { id: b.id, mode, startY: e.clientY, origStart: s, origEnd: en };
  }
  function onPointerMoveBlock(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const raw = ((e.clientY - d.startY) / HOUR) * 60;
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== d.id) return b;
        if (d.mode === "move") {
          const dur = d.origEnd - d.origStart;
          const ns = Math.max(0, Math.min(24 * 60 - dur, snap(d.origStart + raw)));
          return { ...b, start: isoAt(ns), end: isoAt(ns + dur) };
        } else {
          const ne = Math.max(d.origStart + SNAP, Math.min(24 * 60, snap(d.origEnd + raw)));
          return { ...b, end: isoAt(ne) };
        }
      })
    );
  }
  async function onPointerUpBlock(e: React.PointerEvent) {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    const b = blocksRef.current.find((x) => x.id === d.id);
    if (!b) return;
    await fetch(`/api/plan/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledStart: b.start, scheduledEnd: b.end }),
    });
    onChange?.();
  }

  // ---- drag a pending task onto the grid ----
  async function onDropTask(e: React.DragEvent) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    if (!taskId) return;
    const t = pending.find((x) => x.id === taskId);
    const dur = t?.estimatedMinutes && t.estimatedMinutes > 0 ? t.estimatedMinutes : 60;
    const startMin = yToMin(e.clientY);
    await fetch("/api/plan/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, start: isoAt(startMin), end: isoAt(Math.min(24 * 60, startMin + dur)) }),
    });
    load();
    onChange?.();
  }

  async function complete(b: PlanBlock) {
    await fetch(`/api/plan/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complete: true }),
    });
    load();
    onChange?.();
  }
  async function removeBlock(b: PlanBlock) {
    setBlocks((prev) => prev.filter((x) => x.id !== b.id));
    await fetch(`/api/plan/${b.id}`, { method: "DELETE" });
    load();
    onChange?.();
  }
  async function aiPlan() {
    setPlanning(true);
    try {
      await fetch("/api/plan", { method: "POST" });
      load();
      onChange?.();
    } finally {
      setPlanning(false);
    }
  }

  const laid = useMemo(() => laneLayout(blocks), [blocks]);
  const nowMin = today.getHours() * 60 + today.getMinutes();
  const deadlines = data.tasks.filter((t) => sameDay(new Date(t.deadline), cursor));

  return (
    <div className="flex-1 min-h-0 flex">
      {/* Unscheduled tasks (drag source) */}
      <div className="w-56 shrink-0 border-r border-[var(--panel-border)] flex flex-col min-h-0">
        <div className="px-3 py-2.5 border-b border-[var(--panel-border)] flex items-center justify-between shrink-0">
          <span className="text-[13px] font-semibold text-[var(--text-dim)]">待排任务</span>
          {isToday && (
            <button
              onClick={aiPlan}
              disabled={planning}
              className="text-[11px] font-medium px-2 py-1 rounded-lg bg-gradient-to-br from-[#4f8ff7] to-[#7c6cf6] text-white disabled:opacity-50 hover:brightness-110 transition"
            >
              {planning ? "排程中…" : "AI 规划"}
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto scroll-thin p-2 space-y-1.5">
          {pending.length === 0 && <p className="text-[12px] text-[var(--text-faint)] text-center mt-4">没有待排任务</p>}
          {pending.map((t) => (
            <div
              key={t.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("taskId", t.id)}
              className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 cursor-grab active:cursor-grabbing hover:bg-[var(--surface-hover)] transition"
              title="拖到右侧时间表排程"
            >
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIO_BG[t.priority] || PRIO_BG.low}`} />
                <span className="text-[13px] text-[var(--text)] truncate">{t.title}</span>
              </div>
              {t.estimatedMinutes ? (
                <span className="text-[11px] text-[var(--text-faint)] ml-3">⏱ {t.estimatedMinutes}分</span>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* Hour grid */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto scroll-thin">
        <div
          ref={gridRef}
          className="relative"
          style={{ height: 24 * HOUR }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDropTask}
        >
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="absolute left-0 right-0 border-t border-[var(--panel-border)]" style={{ top: h * HOUR }}>
              <span className="absolute -top-2 left-2 text-[12px] font-medium text-[var(--text-dim)] tabular-nums">
                {String(h).padStart(2, "0")}:00
              </span>
            </div>
          ))}

          {/* lunch hint 12-13 */}
          <div className="absolute left-12 right-2 bg-[var(--surface-strong)]/40 rounded" style={{ top: 12 * HOUR, height: HOUR }} />

          {isToday && (
            <div className="absolute left-12 right-2 z-30 pointer-events-none" style={{ top: (nowMin / 60) * HOUR }}>
              <div className="h-px bg-rose-500 relative">
                <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-rose-500" />
              </div>
            </div>
          )}

          {/* deadline markers */}
          {deadlines.map((t) => {
            const min = minOf(t.deadline);
            return (
              <div key={t.id} className="absolute left-12 right-2 z-10 pointer-events-none" style={{ top: (min / 60) * HOUR }}>
                <div className="flex items-center gap-1 -translate-y-1/2">
                  <div className="flex-1 border-t border-dashed border-rose-400/50" />
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-rose-500/90 text-white whitespace-nowrap">📌 {t.title} 截止</span>
                </div>
              </div>
            );
          })}

          {/* plan blocks */}
          <div className="absolute left-12 right-2 top-0 bottom-0">
            {laid.map(({ b, startMin, endMin, lane, lanes }) => {
              const top = (startMin / 60) * HOUR;
              const height = Math.max(22, ((endMin - startMin) / 60) * HOUR - 2);
              const widthPct = 100 / lanes;
              const done = b.status === "done";
              const active = isToday && startMin <= nowMin && nowMin < endMin && !done;
              return (
                <div
                  key={b.id}
                  onPointerDown={(e) => onPointerDownBlock(e, b, "move")}
                  onPointerMove={onPointerMoveBlock}
                  onPointerUp={onPointerUpBlock}
                  className={`group absolute rounded-lg px-2 py-1 overflow-hidden shadow-sm select-none touch-none cursor-grab active:cursor-grabbing border ${
                    done ? "bg-[var(--surface)] border-[var(--line)] opacity-60" : `${PRIO_BG[b.priority] || PRIO_BG.low} border-transparent`
                  } ${active ? "ring-2 ring-white/70" : ""}`}
                  style={{ top, height, left: `${lane * widthPct}%`, width: `calc(${widthPct}% - 3px)` }}
                  title={`${b.title} ${hm(b.start)}${b.end ? `–${hm(b.end)}` : ""}`}
                >
                  <div className="flex items-start gap-1">
                    <span
                      className={`text-[13px] font-semibold leading-snug truncate flex-1 ${done ? "line-through text-[var(--text-faint)]" : "text-white"}`}
                    >
                      {b.title}
                    </span>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                      <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          complete(b);
                        }}
                        className={`text-[11px] leading-none ${done ? "text-[var(--text-faint)]" : "text-white/90 hover:text-white"}`}
                        title="完成（生成记录）"
                      >
                        ✓
                      </button>
                      <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBlock(b);
                        }}
                        className={`text-[11px] leading-none ${done ? "text-[var(--text-faint)]" : "text-white/90 hover:text-white"}`}
                        title="移除"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  {height > 30 && (
                    <span className={`text-[12px] leading-snug ${done ? "text-[var(--text-faint)]" : "text-white/90"}`}>
                      {hm(b.start)}
                      {b.end ? `–${hm(b.end)}` : ""}
                    </span>
                  )}
                  {/* resize handle */}
                  {!done && (
                    <div
                      onPointerDown={(e) => onPointerDownBlock(e, b, "resize")}
                      onPointerMove={onPointerMoveBlock}
                      onPointerUp={onPointerUpBlock}
                      className="absolute left-0 right-0 bottom-0 h-2 cursor-ns-resize"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {blocks.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 pointer-events-none">
              <span className="text-2xl opacity-40">🗓️</span>
              <p className="text-[var(--text-faint)] text-[13px]">把左侧任务拖进来，或点「AI 规划」</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
