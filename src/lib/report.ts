import { prisma } from "@/lib/prisma";
import { chatWithFallback } from "@/lib/llm";

const CATEGORY_LABEL: { [k: string]: string } = {
  work: "工作",
  personal: "个人",
  health: "健康",
  learning: "学习",
  general: "其他",
};

export type ReportType = "daily" | "weekly";

export type ReportMetrics = {
  recordCount: number;
  trackedMinutes: number;
  tasksCompleted: number;
  tasksCreated: number;
  avgEnergy: number | null;
  categoryMinutes: { category: string; label: string; minutes: number }[];
  perDayCompleted?: { date: string; count: number }[]; // weekly only
  busiestDay?: string | null; // weekly only
};

// ---- Period helpers (operate in the host's local timezone) ----

export function dailyRange(dateStr: string): { start: Date; end: Date; key: string } {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end, key: `daily:${dateStr}` };
}

// ISO week: weeks start Monday. Returns the Monday of the week containing dateStr.
export function weeklyRange(dateStr: string): { start: Date; end: Date; key: string } {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  monday.setHours(0, 0, 0, 0);
  const end = new Date(monday);
  end.setDate(monday.getDate() + 7);
  return { start: monday, end, key: `weekly:${isoWeekKey(monday)}` };
}

function isoWeekKey(monday: Date): string {
  // Compute ISO week number from the Thursday of this week.
  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);
  const year = thursday.getFullYear();
  const firstThursday = new Date(year, 0, 4);
  const firstWeekMonday = new Date(firstThursday);
  firstWeekMonday.setDate(firstThursday.getDate() - ((firstThursday.getDay() + 6) % 7));
  const week = 1 + Math.round((monday.getTime() - firstWeekMonday.getTime()) / (7 * 864e5));
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---- Metrics ----

export async function computeMetrics(
  type: ReportType,
  start: Date,
  end: Date
): Promise<ReportMetrics> {
  const [records, completedTasks, createdTasks] = await Promise.all([
    prisma.record.findMany({ where: { startTime: { gte: start, lt: end } } }),
    prisma.task.findMany({
      where: { status: "done", updatedAt: { gte: start, lt: end } },
    }),
    prisma.task.findMany({ where: { createdAt: { gte: start, lt: end } } }),
  ]);

  let trackedMinutes = 0;
  const catMin: { [k: string]: number } = {};
  let energySum = 0;
  let energyN = 0;

  for (const r of records) {
    let mins = 30; // default assumption when no end time
    if (r.endTime) {
      mins = Math.max(0, Math.round((r.endTime.getTime() - r.startTime.getTime()) / 60000));
    }
    trackedMinutes += mins;
    catMin[r.category] = (catMin[r.category] || 0) + mins;
    if (r.energyLevel) {
      energySum += r.energyLevel;
      energyN += 1;
    }
  }

  const categoryMinutes = Object.entries(catMin)
    .map(([category, minutes]) => ({
      category,
      label: CATEGORY_LABEL[category] || category,
      minutes,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  const metrics: ReportMetrics = {
    recordCount: records.length,
    trackedMinutes,
    tasksCompleted: completedTasks.length,
    tasksCreated: createdTasks.length,
    avgEnergy: energyN ? Math.round((energySum / energyN) * 10) / 10 : null,
    categoryMinutes,
  };

  if (type === "weekly") {
    const perDay: { [date: string]: number } = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      perDay[localDateStr(d)] = 0;
    }
    for (const t of completedTasks) {
      const k = localDateStr(t.updatedAt);
      if (k in perDay) perDay[k] += 1;
    }
    const perDayCompleted = Object.entries(perDay).map(([date, count]) => ({ date, count }));
    let busiestDay: string | null = null;
    let max = -1;
    for (const { date, count } of perDayCompleted) {
      if (count > max) {
        max = count;
        busiestDay = date;
      }
    }
    metrics.perDayCompleted = perDayCompleted;
    metrics.busiestDay = max > 0 ? busiestDay : null;
  }

  return metrics;
}

// ---- AI narrative ----

function fmtHours(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}小时${m}分`;
  if (h) return `${h}小时`;
  return `${m}分钟`;
}

async function generateNarrative(
  type: ReportType,
  start: Date,
  metrics: ReportMetrics,
  recordSummaries: string[]
): Promise<string> {
  const periodLabel = type === "daily" ? "今天" : "本周";
  const catLines = metrics.categoryMinutes
    .map((c) => `  - ${c.label}: ${fmtHours(c.minutes)}`)
    .join("\n");

  const context = `时间段类型: ${type === "daily" ? "日报" : "周报"}
活动记录数: ${metrics.recordCount}
记录总时长: ${fmtHours(metrics.trackedMinutes)}
完成任务数: ${metrics.tasksCompleted}
新建任务数: ${metrics.tasksCreated}
平均精力: ${metrics.avgEnergy ?? "无数据"}（满分5）
各类别时间投入:
${catLines || "  - 无"}
${metrics.busiestDay ? `最高产的一天: ${metrics.busiestDay}` : ""}
活动摘要列表:
${recordSummaries.length ? recordSummaries.map((s) => `  · ${s}`).join("\n") : "  · 无记录"}`;

  try {
    const text = await chatWithFallback({
      max_tokens: 700,
      messages: [
        {
          role: "system",
          content: `你是用户的私人助理，根据提供的数据撰写一份简洁、积极、有洞察的${type === "daily" ? "日报" : "周报"}。用中文，用第二人称"你"。结构：先一句话概述${periodLabel}状态，再分点说明时间投入和任务完成情况，最后给一句具体的建议或鼓励。不要编造数据里没有的内容。控制在200字以内，用 Markdown 的段落和短列表，不要加标题。`,
        },
        { role: "user", content: context },
      ],
    });
    return text.trim() || fallbackNarrative(type, metrics);
  } catch {
    return fallbackNarrative(type, metrics);
  }
}

function fallbackNarrative(type: ReportType, m: ReportMetrics): string {
  const label = type === "daily" ? "今天" : "本周";
  const top = m.categoryMinutes[0];
  return `${label}共记录了 ${m.recordCount} 项活动，累计 ${fmtHours(
    m.trackedMinutes
  )}，完成了 ${m.tasksCompleted} 个任务。${
    top ? `投入最多的是「${top.label}」（${fmtHours(top.minutes)}）。` : ""
  }继续保持节奏。`;
}

// ---- Orchestration: generate + persist ----

export async function generateAndSaveReport(
  type: ReportType,
  dateStr: string,
  generatedBy: "manual" | "auto" = "manual"
) {
  const { start, end, key } = type === "daily" ? dailyRange(dateStr) : weeklyRange(dateStr);
  const metrics = await computeMetrics(type, start, end);
  const records = await prisma.record.findMany({
    where: { startTime: { gte: start, lt: end } },
    orderBy: { startTime: "asc" },
    select: { summary: true },
  });
  const summary = await generateNarrative(
    type,
    start,
    metrics,
    records.map((r) => r.summary)
  );

  return prisma.report.upsert({
    where: { periodKey: key },
    create: {
      type,
      periodKey: key,
      periodStart: start,
      periodEnd: end,
      summary,
      metrics: JSON.stringify(metrics),
      generatedBy,
    },
    update: {
      summary,
      metrics: JSON.stringify(metrics),
      generatedBy,
      periodStart: start,
      periodEnd: end,
    },
  });
}
