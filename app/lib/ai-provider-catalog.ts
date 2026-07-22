import { readUserSnapshot, writeUserSnapshot, type UserSnapshot } from "./user-snapshot";

export type AIProviderProfile = {
  providerId: string;
  displayName: string;
  model: string;
  enabled: boolean;
  isDefault: boolean;
  isPlatformDefault: boolean;
  secretStatus: "not_required" | "server_configured" | "missing";
  connectionStatus: "available" | "missing_configuration";
  description: string;
};

export type ServerAIProviderProfile = AIProviderProfile & {
  providerType: "mock" | "compatible" | "openai";
  baseUrl: string;
};

type AIUserSnapshot = UserSnapshot & {
  aiDefaultProviderId?: string;
  aiTaskRouting?: Record<string, string>;
};

const configured = (value?: string) => Boolean(value?.trim());

function platformCatalog(): ServerAIProviderProfile[] {
  const genericHkgai = (process.env.AI_PROVIDER === "compatible" || process.env.AI_PROVIDER === "openai")
    && (process.env.OPENAI_BASE_URL?.includes("hkchat.app") || process.env.AI_DISPLAY_NAME?.toLowerCase() === "hkgai");
  const hkgaiKey = process.env.HKGAI_API_KEY || (genericHkgai ? process.env.OPENAI_API_KEY : undefined);
  const hkgaiModel = process.env.HKGAI_MODEL || (genericHkgai ? process.env.AI_MODEL : undefined) || "";
  const hkgaiBase = process.env.HKGAI_BASE_URL || (genericHkgai ? process.env.OPENAI_BASE_URL : undefined) || "https://test-new-api.hkchat.app/v1";
  const entries: Array<Omit<ServerAIProviderProfile, "isDefault" | "isPlatformDefault" | "connectionStatus">> = [
    { providerId:"hkgai_main", displayName:"HKGAI", providerType:"compatible", baseUrl:hkgaiBase, model:hkgaiModel, enabled:true, secretStatus:configured(hkgaiKey)&&configured(hkgaiModel)?"server_configured":"missing", description:"平台默认 · OpenAI-compatible Chat API" },
    { providerId:"deepseek", displayName:"DeepSeek", providerType:"compatible", baseUrl:process.env.DEEPSEEK_BASE_URL||"https://api.deepseek.com/v1", model:process.env.DEEPSEEK_MODEL||"", enabled:true, secretStatus:configured(process.env.DEEPSEEK_API_KEY)&&configured(process.env.DEEPSEEK_MODEL)?"server_configured":"missing", description:"适合中文解释与结构化整理" },
    { providerId:"openai", displayName:"OpenAI / ChatGPT", providerType:"openai", baseUrl:process.env.OPENAI_DIRECT_BASE_URL||"https://api.openai.com/v1", model:process.env.OPENAI_DIRECT_MODEL||"", enabled:true, secretStatus:configured(process.env.OPENAI_DIRECT_API_KEY)&&configured(process.env.OPENAI_DIRECT_MODEL)?"server_configured":"missing", description:"OpenAI API 模型" },
    { providerId:"claude", displayName:"Claude", providerType:"compatible", baseUrl:process.env.CLAUDE_BASE_URL||"", model:process.env.CLAUDE_MODEL||"", enabled:true, secretStatus:configured(process.env.CLAUDE_API_KEY)&&configured(process.env.CLAUDE_BASE_URL)&&configured(process.env.CLAUDE_MODEL)?"server_configured":"missing", description:"需通过服务器端兼容接口连接" },
    { providerId:"ollama", displayName:"Ollama", providerType:"compatible", baseUrl:process.env.OLLAMA_BASE_URL||"", model:process.env.OLLAMA_MODEL||"", enabled:true, secretStatus:configured(process.env.OLLAMA_BASE_URL)&&configured(process.env.OLLAMA_MODEL)?"not_required":"missing", description:"部署服务器可访问的本地模型" },
    { providerId:"custom", displayName:"自定义兼容接口", providerType:"compatible", baseUrl:process.env.CUSTOM_AI_BASE_URL||"", model:process.env.CUSTOM_AI_MODEL||"", enabled:true, secretStatus:configured(process.env.CUSTOM_AI_API_KEY)&&configured(process.env.CUSTOM_AI_BASE_URL)&&configured(process.env.CUSTOM_AI_MODEL)?"server_configured":"missing", description:"由管理员配置的 OpenAI-compatible 服务" },
    { providerId:"mock", displayName:"Mock / 本地规则模式", providerType:"mock", baseUrl:"", model:"mock", enabled:true, secretStatus:"not_required", description:"确定性规则 + Mock 文本解释，不需要密钥" },
  ];
  return entries.map((item) => ({ ...item, isDefault:false, isPlatformDefault:item.providerId==="hkgai_main", connectionStatus:item.secretStatus==="missing"?"missing_configuration":"available" }));
}

