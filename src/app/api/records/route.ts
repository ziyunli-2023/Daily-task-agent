import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

  const start = new Date(date);
  const end = new Date(date);
  end.setDate(end.getDate() + 1);

  const records = await prisma.record.findMany({
    where: { startTime: { gte: start, lt: end } },
    orderBy: { startTime: "asc" },
  });

  return NextResponse.json(records);
}
