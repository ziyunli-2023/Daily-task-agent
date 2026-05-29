import { prisma } from "@/lib/prisma";
import { chatWithFallback } from "@/lib/llm";

export const MEMORY_TYPES = ["project", "preference", "habit", "person", "fact", "todo"] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

export const TYPE_LABEL: { [k: string]: string } = {
  project: "项目",
  preference: "偏好",
  habit: "习惯",
  person: "人物",
  fact: "事实",
  todo: "待办",
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// ---- Build context for the chat AI so it can recall the user's history ----

export async function buildRecallContext(): Promise<string> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 864e5);

  const [recentRecords, activeTasks, memories] = await Promise.all([
    prisma.record.findMany({
      where: { startTime: { gte: weekAgo } },
      orderBy: { startTime: "desc" },
      take: 40,
    }),
    prisma.task.findMany({
      where: { status: { in: ["pending", "in_progress"] } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.memory.findMany({
      where: { status: "active" },
      orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
      take: 50,
    }),
  ]);

  const fmtDate = (d: Date) =>
    d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const fmtDay = (d: Date) => d.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });

  const parts: string[] = [];

  if (memories.length) {
    parts.push(
      "## 长期记忆（关于用户的已知信息）\n" +
        memories
          .map((m) => `- [${TYPE_LABEL[m.type] || m.type}] ${m.title}：${m.content}`)
          .join("\n")
    );
  }

  if (activeTasks.length) {
    parts.push(
      "## 进行中的任务\n" +
        activeTasks
          .map(
            (t) =>
              `- ${t.title}${t.deadline ? `（截止 ${fmtDate(t.deadline)}）` : ""} [${t.priority}]`
          )
          .join("\n")
    );
  }

  if (recentRecords.length) {
    parts.push(
      "## 最近 7 天的活动记录\n" +
        recentRecords.map((r) => `- ${fmtDay(r.startTime)} ${r.summary}（${r.category}）`).join("\n")
    );
  }

  if (!parts.length) return "";
  return (
    "以下是关于用户的背景信息，回答时请充分利用这些记忆，但不要生硬复述：\n\n" +
    parts.join("\n\n")
  );
}

// ---- Extract durable memories from recent records ----

type ExtractedMemory = {
  type: MemoryType;
  title: string;
  content: string;
  importance?: number;
};

export async function extractMemories(sinceDays = 7): Promise<{ saved: number; items: ExtractedMemory[] }> {
  const since = new Date(Date.now() - sinceDays * 864e5);

  const records = await prisma.record.findMany({
    where: { startTime: { gte: since } },
    orderBy: { startTime: "asc" },
  });
  if (records.length === 0) return { saved: 0, items: [] };

  const existing = await prisma.memory.findMany({
    where: { status: "active" },
    orderBy: { updatedAt: "desc" },
    take: 60,
  });

  const recordLines = records
    .map((r) => {
      const day = r.startTime.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
      return `- ${day} [${r.category}] ${r.summary}`;
    })
    .join("\n");

  const existingLines = existing.length
    ? existing.map((m) => `- [${m.type}] ${m.title}: ${m.content}`).join("\n")
    : "（暂无）";

  const prompt = `下面是用户最近的活动记录，请从中提炼出值得长期记住的"记忆"，帮助助理日后更懂用户。

已有的记忆（避免重复，如果有更新可以输出更完整的版本，title 保持一致即可覆盖）：
${existingLines}

最近的活动记录：
${recordLines}

请提炼记忆，每条包含：
- type: 必须是 project（在做的项目）/ preference（偏好）/ habit（习惯作息）/ person（相关人物）/ fact（重要事实）/ todo（反复出现或未完成的事）之一
- title: 简短标题（5-15字）
- content: 一句话具体说明
- importance: 1-5 的重要性

只提炼真正有长期价值、能反复用到的信息，不要把一次性琐事当记忆。如果没有值得记的，返回空数组。
只返回 JSON：{"memories":[{"type":"...","title":"...","content":"...","importance":3}]}`;

  let parsed: { memories?: ExtractedMemory[] } = {};
  try {
    const text = await chatWithFallback({
      max_tokens: 1200,
      messages: [
        { role: "system", content: "你是帮助提炼用户长期记忆的助手，只输出 JSON。" },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/({[\s\S]*})/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[1] : text);
  } catch {
    return { saved: 0, items: [] };
  }

  const items = (parsed.memories || []).filter(
    (m) => m && m.title && m.content && MEMORY_TYPES.includes(m.type as MemoryType)
  );

  let saved = 0;
  for (const m of items) {
    const key = `${m.type}:${slugify(m.title)}`;
    const importance = Math.min(5, Math.max(1, Math.round(m.importance || 3)));
    await prisma.memory.upsert({
      where: { key },
      create: {
        key,
        type: m.type,
        title: m.title,
        content: m.content,
        importance,
        sourceDate: new Date(),
      },
      update: { content: m.content, importance, title: m.title, status: "active" },
    });
    saved += 1;
  }

  return { saved, items };
}
