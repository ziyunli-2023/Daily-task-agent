"use client";

import { useEffect, useState } from "react";
import ChatInterface from "@/components/ChatInterface";
import TaskList from "@/components/TaskList";
import Timeline from "@/components/Timeline";
import ThemeToggle from "@/components/ThemeToggle";
import ReportsModal from "@/components/ReportsModal";
import MemoryModal from "@/components/MemoryModal";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [now, setNow] = useState<Date | null>(null);
  const [stats, setStats] = useState({ pending: 0, records: 0 });
  const [reportsOpen, setReportsOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);

  const refresh = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    Promise.all([
      fetch("/api/tasks?status=pending").then((r) => r.json()),
      fetch(`/api/records?date=${today}`).then((r) => r.json()),
    ])
      .then(([tasks, records]) => {
        setStats({
          pending: Array.isArray(tasks) ? tasks.length : 0,
          records: Array.isArray(records) ? records.length : 0,
        });
      })
      .catch(() => {});
  }, [refreshKey]);

  const dateStr = now
    ? now.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      })
    : "";
  const timeStr = now
    ? now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div className="h-full flex flex-col p-5 gap-5 max-w-[1500px] mx-auto">
      {/* Header */}
      <header className="glass rounded-2xl px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4f8ff7] to-[#7c6cf6] flex items-center justify-center text-lg shadow-lg shadow-indigo-500/20">
            ✦
          </div>
          <div>
            <h1 className="text-[17px] font-semibold tracking-tight">
              每日<span className="grad-text">助理</span>
            </h1>
            <p className="text-xs text-[var(--text-faint)] -mt-0.5">你的 AI 私人时间管家</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-3">
            <StatChip label="待办" value={stats.pending} tone="amber" />
            <StatChip label="今日记录" value={stats.records} tone="violet" />
          </div>
          <div className="text-right">
            <div className="text-sm text-[var(--text)] tabular-nums font-medium">{timeStr}</div>
            <div className="text-xs text-[var(--text-faint)]">{dateStr}</div>
          </div>
          <button
            onClick={() => setMemoryOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-[var(--input-bg)] border border-[var(--panel-border)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--accent)]/40 transition"
          >
            <span>🧠</span>
            <span className="hidden sm:inline">记忆</span>
          </button>
          <button
            onClick={() => setReportsOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-[var(--input-bg)] border border-[var(--panel-border)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--accent)]/40 transition"
          >
            <span>📊</span>
            <span className="hidden sm:inline">回顾</span>
          </button>
          <ThemeToggle />
        </div>
      </header>

      <ReportsModal open={reportsOpen} onClose={() => setReportsOpen(false)} />
      <MemoryModal open={memoryOpen} onClose={() => setMemoryOpen(false)} />

      {/* Main grid */}
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1.45fr_1fr] gap-5">
        {/* Chat */}
        <section className="glass rounded-2xl overflow-hidden flex flex-col min-h-0">
          <PanelHeader icon="💬" title="对话" subtitle="告诉我你做了什么，或安排任务" />
          <div className="flex-1 min-h-0">
            <ChatInterface onDataChange={refresh} />
          </div>
        </section>

        {/* Right rail: tasks + timeline */}
        <section className="grid grid-rows-2 gap-5 min-h-0">
          <div className="glass rounded-2xl overflow-hidden flex flex-col min-h-0">
            <PanelHeader icon="✅" title="任务" subtitle="待办与已完成" />
            <div className="flex-1 min-h-0">
              <TaskList refreshKey={refreshKey} onChange={refresh} />
            </div>
          </div>
          <div className="glass rounded-2xl overflow-hidden flex flex-col min-h-0">
            <PanelHeader icon="📅" title="时间线" subtitle="一天的活动轨迹" />
            <div className="flex-1 min-h-0">
              <Timeline refreshKey={refreshKey} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function PanelHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="px-5 py-3.5 border-b border-[var(--panel-border)] flex items-center gap-3 shrink-0">
      <span className="text-base">{icon}</span>
      <div>
        <h2 className="text-sm font-semibold leading-tight">{title}</h2>
        <p className="text-[11px] text-[var(--text-faint)] leading-tight">{subtitle}</p>
      </div>
    </div>
  );
}

function StatChip({ label, value, tone }: { label: string; value: number; tone: "amber" | "violet" }) {
  const tones = {
    amber: "text-amber-300 bg-amber-400/10 border-amber-400/20",
    violet: "text-violet-300 bg-violet-400/10 border-violet-400/20",
  };
  return (
    <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${tones[tone]}`}>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
      <span className="text-xs opacity-80">{label}</span>
    </div>
  );
}
