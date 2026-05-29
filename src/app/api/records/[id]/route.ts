import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const record = await prisma.record.update({
    where: { id },
    data: {
      ...(body.summary !== undefined && { summary: body.summary }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.startTime !== undefined && { startTime: new Date(body.startTime) }),
      ...(body.endTime !== undefined && { endTime: body.endTime ? new Date(body.endTime) : null }),
      ...(body.energyLevel !== undefined && {
        energyLevel: body.energyLevel ? Number(body.energyLevel) : null,
      }),
    },
  });
  return NextResponse.json(record);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.record.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
