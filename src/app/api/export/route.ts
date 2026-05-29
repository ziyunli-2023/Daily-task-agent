import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TYPE_LABEL } from "@/lib/memory";

// GET /api/export  → download all local data as a single Markdown file (backup / memory extraction)
export async function GET() {
  const [records, tasks, memories, reports] = await Promise.all([
    prisma.record.findMany({ orderBy: { startTime: "asc" } }),
    prisma.task.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.memory.findMany({ where: { status: "active" }, orderBy: { type: "asc" } }),
    prisma.report.findMany({ orderBy: { periodStart: "asc" } }),
  ]);

  const fmt = (d: Date | null) =>
    d ? d.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

  const lines: string[] = [];
  lines.push(`# 每日助理 · 数据导出`, `导出时间：${fmt(new Date())}`, "");

  // Records grouped by day
  lines.push(`## 活动记录（${records.length}）`, "");
  const byDay: { [day: string]: typeof records } = {};
  for (const r of records) {
    const day = r.startTime.toLocaleDateString("zh-CN");
    (byDay[day] ||= []).push(r);
  }
  for (const [day, recs] of Object.entries(byDay)) {
    lines.push(`### ${day}`);
    for (const r of recs) {
      const t = r.startTime.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
      lines.push(`- ${t} **${r.summary}** _(${r.category}${r.energyLevel ? `, 精力${r.energyLevel}` : ""})_`);
    }
    lines.push("");
  }

  lines.push(`## 长期记忆（${memories.length}）`, "");
  for (const m of memories) {
    lines.push(`- **[${TYPE_LABEL[m.type] || m.type}] ${m.title}**（重要性${m.importance}）：${m.content}`);
  }
  lines.push("");

  lines.push(`## 任务（${tasks.length}）`, "");
  for (const t of tasks) {
    const mark = t.status === "done" ? "x" : " ";
    lines.push(`- [${mark}] ${t.title}${t.deadline ? `（截止 ${fmt(t.deadline)}）` : ""} _[${t.priority}]_`);
  }
  lines.push("");

  lines.push(`## 报告（${reports.length}）`, "");
  for (const rep of reports) {
    lines.push(`### ${rep.type === "daily" ? "日报" : "周报"} · ${rep.periodKey.split(":")[1]}`);
    lines.push(rep.summary, "");
  }

  const md = lines.join("\n");
  const filename = `daily-assistant-export-${new Date().toISOString().split("T")[0]}.md`;
  return new NextResponse(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
