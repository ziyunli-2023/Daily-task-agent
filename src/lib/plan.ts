import { prisma } from "@/lib/prisma";
import { chatWithFallback } from "@/lib/llm";

const PRIORITY_LABEL: { [k: string]: string } = { urgent: "紧急", high: "高", medium: "中", low: "低" };

const WORK_START = 9; // 09:00
const WORK_END = 18; // 18:00

function todayLocal(): { y: number; m: number; d: number } {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth(), d: n.getDate() };
}

// Build a local Date for today at HH:MM.
function atToday(hhmm: string): Date | null {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const { y, m: mo, d } = todayLocal();
  return new Date(y, mo, d, Number(m[1]), Number(m[2]), 0, 0);
}

type Block = { taskId: string; title: string; start: string; end: string; priority: string };

export async function getTodayPlan() {
  const { y, m, d } = todayLocal();
  const start = new Date(y, m, d, 0, 0, 0);
  const end = new Date(y, m, d + 1, 0, 0, 0);
  const blocks = await prisma.schedule.findMany({
    where: { kind: "plan", scheduledStart: { gte: start, lt: end } },
    include: { task: true },
    orderBy: { scheduledStart: "asc" },
  });
  return blocks.map((b) => ({
    id: b.id,
    taskId: b.taskId,
    title: b.task.title,
    priority: b.task.priority,
    status: b.task.status,
    category: b.task.category,
    start: b.scheduledStart.toISOString(),
    end: b.scheduledEnd ? b.scheduledEnd.toISOString() : null,
  }));
}

export async function generateTodayPlan() {
  // Candidate tasks: still open, ordered by urgency.
  const tasks = await prisma.task.findMany({
    where: { status: { in: ["pending", "in_progress"] } },
    orderBy: [{ priority: "desc" }, { deadline: "asc" }],
    take: 30,
  });
  if (tasks.length === 0) return { blocks: [], note: "今天没有待办任务，好好休息 🌿" };

  const now = new Date();
  const fmtDl = (dt: Date | null) =>
    dt ? dt.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "无";

  const taskLines = tasks
    .map(
      (t) =>
        `- id:${t.id} | ${t.title} | 优先级:${PRIORITY_LABEL[t.priority] || t.priority} | 截止:${fmtDl(t.deadline)} | 预估:${t.estimatedMinutes || "未填"}分${t.category ? ` | 类别:${t.category}` : ""}`
    )
    .join("\n");

  const todayStr = now.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

  const prompt = `今天是 ${todayStr}。请把"今天该做的任务"合理安排进 ${WORK_START}:00–${WORK_END}:00 的时间表。

候选任务：
${taskLines}

规则：
1. 只选今天适合做的：今天截止/已逾期/高优先级的优先安排；不重要、远期的可以不排进今天。
2. 工作时间 ${WORK_START}:00 到 ${WORK_END}:00。中午 12:00–13:00 留作午餐，不排任务。
3. 按预估时长分配；没填预估的，重要任务给 60 分钟，普通给 30–45 分钟。
4. 高优先级 / 临近截止的排在上午精力好的时段。
5. 时间块之间不重叠，可留少量空隙。一个任务一个块。
6. 不要编造任务，只用上面列出的 id。

只返回 JSON：{"blocks":[{"taskId":"<id>","title":"<标题>","start":"HH:MM","end":"HH:MM","priority":"<原优先级英文>"}],"note":"一句话说明安排思路"}`;

  let parsed: { blocks?: Block[]; note?: string } = {};
  try {
    const text = await chatWithFallback({
      max_tokens: 1500,
      messages: [
        { role: "system", content: "你是擅长时间管理的私人助理，只输出 JSON。" },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });
    const match = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/({[\s\S]*})/);
    parsed = JSON.parse(match ? match[1] : text);
  } catch {
    return { blocks: [], note: "排程失败，请稍后再试" };
  }

  const validIds = new Set(tasks.map((t) => t.id));
  const blocks = (parsed.blocks || []).filter((b) => {
    if (!b || !validIds.has(b.taskId)) return false;
    const s = atToday(b.start);
    const e = atToday(b.end);
    return s && e && e.getTime() > s.getTime(); // drop zero/negative-length blocks
  });

  // Persist: clear today's existing plan, then insert new blocks (with start-time reminders).
  const { y, m, d } = todayLocal();
  const dayStart = new Date(y, m, d, 0, 0, 0);
  const dayEnd = new Date(y, m, d + 1, 0, 0, 0);
  await prisma.schedule.deleteMany({ where: { kind: "plan", scheduledStart: { gte: dayStart, lt: dayEnd } } });

  for (const b of blocks) {
    const s = atToday(b.start)!;
    const e = atToday(b.end)!;
    await prisma.schedule.create({
      data: {
        taskId: b.taskId,
        kind: "plan",
        scheduledStart: s,
        scheduledEnd: e,
        remindAt: s > now ? s : null, // remind at block start (only if still in the future)
      },
    });
  }

  return { blocks: await getTodayPlan(), note: parsed.note || "已为你安排今天的时间表" };
}
