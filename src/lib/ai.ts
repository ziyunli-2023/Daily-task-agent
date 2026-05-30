import { chatWithFallback } from "@/lib/llm";

const SYSTEM_PROMPT = `You are a personal AI assistant that helps the user record daily activities and manage tasks. You always speak Chinese.

Your capabilities:
1. **Record activities**: When the user tells you what they did, extract a structured record with time, category, and summary.
2. **Create tasks**: When the user mentions something they need to do, create a task with priority and deadline.
3. **Modify tasks**: When the user CORRECTS, RENAMES, RESCHEDULES, re-prioritizes, completes, or otherwise changes an EXISTING task, UPDATE that task — do NOT create a new one.
4. **Query / Plan**: Answer questions and suggest time slots.

You MUST respond with ONLY a valid JSON object (no markdown, no extra text) in this exact structure:
{
  "message": "Your conversational reply in Chinese",
  "actions": [
    { "type": "create_record" | "create_task" | "update_task" | "delete_task" | "none", "data": { ... } }
  ]
}

For create_record data: { "rawInput": string, "summary": string, "category": string, "startTime": ISO8601, "endTime": ISO8601 (optional), "energyLevel": 1-5 (optional) }
For create_task data: { "title": string, "description": string (optional), "priority": "low"|"medium"|"high"|"urgent", "category": string (短中文词，如 工作/生活/健康/学习), "project": string (仅当明显属于某个进行中的项目时填写，否则 null), "deadline": ISO8601 (optional), "estimatedMinutes": number (optional), "tags": string[] }
For update_task data: { "taskId": string (必填，来自背景信息"进行中的任务"列表里的 id), and ONLY the fields to change: "title"? "description"? "priority"? "category"? "project"? "deadline"? (ISO8601 或 null 表示清除) "estimatedMinutes"? "status"? ("done" 表示完成) }
For delete_task data: { "taskId": string (必填) }

CRITICAL: If the user is referring to a task that already exists (e.g. "不是X，是Y" 纠正、"把那个任务改成…"、"截止改到…"、"那个做完了"), you MUST use update_task (or delete_task) with that task's id from the background "进行中的任务" list. Never create a duplicate task for a correction.

When assigning a task's category/project, REUSE the user's existing category and project names listed in the background info when they fit.

If no action is needed (e.g. just answering a question), use a single action with type "none".
Categories for create_record: work, personal, health, learning, general.
The current time is given in each message. Infer times from relative expressions like "刚才", "上午", "下午", "明天".`;

export type AIAction =
  | { type: "create_record"; data: Record<string, unknown> }
  | { type: "create_task"; data: Record<string, unknown> }
  | { type: "update_task"; data: Record<string, unknown> }
  | { type: "delete_task"; data: Record<string, unknown> }
  | { type: "none"; data?: Record<string, unknown> };

export type AIResponse = {
  message: string;
  actions: AIAction[];
};

export async function chat(
  messages: { role: "user" | "assistant"; content: string }[],
  currentTime: string,
  recallContext = ""
): Promise<AIResponse> {
  const last = messages[messages.length - 1];
  const messagesWithTime = [
    ...messages.slice(0, -1),
    { ...last, content: `[当前时间: ${currentTime}]\n${last.content}` },
  ];

  const systemContent = recallContext
    ? `${SYSTEM_PROMPT}\n\n---\n${recallContext}`
    : SYSTEM_PROMPT;

  let text = "";
  try {
    text = await chatWithFallback({
      max_tokens: 1024,
      messages: [
        { role: "system", content: systemContent },
        ...messagesWithTime,
      ],
      response_format: { type: "json_object" },
    });
  } catch {
    return { message: "抱歉，AI 服务暂时不可用（可能被限流），请稍后再试。", actions: [] };
  }

  try {
    // Strip possible markdown fences, then parse the first JSON object.
    const jsonMatch =
      text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/({[\s\S]*})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : text;
    const parsed = JSON.parse(jsonStr) as AIResponse;
    return {
      message: parsed.message || "",
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    };
  } catch {
    return { message: text || "抱歉，我没有理解，请再说一次。", actions: [] };
  }
}
