import { NextResponse } from "next/server";

import { handleAssistantMessage } from "../../lib/assistant-server";

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const message = typeof payload.message === "string" ? payload.message.trim().slice(0, 4000) : "";
    if (!message) return NextResponse.json({ message: "请先输入内容" }, { status: 400 });
    return NextResponse.json(await handleAssistantMessage({
      message,
      session_id: typeof payload.session_id === "string" ? payload.session_id.slice(0, 120) : undefined,
      workspace_id: typeof payload.workspace_id === "string" ? payload.workspace_id.slice(0, 120) : undefined,
      route: typeof payload.route === "string" ? payload.route.slice(0, 240) : undefined,
      selected_provider: typeof payload.selected_provider === "string" ? payload.selected_provider.slice(0, 120) : undefined,
    }));
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "AI 助手暂时不可用" }, { status: 503 });
  }
}
