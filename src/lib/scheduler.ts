import cron from "node-cron";
import { fireDueReminders } from "@/lib/notify";
import { generateAndSaveReport } from "@/lib/report";
import { extractMemories } from "@/lib/memory";

let started = false;

function localDate(d = new Date()): string {
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD in host local tz
}

export function startScheduler() {
  if (started) return;
  started = true;

  // Reminders: every minute, fire any due notifications.
  cron.schedule("* * * * *", () => {
    fireDueReminders().catch((e) => console.error("[scheduler] notify error", e));
  });

  // Daily report: every night at 22:00, summarize today.
  cron.schedule("0 22 * * *", () => {
    generateAndSaveReport("daily", localDate(), "auto").catch((e) =>
      console.error("[scheduler] daily report error", e)
    );
  });

  // Weekly report: Sunday 22:05, summarize the week just ending.
  cron.schedule("5 22 * * 0", () => {
    generateAndSaveReport("weekly", localDate(), "auto").catch((e) =>
      console.error("[scheduler] weekly report error", e)
    );
  });

  // Memory extraction: nightly at 22:10, distill durable memories from recent records.
  cron.schedule("10 22 * * *", () => {
    extractMemories(7).catch((e) => console.error("[scheduler] memory extraction error", e));
  });

  console.log(
    "[scheduler] started — reminders (1min), daily report (22:00), weekly report (Sun 22:05), memory extraction (22:10)"
  );
}
