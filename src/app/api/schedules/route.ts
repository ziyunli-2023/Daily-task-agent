import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const now = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 7);

  const schedules = await prisma.schedule.findMany({
    where: {
      scheduledStart: { gte: now, lt: end },
      remindSent: false,
    },
    include: { task: true },
    orderBy: { scheduledStart: "asc" },
  });

  return NextResponse.json(schedules);
}

// Mark reminder as sent
export async function PATCH(req: NextRequest) {
  const { id } = await req.json();
  const schedule = await prisma.schedule.update({
    where: { id },
    data: { remindSent: true },
  });
  return NextResponse.json(schedule);
}
