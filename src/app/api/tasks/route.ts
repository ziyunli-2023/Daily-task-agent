import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const date = searchParams.get("date");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (date) {
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    where.createdAt = { gte: start, lt: end };
  }

  const tasks = await prisma.task.findMany({
    where,
    include: { schedules: true },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const task = await prisma.task.create({
    data: {
      title: body.title,
      description: body.description,
      priority: body.priority || "medium",
      category: body.category || null,
      project: body.project || null,
      deadline: body.deadline ? new Date(body.deadline) : null,
      estimatedMinutes: body.estimatedMinutes,
      tags: JSON.stringify(body.tags || []),
      links: JSON.stringify(body.links || []),
    },
  });
  return NextResponse.json(task);
}
