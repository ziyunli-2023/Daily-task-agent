import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateAndSaveReport,
  dailyRange,
  weeklyRange,
  type ReportType,
} from "@/lib/report";

// GET /api/reports?type=daily&date=2026-05-29  → fetch a specific stored report (or null)
// GET /api/reports?type=daily                  → list recent stored reports of that type
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") || "daily") as ReportType;
  const date = searchParams.get("date");

  if (date) {
    const { key } = type === "daily" ? dailyRange(date) : weeklyRange(date);
    const report = await prisma.report.findUnique({ where: { periodKey: key } });
    return NextResponse.json(report);
  }

  const reports = await prisma.report.findMany({
    where: { type },
    orderBy: { periodStart: "desc" },
    take: 30,
  });
  return NextResponse.json(reports);
}

// POST /api/reports { type, date }  → generate (or regenerate) and persist
export async function POST(req: NextRequest) {
  const { type, date } = await req.json();
  if (type !== "daily" && type !== "weekly") {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }
  const dateStr = date || new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local
  const report = await generateAndSaveReport(type, dateStr, "manual");
  return NextResponse.json(report);
}
