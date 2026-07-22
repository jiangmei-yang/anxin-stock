import { readUserSnapshot, writeUserSnapshot, type UserSnapshot } from "./user-snapshot";
import {
  DEFAULT_THEME,
  createWorkspace,
  previewWorkspaceChange,
  type Workspace,
} from "./personal-workbench";
import { isConfigurationRequest, pageContextFor, toCommandPreview } from "./global-assistant";
import { callAIProvider, readProviderState, type AIProviderProfile, type ServerAIProviderProfile } from "./ai-provider-catalog";
import { diagnosePublicEtfs } from "./etf-public";
import { parseQuantQuestion } from "./quant-verification";

type StoredCommand = {
  commandId: string;
  workspaceId: string;
  currentWorkspace: Workspace;
  proposedWorkspace: Workspace;
  changes: string[];
  warnings: string[];
  questions: string[];
  createdAt: string;
  expiresAt: string;
};

type AssistantSnapshot = UserSnapshot & {
  aiProviders?: AIProviderProfile[];
  aiDefaultProviderId?: string;
  aiTaskRouting?: Record<string, string>;
  workspaces?: Workspace[];
  activeWorkspaceId?: string;
  workspaceVersions?: Array<{ configId: string; workspace: Workspace; createdAt: string }>;
  workspaceAudit?: Array<{ commandId: string; intent: string; proposedChanges: string[]; status: "applied" | "cancelled"; createdAt: string; confirmedAt?: string }>;
  assistantPendingCommands?: Record<string, StoredCommand>;
};

const normalizeWorkspace = (workspace: Workspace): Workspace => ({
  ...workspace,
  description: workspace.description ?? "按自己的研究流程调整",
  theme: workspace.theme ?? DEFAULT_THEME,
  modules: workspace.modules ?? [],
});

async function snapshotOrDefault() {
  const result = await readUserSnapshot();
  if (result.status === "unauthorized") throw new Error("请先登录");
  const snapshot = (result.status === "ready" ? result.snapshot : {}) as AssistantSnapshot;
  const workspaces = snapshot.workspaces?.length ? snapshot.workspaces.map(normalizeWorkspace) : [createWorkspace("长期基本面")];
  const activeWorkspace = workspaces.find((item) => item.id === snapshot.activeWorkspaceId) ?? workspaces[0];
  return { snapshot, workspaces, activeWorkspace };
}

const ASSISTANT_SYSTEM_PROMPT = `你是安心看股的个人投资工作台助手。
你可以自然回答投资研究问题，理解自然语言，解释 ETF、持仓、财报、估值、风险和社交平台内容，也可以调用系统提供的确定性工具。
你不能执行买入、卖出、下单或自动调仓，不能预测未来涨跌、承诺收益、编造行情财报估值或把缺失数据当成事实。
工作台修改必须先生成预览并等待确认；投资规则和风险上限不得静默修改。
涉及数据时只能使用工具结果，并说明数据日期与状态；数据不足时写“暂无数据”。
不要索取或输出 API Key、券商密码、身份证、银行卡或验证码。回答自然、具体、有上下文，不要重复固定欢迎语。`;

type ConversationTurn = { role:"user"|"assistant"; content:string };

function responsePayload(input: {
  sessionId:string; type:"assistant_message"|"config_preview"|"analysis"|"clarification"|"error_message"|"risk_alert";
  content:string; intent:string; provider:ServerAIProviderProfile; preview?:ReturnType<typeof toCommandPreview>;
  toolUsed?:string|null; data?:unknown; suggestedActions?:string[]; requiresConfirmation?:boolean; fallbackAvailable?:boolean;
}) {
  const result = {
    session_id:input.sessionId,type:input.type,content:input.content,intent:input.intent,
    model_used:input.provider.model,provider_id:input.provider.providerId,tool_used:input.toolUsed??null,
    preview:input.preview??null,data:input.data??null,suggested_actions:input.suggestedActions??[],
    requires_confirmation:input.requiresConfirmation??false,fallback_available:input.fallbackAvailable??false,
    disclaimer:"本工具仅用于投资研究与风险检查，不构成投资建议、收益承诺或买卖建议。",
  };
  return {...result,message:{type:input.type,content:input.content,preview:input.preview}};
}

