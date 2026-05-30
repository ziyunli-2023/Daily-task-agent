import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/plan/block { taskId, start (ISO), end (ISO) }
// Manually add one task as a plan time block (e.g. dragging a task onto the grid).
export async function POST(req: NextRequest) {
  const { taskId, start, end } = await req.json();
  if (!taskId || !start) {
    return NextResponse.json({ error: "taskId and start required" }, { status: 400 });
  }
  const s = new Date(start);
  const block = await prisma.schedule.create({
    data: {
      taskId,
      kind: "plan",
      scheduledStart: s,
      scheduledEnd: end ? new Date(end) : null,
      remindAt: s > new Date() ? s : null,
    },
  });
  return NextResponse.json(block);
}
