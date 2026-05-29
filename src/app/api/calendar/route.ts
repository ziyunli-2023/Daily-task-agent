import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns activities (records) and task deadlines within [from, to] (inclusive days, local tz).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "from and to are required" }, { status: 400 });
  }

  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  end.setDate(end.getDate() + 1); // make `to` inclusive

  const [records, tasks] = await Promise.all([
    prisma.record.findMany({
      where: { startTime: { gte: start, lt: end } },
      orderBy: { startTime: "asc" },
    }),
    prisma.task.findMany({
      where: { deadline: { gte: start, lt: end } },
      orderBy: { deadline: "asc" },
    }),
  ]);

  const activities = records.map((r) => ({
    id: r.id,
    title: r.summary,
    category: r.category,
    start: r.startTime.toISOString(),
    end: r.endTime ? r.endTime.toISOString() : null,
    energyLevel: r.energyLevel,
  }));

  const taskEvents = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    status: t.status,
    deadline: t.deadline!.toISOString(),
  }));

  return NextResponse.json({ activities, tasks: taskEvents });
}