function portfolioTool(snapshot: AssistantSnapshot) {
  const holdings = (snapshot.holdings && typeof snapshot.holdings === "object" ? snapshot.holdings : {}) as Record<string,{name?:string;value?:number;industry?:string}>;
  const rows = Object.entries(holdings).map(([code,item])=>({code,name:item.name??code,value:Number(item.value??0),industry:item.industry??"行业待核对"})).filter((item)=>item.value>0);
  const total = rows.reduce((sum,item)=>sum+item.value,0);
  const weighted = rows.map((item)=>({...item,weight:total?item.value/total:0})).sort((left,right)=>right.weight-left.weight);
  const sectors = Object.entries(rows.reduce<Record<string,number>>((result,item)=>({...result,[item.industry]:(result[item.industry]??0)+item.value}),{})).map(([industry,value])=>({industry,weight:total?value/total:0})).sort((left,right)=>right.weight-left.weight);
  return {dataStatus:rows.length?"user_saved":"missing",calculatedAt:new Date().toISOString(),portfolioValue:total,positionCount:rows.length,largestPosition:weighted[0]??null,largestSector:sectors[0]??null,positions:weighted.slice(0,12)};
}

async function resolveTool(message:string,snapshot:AssistantSnapshot) {
  if (/(持仓|组合|仓位|集中度|行业暴露)/.test(message)) return {intent:"portfolio_analysis",toolUsed:"get_portfolio_risk",data:portfolioTool(snapshot)};
  if (/(量化|回测|历史检验|规则筛选)/.test(message)) {
    const code=message.match(/\b\d{6}\b/)?.[0];
    if(!code) return {intent:"quant_analysis",toolUsed:null,data:null,clarification:"请补充 6 位 A 股代码，以及你想核实的历史条件。"};
    return {intent:"quant_analysis",toolUsed:"parse_quant_rule",data:{dataStatus:"candidate_only",hypothesis:parseQuantQuestion(message,code)}};
  }
  if (/ETF|基金/.test(message)) {
    const code=message.match(/\b\d{6}\b/)?.[0];
    if(!code) return {intent:"etf_analysis",toolUsed:null,data:null,clarification:"请补充 6 位 ETF 代码，我会先读取公开披露再解释。"};
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),15_000);
    try{return {intent:"etf_analysis",toolUsed:"diagnose_etf_holdings",data:await diagnosePublicEtfs([{code}],controller.signal)};}
    catch{return {intent:"etf_analysis",toolUsed:"diagnose_etf_holdings",data:{dataStatus:"unavailable",code,message:"公开 ETF 持仓暂时不可用，没有使用演示数据代替。"}};}
    finally{clearTimeout(timer);}
  }
  return {intent:"conversation",toolUsed:null,data:null};
}

