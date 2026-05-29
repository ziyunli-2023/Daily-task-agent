"use client";

import { useEffect, useState } from "react";

type ActivityRecord = {
  id: string;
  summary: string;
  category: string;
  startTime: string;
  endTime?: string;
  energyLevel?: number;
};

const CATEGORY: { [k: string]: { dot: string; chip: string; label: string } } = {
  work: { dot: "bg-blue-400", chip: "text-blue-300 bg-blue-400/10", label: "工作" },
  personal: { dot: "bg-violet-400", chip: "text-violet-300 bg-violet-400/10", label: "个人" },
  health: { dot: "bg-emerald-400", chip: "text-emerald-300 bg-emerald-400/10", label: "健康" },
  learning: { dot: "bg-amber-400", chip: "text-amber-300 bg-amber-400/10", label: "学习" },
  general: { dot: "bg-zinc-400", chip: "text-[var(--text-dim)] bg-[var(--surface-strong)]", label: "其他" },
};

type Props = { refreshKey: number };

export default function Timeline({ refreshKey }: Props) {
  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/records?date=${date}`)
      .then((r) => r.json())
      .then((d) => setRecords(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [date, refreshKey]);

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-3 pb-1 flex items-center gap-2 shrink-0">
        <button
          onClick={() => setDate(today)}
          className={`text-xs px-2.5 py-1 rounded-full transition ${
            date === today
              ? "bg-[var(--surface-strong)] text-[var(--text)]"
              : "text-[var(--text-faint)] hover:bg-[var(--surface-hover)]"
          }`}
        >
          今天
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-[var(--input-bg)] border border-[var(--line)] rounded-lg px-2.5 py-1 text-xs text-[var(--text-dim)] outline-none focus:border-[var(--accent)]/50"
        />
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin px-4 pb-4 pt-2">
        {loading && <p className="text-center text-[var(--text-faint)] text-xs mt-6">加载中…</p>}

        {!loading && records.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-1.5 py-8">
            <span className="text-2xl opacity-40">🌙</span>
            <p className="text-[var(--text-faint)] text-xs">这一天还没有活动记录</p>
          </div>
        )}

        {records.length > 0 && (
          <div className="relative pl-1">
            <div className="absolute left-[52px] top-1 bottom-1 w-px bg-[var(--line)]" />
            <div className="space-y-3">
              {records.map((rec) => {
                const c = CATEGORY[rec.category] || CATEGORY.general;
                return (
                  <div key={rec.id} className="flex gap-3 items-start animate-rise">
                    <div className="w-11 text-right shrink-0 pt-1.5">
                      <span className="text-[11px] text-[var(--text-faint)] tabular-nums">
                        {fmtTime(rec.startTime)}
                      </span>
                    </div>
                    <div className="relative shrink-0 pt-2">
                      <span className={`block w-2.5 h-2.5 rounded-full ${c.dot} ring-4 ring-[var(--ring-bg)] relative z-10`} />
                    </div>
                    <div className="flex-1 min-w-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5 hover:bg-[var(--surface-hover)] transition">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-medium text-[var(--text)]">{rec.summary}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${c.chip}`}>{c.label}</span>
                        {rec.energyLevel ? (
                          <span className="text-[10px] text-[var(--text-faint)]" title={`精力 ${rec.energyLevel}/5`}>
                            {"●".repeat(rec.energyLevel)}
                            <span className="opacity-30">{"●".repeat(5 - rec.energyLevel)}</span>
                          </span>
                        ) : null}
                      </div>
                      {rec.endTime && (
                        <p className="text-[11px] text-[var(--text-faint)] mt-0.5">
                          {fmtTime(rec.startTime)} – {fmtTime(rec.endTime)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}
