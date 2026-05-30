import { NextResponse } from "next/server";
import { getTodayPlan, generateTodayPlan } from "@/lib/plan";

export async function GET() {
  const blocks = await getTodayPlan();
  return NextResponse.json({ blocks });
}

export async function POST() {
  const result = await generateTodayPlan();
  return NextResponse.json(result);
}
