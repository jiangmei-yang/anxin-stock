import { readPublicProviderState } from "@/app/lib/ai-provider-catalog";

export async function GET() {
  try { const { providers, defaultProviderId } = await readPublicProviderState(); return Response.json({ providers, default_provider_id:defaultProviderId, platform_default_provider_id:"hkgai_main", fallback_provider_id:"mock" }); }
  catch (error) { return Response.json({ error:error instanceof Error?error.message:"无法读取模型设置" }, { status:401 }); }
}
