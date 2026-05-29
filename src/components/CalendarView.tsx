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

export default function CalendarView({ refreshKey }: { refreshKey: number }) {
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
    const d = await fetch(`/api/calendar?from=${range.from}&to=${range.to}`).then((r) => r.json());
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
        <DayGrid cursor={cursor} today={today} data={data} />
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
        <button onClick={onToday} className="text-xs px-2.5 py-1 rounded-lg text-[var(--text-dim)] hover:bg-[var(--surface-hover)] transition">今天</button>
        <button onClick={onNext} className="w-7 h-7 grid place-items-center rounded-lg text-[var(--text-dim)] hover:bg-[var(--surface-hover)] transition">›</button>
      </div>
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="ml-auto flex gap-1 bg-[var(--input-bg)] rounded-lg p-0.5">
        {(["month", "day"] as const).map((m) => (
          <button
            key={m}
            onClick={() => onMode(m)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition ${
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
          <div key={w} className="text-center text-[11px] text-[var(--text-faint)] py-1.5">
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
                className={`text-[11px] w-5 h-5 grid place-items-center rounded-full shrink-0 ${
                  isToday ? "bg-gradient-to-br from-[#4f8ff7] to-[#7c6cf6] text-white font-semibold" : "text-[var(--text-dim)]"
                }`}
              >
                {d.getDate()}
              </span>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {tasks.slice(0, shown).map((t) => (
                  <span
                    key={t.id}
                    className="text-[10px] leading-tight px-1 py-0.5 rounded bg-rose-500/90 text-white truncate"
                    title={`截止：${t.title}`}
                  >
                    📌 {t.title}
                  </span>
                ))}
                {acts.slice(0, Math.max(0, shown - tasks.length)).map((a) => (
                  <span
                    key={a.id}
                    className={`text-[10px] leading-tight px-1 py-0.5 rounded text-white truncate ${cat(a.category).bg}`}
                    title={a.title}
                  >
                    {a.title}
                  </span>
                ))}
                {items > shown && (
                  <span className="text-[10px] text-[var(--text-faint)] pl-1">+{items - shown}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type Laid = { ev: Activity; startMin: number; endMin: number; lane: number; lanes: number };

function layout(acts: Activity[]): Laid[] {
  const evs = acts
    .map((ev) => {
      const s = new Date(ev.start);
      const startMin = s.getHours() * 60 + s.getMinutes();
      const e = ev.end ? new Date(ev.end) : null;
      const endMin = e ? e.getHours() * 60 + e.getMinutes() : startMin + 30;
      return { ev, startMin, endMin: Math.max(endMin, startMin + 20) };
    })
    .sort((a, b) => a.startMin - b.startMin);

  // Greedy overlap-lane assignment over clusters.
  const result: Laid[] = [];
  let cluster: typeof evs = [];
  let clusterEnd = -1;

  const flush = () => {
    const laneEnds: number[] = [];
    const placed = cluster.map((item) => {
      let lane = laneEnds.findIndex((end) => end <= item.startMin);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(item.endMin);
      } else laneEnds[lane] = item.endMin;
      return { ...item, lane };
    });
    const lanes = laneEnds.length;
    for (const p of placed) result.push({ ...p, lanes });
    cluster = [];
    clusterEnd = -1;
  };

  for (const item of evs) {
    if (cluster.length && item.startMin >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  if (cluster.length) flush();
  return result;
}

function DayGrid({ cursor, today, data }: { cursor: Date; today: Date; data: CalData }) {
  const HOUR = 52; // px per hour
  const scrollRef = useRef<HTMLDivElement>(null);

  const dayActs = useMemo(
    () => data.activities.filter((a) => sameDay(new Date(a.start), cursor)),
    [data.activities, cursor]
  );
  const dayTasks = useMemo(
    () => data.tasks.filter((t) => sameDay(new Date(t.deadline), cursor)),
    [data.tasks, cursor]
  );
  const laid = useMemo(() => layout(dayActs), [dayActs]);

  // Auto-scroll to first activity (or 8:00) on day change.
  useEffect(() => {
    const firstMin = laid.length ? Math.min(...laid.map((l) => l.startMin)) : 8 * 60;
    if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, (firstMin / 60) * HOUR - 20);
  }, [laid, cursor]);

  const nowMin = today.getHours() * 60 + today.getMinutes();
  const showNow = sameDay(cursor, today);

  return (
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto scroll-thin">
      <div className="relative" style={{ height: 24 * HOUR }}>
        {/* Hour lines + labels */}
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="absolute left-0 right-0 border-t border-[var(--panel-border)]" style={{ top: h * HOUR }}>
            <span className="absolute -top-2 left-2 text-[10px] text-[var(--text-faint)] tabular-nums">
              {String(h).padStart(2, "0")}:00
            </span>
          </div>
        ))}

        {/* Now indicator */}
        {showNow && (
          <div className="absolute left-12 right-2 z-20 pointer-events-none" style={{ top: (nowMin / 60) * HOUR }}>
            <div className="h-px bg-rose-500 relative">
              <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-rose-500" />
            </div>
          </div>
        )}

        {/* Activity blocks */}
        <div className="absolute left-12 right-2 top-0 bottom-0">
          {laid.map(({ ev, startMin, endMin, lane, lanes }) => {
            const c = cat(ev.category);
            const top = (startMin / 60) * HOUR;
            const height = Math.max(18, ((endMin - startMin) / 60) * HOUR - 2);
            const widthPct = 100 / lanes;
            return (
              <div
                key={ev.id}
                className={`absolute rounded-md px-1.5 py-0.5 overflow-hidden ${c.bg} shadow-sm`}
                style={{ top, height, left: `${lane * widthPct}%`, width: `calc(${widthPct}% - 3px)` }}
                title={`${ev.title} ${hm(ev.start)}${ev.end ? `–${hm(ev.end)}` : ""}`}
              >
                <p className="text-[11px] font-medium text-white leading-tight truncate">{ev.title}</p>
                {height > 28 && (
                  <p className="text-[10px] text-white/75 leading-tight">
                    {hm(ev.start)}
                    {ev.end ? `–${hm(ev.end)}` : ""}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Task deadline markers */}
        {dayTasks.map((t) => {
          const d = new Date(t.deadline);
          const min = d.getHours() * 60 + d.getMinutes();
          return (
            <div key={t.id} className="absolute left-12 right-2 z-10" style={{ top: (min / 60) * HOUR }}>
              <div className="flex items-center gap-1 -translate-y-1/2">
                <div className="flex-1 border-t border-dashed border-rose-400/60" />
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/90 text-white whitespace-nowrap shadow-sm">
                  📌 {t.title} 截止 {hm(t.deadline)}
                </span>
              </div>
            </div>
          );
        })}

        {dayActs.length === 0 && dayTasks.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 pointer-events-none">
            <span className="text-2xl opacity-40">🗓️</span>
            <p className="text-[var(--text-faint)] text-xs">这一天没有记录或截止任务</p>
          </div>
        )}
      </div>
    </div>
  );
}
