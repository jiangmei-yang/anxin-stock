import { NextResponse } from "next/server";

const DEFAULT_ANXIN_API_URL = "http://127.0.0.1:8001";

async function requestJson(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`upstream ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code: rawCode } = await context.params;
  const code = rawCode.trim();
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { status: "invalid", message: "请输入 6 位 A 股代码" },
      { status: 400 },
    );
  }

  const reason = new URL(request.url).searchParams.get("reason")?.trim().slice(0, 2000) || "";
  if (!reason) {
    return NextResponse.json(
      { status: "invalid", message: "请先写下需要核实的交易理由" },
      { status: 400 },
    );
  }

  const baseUrl = (process.env.ANXIN_API_URL || DEFAULT_ANXIN_API_URL).replace(/\/$/, "");
  const url = `${baseUrl}/stocks/${code}/evidence?limit=10&reason=${encodeURIComponent(reason)}`;
  try {
    const payload = await requestJson(url, 45_000);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        status: "unavailable",
        message: "公开资料检索暂时不可用。你的原始理由已保留，请稍后重试。",
        diagnostics: error instanceof Error ? error.message : "evidence unavailable",
      },
      { status: 503 },
    );
  }
}