export function providersForSnapshot(snapshot: AIUserSnapshot = {}) {
  const catalog = platformCatalog();
  const preferred = snapshot.aiDefaultProviderId;
  const selected = catalog.find((item) => item.providerId === preferred && item.connectionStatus === "available")
    ?? catalog.find((item) => item.isPlatformDefault && item.connectionStatus === "available")
    ?? catalog.find((item) => item.providerId === "mock")!;
  return catalog.map((item) => ({ ...item, isDefault:item.providerId===selected.providerId }));
}

function toPublicProvider(provider: ServerAIProviderProfile): AIProviderProfile {
  return {
    providerId: provider.providerId,
    displayName: provider.displayName,
    model: provider.model,
    enabled: provider.enabled,
    isDefault: provider.isDefault,
    isPlatformDefault: provider.isPlatformDefault,
    secretStatus: provider.secretStatus,
    connectionStatus: provider.connectionStatus,
    description: provider.description,
  };
}

export function publicProvidersForSnapshot(snapshot: AIUserSnapshot = {}): AIProviderProfile[] {
  return providersForSnapshot(snapshot).map(toPublicProvider);
}

export function providerKey(providerId: string) {
  if (providerId === "hkgai_main") return process.env.HKGAI_API_KEY || process.env.OPENAI_API_KEY || "";
  if (providerId === "deepseek") return process.env.DEEPSEEK_API_KEY || "";
  if (providerId === "openai") return process.env.OPENAI_DIRECT_API_KEY || "";
  if (providerId === "claude") return process.env.CLAUDE_API_KEY || "";
  if (providerId === "custom") return process.env.CUSTOM_AI_API_KEY || "";
  return "";
}

export async function readProviderState() {
  const result = await readUserSnapshot();
  if (result.status === "unauthorized") throw new Error("请先登录");
  const snapshot = (result.status === "ready" ? result.snapshot : {}) as AIUserSnapshot;
  const providers = providersForSnapshot(snapshot);
  return { snapshot, providers, defaultProviderId:providers.find((item)=>item.isDefault)?.providerId??"mock" };
}

export async function readPublicProviderState() {
  const { providers, defaultProviderId } = await readProviderState();
  return {
    providers: providers.map(toPublicProvider),
    defaultProviderId,
  };
}

export async function setUserDefaultProvider(providerId: string) {
  const { snapshot, providers } = await readProviderState();
  const target = providers.find((item) => item.providerId === providerId);
  if (!target) throw new Error("没有找到该模型");
  if (target.connectionStatus !== "available") throw new Error("该模型尚未完成服务器端配置");
  const routing = { workspace_command:providerId, trade_review:providerId, pre_trade_check:providerId, metric_explanation:providerId };
  await writeUserSnapshot({ ...snapshot, aiDefaultProviderId:providerId, aiTaskRouting:routing });
  return { success:true, provider_id:providerId, model:target.model, message:"默认模型已切换" };
}

export async function testProviderConnection(providerId: string) {
  const { providers } = await readProviderState();
  const target = providers.find((item) => item.providerId === providerId);
  if (!target) throw new Error("没有找到该模型");
  if (providerId === "mock") return { success:true, provider_id:providerId, model:"mock", latency_ms:0, message:"规则版结果可用" };
  if (target.connectionStatus !== "available") return { success:false, provider_id:providerId, model:target.model, latency_ms:0, message:`${target.displayName} 尚未配置服务器端模型名称或密钥。`, fallback_available:true };
  const started = Date.now();
  const controller = new AbortController(); const timer = setTimeout(()=>controller.abort(),12_000);
  try {
    const response = await fetch(`${target.baseUrl.replace(/\/$/,"")}/chat/completions`, { method:"POST", signal:controller.signal, headers:{"content-type":"application/json",authorization:`Bearer ${providerKey(providerId)}`}, body:JSON.stringify({model:target.model,messages:[{role:"user",content:"请只回复：连接成功"}],temperature:0,max_tokens:12}) });
    return response.ok ? { success:true, provider_id:providerId, model:target.model, latency_ms:Date.now()-started, message:"连接成功" } : { success:false, provider_id:providerId, model:target.model, latency_ms:Date.now()-started, message:`${target.displayName} 当前连接失败。`, fallback_available:true };
  } catch { return { success:false, provider_id:providerId, model:target.model, latency_ms:Date.now()-started, message:`${target.displayName} 当前连接失败。`, fallback_available:true }; }
  finally { clearTimeout(timer); }
}
