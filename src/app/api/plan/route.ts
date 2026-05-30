import { NextRequest, NextResponse } from "next/server";
import { getTodayPlan, generateTodayPlan } from "@/lib/plan";

export async function GET(req: NextRequest) {
  const date = new URL(req.url).searchParams.get("date") || undefined;
  const blocks = await getTodayPlan(date);
  return NextResponse.json({ blocks });
}

export async function POST() {
  const result = await generateTodayPlan();
  return NextResponse.json(result);
}
