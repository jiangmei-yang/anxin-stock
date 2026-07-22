import { readUserSnapshot, writeUserSnapshot, type UserSnapshot } from "./user-snapshot";
import {
  DEFAULT_THEME,
  createWorkspace,
  previewWorkspaceChange,
  type Workspace,
} from "./personal-workbench";
import { isConfigurationRequest, pageContextFor, toCommandPreview } from "./global-assistant";

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
  aiProviders?: Array<{ providerId: string; displayName: string; baseUrl?: string; model?: string; enabled: boolean; isDefault: boolean; secretStatus: "not_required" | "server_configured" | "missing" }>;
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

function selectedModel(snapshot: AssistantSnapshot, requested?: string) {
  const providers = snapshot.aiProviders ?? [];
  const selected = providers.find((item) => item.providerId === requested && item.enabled && item.secretStatus !== "missing")
    ?? providers.find((item) => item.isDefault && item.enabled && item.secretStatus !== "missing");
  return selected?.providerId ?? "mock";
}

async function configuredModelExplanation(snapshot: AssistantSnapshot, providerId: string, pageLabel: string, message: string) {
  if (providerId === "mock" || !process.env.OPENAI_API_KEY) return null;
  const provider = snapshot.aiProviders?.find((item) => item.providerId === providerId);
  if (!provider || provider.secretStatus === "missing" || !provider.enabled) return null;
  const baseUrl = (provider.baseUrl || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = provider.model || process.env.AI_MODEL || "gpt-4.1-mini";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 260,
        messages: [
          { role: "system", content: "你是安心看股的投资决策辅助助手。只解释提供的信息，不预测涨跌，不给买卖指令，不承诺收益。数据不足时明确说明。回答简洁、具体、中文。" },
          { role: "user", content: `当前页面：${pageLabel}\n用户问题：${message.slice(0, 1200)}\n不要索取或输出 API Key、券商密码、身份证、银行卡或验证码。` },
        ],
      }),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content?.trim();
    return content ? { content, modelUsed: `${providerId}:${model}` } : null;
  } catch { return null; }
  finally { clearTimeout(timeout); }
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
}) {
  const message = input.message.trim();
  if (!message) throw new Error("请先输入你想配置或了解的内容");
  const { snapshot, activeWorkspace } = await snapshotOrDefault();
  const route = input.route?.startsWith("/") ? input.route : "/";
  const context = pageContextFor(route);
  let modelUsed = selectedModel(snapshot, input.selected_provider);
  const sessionId = input.session_id || `session_${crypto.randomUUID()}`;

  if (/(帮我|替我|自动).*(买入|卖出|下单|调仓)|^(买入|卖出)/.test(message)) {
    return {
      session_id: sessionId,
      message: { type: "error_message", content: "我不能执行买卖、自动交易或调仓。我可以帮你检查计划后的仓位、理由和待核实信息。" },
      model_used: modelUsed,
    };
  }

  if (isConfigurationRequest(message)) {
    const { parsed, commandId, current } = await createAssistantPreview(message, input.workspace_id || activeWorkspace.id);
    if (!parsed.canApply) {
      return {
        session_id: sessionId,
        message: {
          type: parsed.warnings.length ? "risk_alert" : "assistant_message",
          content: parsed.warnings[0] || parsed.questions[0] || "我还不能确定要改什么，请补充模块、主题、信息密度或提醒频率。",
        },
        model_used: modelUsed,
      };
    }
    return {
      session_id: sessionId,
      message: {
        type: "config_preview",
        content: "我整理了一份工作台配置变更。确认前，页面不会发生变化。",
        preview: toCommandPreview(commandId, current.id, parsed),
      },
      model_used: modelUsed,
    };
  }

  const answers: Record<string, string> = {
    etf: "ETF 重复暴露是指不同 ETF 持有相同或高度相似的底层股票。名称看起来分散，不代表风险来源分散。请先核对重合持仓、行业权重和披露日期。",
    trade_review: "交易纪律要分开检查仓位、买入时点、交易频率、亏损后补仓和退出条件。盈亏结果本身不能证明当时的流程是否合理。",
    opportunity: "我会先区分原文中的事实、推断、紧迫措辞和未核实信息，再检查它是否触发你的持仓或行为规则；不会根据热度预测涨跌。",
    research: "单个指标需要结合历史区间、行业口径和数据日期理解。把你正在看的指标名称发给我，我会说明它反映什么、当前数据能说明什么，以及还缺什么。",
    portfolio: "组合风险通常来自单一资产权重、行业集中和底层重复暴露。先看具体占比与个人上限，再判断风险来自仓位还是标的本身。",
    rules: "个人规则是你提前设定的提醒边界，不是产品替你决定的风险承受能力。修改比例前，需要你在规则页再次确认。",
    ai_settings: "模型只负责解释和组织语言；仓位、费用、收益与规则冲突仍由确定性代码计算。密钥只保存在服务器端，不会显示在对话或网页存储中。",
    workspace: "你可以用一句话调整模块、排序、主题、解释难度和提醒频率。每次修改都会先生成预览，只有明确确认后才应用。",
    home: "你可以从今天最需要处理的变化开始，也可以让我调整工作台、解释组合风险，或带你进入 ETF 诊断和交易前检查。",
  };
  const generated = await configuredModelExplanation(snapshot, modelUsed, context.label, message);
  if (generated) {
    modelUsed = generated.modelUsed;
    return {
      session_id: sessionId,
      message: { type: "assistant_message", content: generated.content },
      model_used: modelUsed,
    };
  }
  if (modelUsed !== "mock") modelUsed = "mock-fallback";
  return {
    session_id: sessionId,
    message: { type: "assistant_message", content: answers[context.page] ?? answers.home },
    model_used: modelUsed,
  };
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
  const { snapshot, activeWorkspace } = await snapshotOrDefault();
  const providers = snapshot.aiProviders ?? [{ providerId: "mock", displayName: "本地规则模式", enabled: true, isDefault: true, secretStatus: "not_required" as const }];
  return {
    session_id: `session_${crypto.randomUUID()}`,
    workspace_id: activeWorkspace.id,
    providers: providers.map((provider) => ({ ...provider, available: provider.enabled && provider.secretStatus !== "missing" })),
    default_provider_id: providers.find((provider) => provider.isDefault)?.providerId ?? "mock",
  };
}

export async function resetAssistantSession() {
  const { snapshot } = await snapshotOrDefault();
  snapshot.assistantPendingCommands = {};
  await writeUserSnapshot(snapshot);
  return { status: "reset", session_id: `session_${crypto.randomUUID()}` };
}
