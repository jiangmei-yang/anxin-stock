import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim().slice(0, 30) || "";
  const limit = Math.min(10, Math.max(1, Number(url.searchParams.get("limit")) || 5));
  if (!query) return NextResponse.json({ query, items: [] });

  const baseUrl = (process.env.ANXIN_API_URL || "http://127.0.0.1:8001").replace(/\/$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${baseUrl}/stocks/search?q=${encodeURIComponent(query)}&limit=${limit}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`upstream ${response.status}`);
    const payload = await response.json() as { items?: unknown[]; source?: string; is_demo?: boolean };
    return NextResponse.json({ query, items: Array.isArray(payload.items) ? payload.items : [], source: payload.source, is_demo: payload.is_demo });
  } catch (error) {
    return NextResponse.json({ query, items: [], status: "unavailable", message: error instanceof Error ? error.message : "股票搜索暂不可用" }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}
