import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chat } from "@/lib/ai";
import { buildRecallContext } from "@/lib/memory";

export async function POST(req: NextRequest) {
  const { messages, conversationId } = await req.json();

  // Use the host machine's local timezone so the AI's notion of "now" matches
  // how dates are stored (new Date("...") parses tz-less ISO as local time).
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const currentTime = new Date().toLocaleString("zh-CN", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "long",
  });

  const recallContext = await buildRecallContext();
  const aiResponse = await chat(messages, currentTime, recallContext);

  // Process actions
  for (const action of aiResponse.actions) {
    if (action.type === "create_record") {
      const d = action.data;
      await prisma.record.create({
        data: {
          rawInput: String(d.rawInput || ""),
          summary: String(d.summary || ""),
          category: String(d.category || "general"),
          startTime: new Date(String(d.startTime || new Date())),
          endTime: d.endTime ? new Date(String(d.endTime)) : null,
          energyLevel: d.energyLevel ? Number(d.energyLevel) : null,
        },
      });
    } else if (action.type === "create_task") {
      const d = action.data;
      const task = await prisma.task.create({
        data: {
          title: String(d.title || ""),
          description: d.description ? String(d.description) : null,
          priority: String(d.priority || "medium"),
          category: d.category ? String(d.category) : null,
          project: d.project ? String(d.project) : null,
          deadline: d.deadline ? new Date(String(d.deadline)) : null,
          estimatedMinutes: d.estimatedMinutes ? Number(d.estimatedMinutes) : null,
          tags: JSON.stringify(Array.isArray(d.tags) ? d.tags : []),
        },
      });
      // Auto-schedule reminder if deadline exists
      if (d.deadline) {
        const remindAt = new Date(new Date(String(d.deadline)).getTime() - 30 * 60 * 1000);
        await prisma.schedule.create({
          data: {
            taskId: task.id,
            scheduledStart: new Date(String(d.deadline)),
            remindAt: remindAt > new Date() ? remindAt : null,
          },
        });
      }
    } else if (action.type === "update_task") {
      const d = action.data;
      const taskId = d.taskId ? String(d.taskId) : "";
      const existing = taskId ? await prisma.task.findUnique({ where: { id: taskId } }) : null;
      if (existing) {
        await prisma.task.update({
          where: { id: taskId },
          data: {
            ...(d.title !== undefined && { title: String(d.title) }),
            ...(d.description !== undefined && { description: d.description ? String(d.description) : null }),
            ...(d.priority !== undefined && { priority: String(d.priority) }),
            ...(d.category !== undefined && { category: d.category ? String(d.category) : null }),
            ...(d.project !== undefined && { project: d.project ? String(d.project) : null }),
            ...(d.status !== undefined && { status: String(d.status) }),
            ...(d.estimatedMinutes !== undefined && {
              estimatedMinutes: d.estimatedMinutes ? Number(d.estimatedMinutes) : null,
            }),
            ...(d.deadline !== undefined && {
              deadline: d.deadline ? new Date(String(d.deadline)) : null,
            }),
          },
        });
        // If the deadline changed, refresh the reminder schedule.
        if (d.deadline !== undefined) {
          await prisma.schedule.deleteMany({ where: { taskId, remindSent: false } });
          if (d.deadline) {
            const dl = new Date(String(d.deadline));
            const remindAt = new Date(dl.getTime() - 30 * 60 * 1000);
            await prisma.schedule.create({
              data: { taskId, scheduledStart: dl, remindAt: remindAt > new Date() ? remindAt : null },
            });
          }
        }
      }
    } else if (action.type === "delete_task") {
      const taskId = action.data.taskId ? String(action.data.taskId) : "";
      if (taskId) {
        await prisma.task.deleteMany({ where: { id: taskId } });
      }
    }
  }

  // Save conversation
  if (conversationId) {
    const existing = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (existing) {
      const msgs = JSON.parse(existing.messages);
      msgs.push({ role: "assistant", content: aiResponse.message, timestamp: new Date() });
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { messages: JSON.stringify(msgs) },
      });
    }
  }

  return NextResponse.json(aiResponse);
}
