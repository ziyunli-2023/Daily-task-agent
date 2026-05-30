import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/plan/[id]
//  - { scheduledStart, scheduledEnd }  → move/resize the block (refreshes reminder)
//  - { complete: true }                → mark task done + auto-create an activity record
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const block = await prisma.schedule.findUnique({ where: { id }, include: { task: true } });
  if (!block) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (body.complete) {
    await prisma.task.update({ where: { id: block.taskId }, data: { status: "done" } });
    // Auto-log a record for the planned time block (plan → record loop).
    await prisma.record.create({
      data: {
        rawInput: `计划完成：${block.task.title}`,
        summary: block.task.title,
        category: block.task.category || "general",
        startTime: block.scheduledStart,
        endTime: block.scheduledEnd,
      },
    });
    await prisma.schedule.update({ where: { id }, data: { remindSent: true } });
    return NextResponse.json({ ok: true });
  }

  const start = body.scheduledStart ? new Date(body.scheduledStart) : block.scheduledStart;
  const end = body.scheduledEnd !== undefined ? (body.scheduledEnd ? new Date(body.scheduledEnd) : null) : block.scheduledEnd;
  const remindAt = start > new Date() ? start : null;
  const updated = await prisma.schedule.update({
    where: { id },
    data: { scheduledStart: start, scheduledEnd: end, remindAt, remindSent: false },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.schedule.deleteMany({ where: { id, kind: "plan" } });
  return NextResponse.json({ ok: true });
}
