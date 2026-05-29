import { NextResponse } from "next/server";
import { fireDueReminders } from "@/lib/notify";

// Manual trigger / health check for the reminder system.
export async function POST() {
  const fired = await fireDueReminders();
  return NextResponse.json({ fired });
}
