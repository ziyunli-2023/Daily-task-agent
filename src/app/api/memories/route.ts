import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractMemories } from "@/lib/memory";

// GET /api/memories?type=project  → list active memories (optionally by type)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const where: { status: string; type?: string } = { status: "active" };
  if (type) where.type = type;

  const memories = await prisma.memory.findMany({
    where,
    orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
  });
  return NextResponse.json(memories);
}

// POST /api/memories            → trigger extraction from recent records
// POST /api/memories {manual}   → create a memory by hand
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  if (body?.title && body?.type) {
    const key = `${body.type}:${Date.now()}`;
    const memory = await prisma.memory.create({
      data: {
        key,
        type: body.type,
        title: body.title,
        content: body.content || "",
        importance: Math.min(5, Math.max(1, Number(body.importance) || 3)),
      },
    });
    return NextResponse.json(memory);
  }

  const result = await extractMemories(body?.sinceDays || 7);
  return NextResponse.json(result);
}
