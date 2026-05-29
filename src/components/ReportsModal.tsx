"use client";

import { useCallback, useEffect, useState } from "react";

type ReportType = "daily" | "weekly";

type Metrics = {
  recordCount: number;
  trackedMinutes: number;
  tasksCompleted: number;
  tasksCreated: number;
  avgEnergy: number | null;
  categoryMinutes: { category: string; label: string; minutes: number }[];
  perDayCompleted?: { date: string; count: number }[];
  busiestDay?: string | null;
};

type Report = {
  id: string;
  type: ReportType;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  summary: string;
  metrics: string;
  generatedBy: string;
  updatedAt: string;
};

const CAT_COLOR: { [k: string]: string } = {
  work: "bg-blue-400",
  personal: "bg-violet-400",
  health: "bg-emerald-400",
  learning: "bg-amber-400",
  general: "bg-zinc-400",
};

function localDate(d = new Date()): string {
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD
}
function fmtHours(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export default function ReportsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [type, setType] = useState<ReportType>("daily");
  const [date, setDate] = useState(localDate());
  const [report, setReport] = useState<Report | null>(null);
  const [history, setHistory] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/reports?type=${type}&date=${date}`).then((x) => x.json());
      setReport(r || null);
    } finally {
      setLoading(false);
    }
  }, [type, date]);

  const loadHistory = useCallback(async () => {
    const h = await fetch(`/api/reports?type=${type}`).then((x) => x.json());
    setHistory(Array.isArray(h) ? h : []);
  }, [type]);

  useEffect(() => {
    if (open) {
      loadReport();
      loadHistory();
    }
  }, [open, loadReport, loadHistory]);

  async function generate() {
    setGenerating(true);
    try {
      const r = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, date }),
      }).then((x) => x.json());
      setReport(r);
      loadHistory();
    } finally {
      setGenerating(false);
    }
  }

  if (!open) return null;

  const metrics: Metrics | null = report ? safeParse(report.metrics) : null;
  const maxCat = metrics?.categoryMinutes?.[0]?.minutes || 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="glass relative w-full max-w-3xl max-h-[88vh] rounded-2xl flex flex-col overflow-hidden animate-rise">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--panel-border)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-base">📊</span>
            <div>
              <h2 className="text-sm font-semibold">回顾报告</h2>
              <p className="text-[11px] text-[var(--text-faint)]">日报 / 周报 · 自动存档，随时回查</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-faint)] hover:text-[var(--text)] w-7 h-7 grid place-items-center rounded-lg hover:bg-[var(--surface-hover)] transition"
          >
            ✕
          </button>
        </div>

        {/* Controls */}
        <div className="px-5 py-3 border-b border-[var(--panel-border)] flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex gap-1 bg-[var(--input-bg)] rounded-lg p-0.5">
            {(["daily", "weekly"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                  type === t ? "bg-[var(--surface-strong)] text-[var(--text)]" : "text-[var(--text-faint)]"
                }`}
              >
                {t === "daily" ? "日报" : "周报"}
              </button>
            ))}
          </div>
          <button
            onClick={() => setDate(localDate())}
            className="text-xs px-2.5 py-1.5 rounded-lg text-[var(--text-faint)] hover:bg-[var(--surface-hover)] transition"
          >
            {type === "daily" ? "今天" : "本周"}
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-[var(--input-bg)] border border-[var(--line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-dim)] outline-none focus:border-[var(--accent)]/50"
          />
          <button
            onClick={generate}
            disabled={generating}
            className="ml-auto text-xs font-medium px-3.5 py-1.5 rounded-lg bg-gradient-to-br from-[#4f8ff7] to-[#7c6cf6] text-white disabled:opacity-50 hover:brightness-110 transition shadow-lg shadow-indigo-500/15"
          >
            {generating ? "生成中…" : report ? "重新生成" : "生成报告"}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto scroll-thin p-5">
          {loading && <p className="text-center text-[var(--text-faint)] text-xs py-8">加载中…</p>}

          {!loading && !report && (
            <div className="flex flex-col items-center justify-center text-center gap-2 py-12">
              <span className="text-3xl opacity-40">📭</span>
              <p className="text-[var(--text-faint)] text-sm">这个时间段还没有报告</p>
              <p className="text-[var(--text-faint)] text-xs">点右上角「生成报告」让 AI 总结这段时间</p>
            </div>
          )}

          {!loading && report && metrics && (
            <div className="space-y-5">
              {/* Metric cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <MetricCard label="活动记录" value={String(metrics.recordCount)} unit="项" />
                <MetricCard label="记录时长" value={fmtHours(metrics.trackedMinutes)} unit="" />
                <MetricCard label="完成任务" value={String(metrics.tasksCompleted)} unit="个" />
                <MetricCard
                  label="平均精力"
                  value={metrics.avgEnergy != null ? String(metrics.avgEnergy) : "—"}
                  unit={metrics.avgEnergy != null ? "/5" : ""}
                />
              </div>

              {/* Category breakdown */}
              {metrics.categoryMinutes.length > 0 && (
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                  <p className="text-xs font-medium text-[var(--text-dim)] mb-3">时间投入分布</p>
                  <div className="space-y-2">
                    {metrics.categoryMinutes.map((c) => (
                      <div key={c.category} className="flex items-center gap-3">
                        <span className="text-xs text-[var(--text-dim)] w-10 shrink-0">{c.label}</span>
                        <div className="flex-1 h-2 rounded-full bg-[var(--surface-strong)] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${CAT_COLOR[c.category] || CAT_COLOR.general}`}
                            style={{ width: `${Math.max(4, (c.minutes / maxCat) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-[var(--text-faint)] w-14 text-right shrink-0 tabular-nums">
                          {fmtHours(c.minutes)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Weekly per-day completion */}
              {type === "weekly" && metrics.perDayCompleted && (
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                  <p className="text-xs font-medium text-[var(--text-dim)] mb-3">每日完成任务数</p>
                  <div className="flex items-end justify-between gap-2 h-20">
                    {metrics.perDayCompleted.map((d) => {
                      const max = Math.max(1, ...metrics.perDayCompleted!.map((x) => x.count));
                      const wd = new Date(`${d.date}T00:00:00`).toLocaleDateString("zh-CN", {
                        weekday: "short",
                      });
                      return (
                        <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[10px] text-[var(--text-faint)] tabular-nums">{d.count}</span>
                          <div
                            className="w-full rounded-md bg-gradient-to-t from-[#4f8ff7] to-[#7c6cf6] min-h-[3px] transition-all"
                            style={{ height: `${(d.count / max) * 100}%` }}
                          />
                          <span className="text-[10px] text-[var(--text-faint)]">{wd}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* AI summary */}
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-md bg-gradient-to-br from-[#4f8ff7] to-[#7c6cf6] grid place-items-center text-[10px]">
                    ✦
                  </span>
                  <p className="text-xs font-medium text-[var(--text-dim)]">AI 总结</p>
                </div>
                <div className="text-[13px] text-[var(--text)] leading-relaxed whitespace-pre-wrap">
                  {report.summary}
                </div>
                <p className="text-[10px] text-[var(--text-faint)] mt-3">
                  {report.generatedBy === "auto" ? "自动生成" : "手动生成"} ·{" "}
                  {new Date(report.updatedAt).toLocaleString("zh-CN", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>

              {/* History */}
              {history.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[var(--text-faint)] mb-2 px-1">历史报告</p>
                  <div className="flex flex-wrap gap-1.5">
                    {history.map((h) => {
                      const ps = new Date(h.periodStart);
                      const label =
                        h.type === "daily"
                          ? ps.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })
                          : h.periodKey.replace("weekly:", "");
                      const active = h.periodKey === report.periodKey;
                      return (
                        <button
                          key={h.id}
                          onClick={() => setDate(localDate(ps))}
                          className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
                            active
                              ? "border-[var(--accent)]/50 text-[var(--text)] bg-[var(--surface-strong)]"
                              : "border-[var(--line)] text-[var(--text-faint)] hover:bg-[var(--surface-hover)]"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <p className="text-[11px] text-[var(--text-faint)]">{label}</p>
      <p className="text-lg font-semibold text-[var(--text)] mt-0.5">
        {value}
        <span className="text-xs text-[var(--text-faint)] font-normal ml-0.5">{unit}</span>
      </p>
    </div>
  );
}

function safeParse(s: string): Metrics | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