export async function createAssistantPreview(message: string, workspaceId?: string) {
  const { snapshot, workspaces, activeWorkspace } = await snapshotOrDefault();
  const namedWorkspace = /(切换|打开|进入)/.test(message)
    ? workspaces.find((item) => message.includes(item.name))
    : undefined;
  const current = namedWorkspace ?? workspaces.find((item) => item.id === workspaceId) ?? activeWorkspace;
  const parsed = namedWorkspace
    ? { preview: namedWorkspace, changes: [`切换到${namedWorkspace.name}`], warnings: [], questions: [], intent: "switch_workspace", canApply: true, needsConfirmation: true as const }
    : previewWorkspaceChange(current, message);
  const commandId = `cmd_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const now = new Date();
  const command: StoredCommand = {
    commandId,
    workspaceId: current.id,
    currentWorkspace: current,
    proposedWorkspace: parsed.preview,
    changes: parsed.changes,
    warnings: parsed.warnings,
    questions: parsed.questions,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
  };
  if (parsed.canApply) {
    snapshot.assistantPendingCommands = { ...(snapshot.assistantPendingCommands ?? {}), [commandId]: command };
    snapshot.workspaces = workspaces;
    snapshot.activeWorkspaceId = current.id;
    await writeUserSnapshot(snapshot);
  }
  return { parsed, commandId, current };
}

export async function handleAssistantMessage(input: {
  message: string;
  session_id?: string;
  workspace_id?: string;
  route?: string;
  selected_provider?: string;
  history?: ConversationTurn[];
}) {
  const message = input.message.trim();
  if (!message) throw new Error("请先输入你想配置或了解的内容");
  const { snapshot, activeWorkspace } = await snapshotOrDefault();
  const route = input.route?.startsWith("/") ? input.route : "/";
  const context = pageContextFor(route);
  const providerState = await readProviderState();
  const provider = providerState.providers.find((item)=>item.providerId===input.selected_provider&&item.enabled&&item.connectionStatus==="available")
    ?? providerState.providers.find((item)=>item.isDefault&&item.enabled&&item.connectionStatus==="available")
    ?? providerState.providers.find((item)=>item.providerId==="mock")!;
  const sessionId = input.session_id || `session_${crypto.randomUUID()}`;

  if (/(帮我|替我|自动).*(买入|卖出|下单|调仓)|^(买入|卖出)/.test(message)) {
    return responsePayload({sessionId,type:"risk_alert",content:"我不能执行买卖、自动交易或调仓。我可以把这笔计划带入交易前检查，核对仓位、理由和退出条件。",intent:"trade_execution_blocked",provider,suggestedActions:["进入交易前检查","检查计划后仓位"]});
  }

  if (isConfigurationRequest(message)) {
    const { parsed, commandId, current } = await createAssistantPreview(message, input.workspace_id || activeWorkspace.id);
    if (!parsed.canApply) {
      return responsePayload({sessionId,type:parsed.warnings.length?"risk_alert":"clarification",content:parsed.warnings[0]||parsed.questions[0]||"请补充要修改的模块、主题、信息密度或提醒频率。",intent:"workspace_config",provider});
    }
    const preview=toCommandPreview(commandId,current.id,parsed);
    return responsePayload({sessionId,type:"config_preview",content:"我整理了一份工作台配置变更，请确认。确认前，页面不会发生变化。",intent:"workspace_config",provider,preview,requiresConfirmation:true});
  }
  const tool=await resolveTool(message,snapshot);
  if(tool.clarification) return responsePayload({sessionId,type:"clarification",content:tool.clarification,intent:tool.intent,provider,suggestedActions:["补充代码","打开对应工具"]});
  if(provider.providerId==="mock") {
    if(tool.toolUsed) return responsePayload({sessionId,type:"analysis",content:`已完成确定性检查。${JSON.stringify(tool.data).slice(0,900)}`,intent:tool.intent,provider,toolUsed:tool.toolUsed,data:tool.data,suggestedActions:["查看计算口径","接入真实模型解释"]});
    return responsePayload({sessionId,type:"error_message",content:"当前使用本地规则模式，AI 自由对话未启用。你仍可使用持仓、ETF 和量化的确定性检查，或接入真实模型。",intent:"conversation",provider,fallbackAvailable:true,suggestedActions:["接入真实模型","继续使用规则版结果"]});
  }
  try {
    const history=(input.history??[]).slice(-10).filter((item)=>item.content.trim()).map((item)=>({role:item.role,content:item.content.slice(0,1800)}));
    const toolContext=tool.toolUsed?`\n系统工具：${tool.toolUsed}\n工具结果：${JSON.stringify(tool.data).slice(0,8000)}`:"";
    const content=await callAIProvider(provider,[{role:"system",content:ASSISTANT_SYSTEM_PROMPT},...history,{role:"user",content:`当前页面：${context.label}\n用户问题：${message.slice(0,3000)}${toolContext}`}],650);
    if(!content) throw new Error("empty");
    return responsePayload({sessionId,type:tool.toolUsed?"analysis":"assistant_message",content,intent:tool.intent,provider,toolUsed:tool.toolUsed,data:tool.data,suggestedActions:tool.toolUsed?["查看计算口径","进入交易前检查"]:[]});
  } catch {
    return responsePayload({sessionId,type:"error_message",content:`${provider.displayName} 当前暂时不可用。`,intent:tool.intent,provider,toolUsed:tool.toolUsed,data:tool.data,fallbackAvailable:true,suggestedActions:["重试","切换模型","使用规则版结果"]});
  }
}

export async function confirmAssistantCommand(commandId: string) {
  const { snapshot, workspaces } = await snapshotOrDefault();
  const command = snapshot.assistantPendingCommands?.[commandId];
  if (!command) throw new Error("配置预览不存在或已经取消");
  if (new Date(command.expiresAt).getTime() < Date.now()) {
    delete snapshot.assistantPendingCommands?.[commandId];
    await writeUserSnapshot(snapshot);
    throw new Error("配置预览已过期，请重新生成");
  }
  snapshot.workspaceVersions = [...(snapshot.workspaceVersions ?? []), { configId: `config-${Date.now()}`, workspace: command.currentWorkspace, createdAt: new Date().toISOString() }].slice(-50);
  snapshot.workspaceAudit = [...(snapshot.workspaceAudit ?? []), { commandId, intent: "update_workspace", proposedChanges: command.changes, status: "applied" as const, createdAt: command.createdAt, confirmedAt: new Date().toISOString() }].slice(-200);
  snapshot.workspaces = workspaces.map((item) => item.id === command.workspaceId ? command.proposedWorkspace : item);
  snapshot.activeWorkspaceId = command.workspaceId;
  delete snapshot.assistantPendingCommands?.[commandId];
  await writeUserSnapshot(snapshot);
  return { status: "applied", workspace: command.proposedWorkspace, applied_changes: command.changes, can_undo: true };
}

export async function cancelAssistantCommand(commandId: string) {
  const { snapshot } = await snapshotOrDefault();
  const command = snapshot.assistantPendingCommands?.[commandId];
  if (!command) throw new Error("配置预览不存在或已经取消");
  delete snapshot.assistantPendingCommands?.[commandId];
  snapshot.workspaceAudit = [...(snapshot.workspaceAudit ?? []), { commandId, intent: "update_workspace", proposedChanges: command.changes, status: "cancelled" as const, createdAt: command.createdAt }].slice(-200);
  await writeUserSnapshot(snapshot);
  return { status: "cancelled", workspace_id: command.workspaceId };
}

export async function undoAssistantWorkspace(workspaceId?: string) {
  const { snapshot, workspaces, activeWorkspace } = await snapshotOrDefault();
  const targetId = workspaceId || activeWorkspace.id;
  const versions = snapshot.workspaceVersions ?? [];
  const index = versions.findLastIndex((item) => item.workspace.id === targetId);
  if (index < 0) throw new Error("当前工作台没有可撤销的版本");
  const restored = versions[index].workspace;
  snapshot.workspaces = workspaces.map((item) => item.id === targetId ? restored : item);
  snapshot.workspaceVersions = versions.filter((_, itemIndex) => itemIndex !== index);
  snapshot.workspaceAudit = [...(snapshot.workspaceAudit ?? []), { commandId: `undo-${Date.now()}`, intent: "restore_previous", proposedChanges: ["恢复上一个已确认版本"], status: "applied" as const, createdAt: new Date().toISOString(), confirmedAt: new Date().toISOString() }].slice(-200);
  await writeUserSnapshot(snapshot);
  return { status: "restored", workspace: restored, can_undo: snapshot.workspaceVersions.some((item) => item.workspace.id === targetId) };
}

export async function assistantSessionSummary() {
  const { activeWorkspace } = await snapshotOrDefault();
  const { providers } = await readProviderState();
  return {
    session_id: `session_${crypto.randomUUID()}`,
    workspace_id: activeWorkspace.id,
    providers: providers.map((provider) => { const safe={...provider} as Partial<ServerAIProviderProfile>; delete safe.apiKey; return {...safe,available:provider.enabled&&provider.secretStatus!=="missing"}; }),
    default_provider_id: providers.find((provider) => provider.isDefault)?.providerId ?? "mock",
  };
}

export async function resetAssistantSession() {
  const { snapshot } = await snapshotOrDefault();
  snapshot.assistantPendingCommands = {};
  await writeUserSnapshot(snapshot);
  return { status: "reset", session_id: `session_${crypto.randomUUID()}` };
}
