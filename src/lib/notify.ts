import { prisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/notifier";

// Fire any reminders due within the lookback window that haven't been sent.
// windowMs lets the cron (60s tick) and ad-hoc calls share one implementation.
export async function fireDueReminders(windowMs = 60_000): Promise<number> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + windowMs);

  const due = await prisma.schedule.findMany({
    where: {
      remindAt: { gte: new Date(now.getTime() - windowMs), lt: windowEnd },
      remindSent: false,
    },
    include: { task: true },
  });

  for (const schedule of due) {
    const when = schedule.scheduledStart
      ? schedule.scheduledStart.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
      : "";
    if (schedule.kind === "plan") {
      const endStr = schedule.scheduledEnd
        ? `–${schedule.scheduledEnd.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`
        : "";
      sendNotification("🗓️ 现在该做", `${schedule.task.title}（${when}${endStr}）`);
    } else {
      sendNotification("⏰ 任务提醒", `${schedule.task.title}${when ? ` — ${when}` : ""}`);
    }
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: { remindSent: true },
    });
  }

  return due.length;
}
