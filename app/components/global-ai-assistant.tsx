"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Cpu,
  History,
  MessageSquareText,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ASSISTANT_SESSION_KEY,
  createAssistantSession,
  pageContextFor,
  safeContextPayload,
  type AssistantCommandPreview,
  type AssistantMessage,
  type AssistantProvider,
  type AssistantSessionState,
} from "../lib/global-assistant";

type AssistantContextValue = {
  state: AssistantSessionState;
  setOpen: (open: boolean) => void;
  setDraft: (draft: string) => void;
  send: (message?: string) => Promise<void>;
};

const AssistantContext = createContext<AssistantContextValue | null>(null);

const quickActions = [
  { label: "帮我配置工作台", prompt: "给我创建一个适合新手的投资工作台" },
  { label: "检查我的持仓", prompt: "检查当前持仓最需要核对的集中度和行业暴露" },
  { label: "分析这只 ETF", prompt: "分析 ETF 510300 的公开持仓与重复暴露" },
  { label: "我看到一条推荐", href: "/opportunity" },
];

const nowId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export function GlobalAIAssistantProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<AssistantSessionState>(() => createAssistantSession());
  const [providers, setProviders] = useState<AssistantProvider[]>([
    { providerId: "mock", displayName: "本地规则模式", enabled: true, isDefault: true, secretStatus: "not_required" },
  ]);
  const [sending, setSending] = useState(false);
  const [providerMenuOpen, setProviderMenuOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const context = useMemo(() => pageContextFor(pathname), [pathname]);

  useEffect(() => {
    let restored: Partial<AssistantSessionState> | null = null;
    try {
      const stored = sessionStorage.getItem(ASSISTANT_SESSION_KEY);
      if (stored) restored = JSON.parse(stored) as Partial<AssistantSessionState>;
    } catch { /* A malformed tab-local session should never block the product. */ }
    queueMicrotask(() => {
      if (restored) setState((current) => ({ ...current, ...restored, messages: restored?.messages?.length ? restored.messages : current.messages }));
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    sessionStorage.setItem(ASSISTANT_SESSION_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  useEffect(() => {
    queueMicrotask(() => setState((current) => current.currentRoute === pathname ? current : { ...current, currentRoute: pathname }));
  }, [pathname]);

  useEffect(() => {
    let active=true;
    const loadProviders=()=>fetch("/assistant/session", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("unavailable");
      const payload = await response.json() as { session_id?: string; workspace_id?: string; providers?: AssistantProvider[]; default_provider_id?: string };
      if (!active) return;
      if (payload.providers?.length) setProviders(payload.providers);
      setState((current) => ({
        ...current,
        sessionId: current.sessionId || payload.session_id || createAssistantSession().sessionId,
        currentWorkspaceId: payload.workspace_id || current.currentWorkspaceId,
        selectedProvider: payload.providers?.some((item) => item.providerId === current.selectedProvider && item.enabled && item.secretStatus !== "missing")
          ? current.selectedProvider
          : payload.default_provider_id || "mock",
      }));
    }).catch(() => undefined);
    void loadProviders();
    window.addEventListener("anxin:providers-updated",loadProviders);
    return()=>{active=false;window.removeEventListener("anxin:providers-updated",loadProviders)};
  }, []);

  useEffect(() => {
    if (state.open) messageEndRef.current?.scrollIntoView({ block: "end" });
  }, [state.messages, state.open]);

  const appendMessage = useCallback((message: AssistantMessage) => {
    setState((current) => ({
      ...current,
      messages: [...current.messages, message].slice(-80),
      unreadCount: current.open ? 0 : current.unreadCount + 1,
      pendingPreview: message.preview ?? current.pendingPreview,
    }));
  }, []);

  const send = useCallback(async (provided?: string) => {
    const message = (provided ?? state.draft).trim();
    if (!message || sending) return;
    appendMessage({ id: nowId("user"), type: "user_message", content: message, createdAt: new Date().toISOString() });
    setState((current) => ({ ...current, draft: "", open: true }));
    setSending(true);
    try {
      const response = await fetch("/assistant/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message,
          session_id: state.sessionId,
          workspace_id: state.currentWorkspaceId,
          route: pathname,
          context: safeContextPayload(context, state.currentWorkspaceId, state.pendingPreview?.commandId ?? null),
          selected_provider: state.selectedProvider,
          history: state.messages.filter((item) => item.type === "user_message" || item.type === "assistant_message" || item.type === "analysis").slice(-10).map((item) => ({ role:item.type === "user_message" ? "user" : "assistant", content:item.content })),
        }),
      });
      const payload = await response.json() as { type?:AssistantMessage["type"];content?:string;message?: { type?: AssistantMessage["type"]; content?: string; preview?: AssistantCommandPreview }; preview?:AssistantCommandPreview;model_used?: string; provider_id?:string;session_id?: string };
      if (!response.ok) throw new Error(payload.content || payload.message?.content || "助手暂时没有响应");
      appendMessage({
        id: nowId("assistant"),
        type: payload.type ?? payload.message?.type ?? "assistant_message",
        content: payload.content || payload.message?.content || "已收到。",
        preview: payload.preview ?? payload.message?.preview,
        createdAt: new Date().toISOString(),
      });
      if (payload.provider_id) setState((current) => ({ ...current, selectedProvider:payload.provider_id! }));
      if (payload.session_id) setState((current) => ({ ...current, sessionId: payload.session_id! }));
    } catch (error) {
      appendMessage({ id: nowId("error"), type: "error_message", content: error instanceof Error ? error.message : "助手暂时不可用，请稍后再试。", createdAt: new Date().toISOString() });
    } finally { setSending(false); }
  }, [appendMessage, context, pathname, sending, state.currentWorkspaceId, state.draft, state.messages, state.pendingPreview, state.selectedProvider, state.sessionId]);

  const confirmPreview = async (preview: AssistantCommandPreview) => {
    setSending(true);
    try {
      const response = await fetch(`/workspace/command/${encodeURIComponent(preview.commandId)}/confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmed: true }) });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message || "配置未能应用");
      setState((current) => ({ ...current, pendingPreview: null, currentWorkspaceId: preview.workspaceId }));
      appendMessage({ id: nowId("status"), type: "system_status", content: "配置已应用。你可以继续浏览，或撤销这次修改。", action: "undo", createdAt: new Date().toISOString() });
      window.dispatchEvent(new CustomEvent("anxin:snapshot-updated"));
      router.refresh();
    } catch (error) {
      appendMessage({ id: nowId("error"), type: "error_message", content: error instanceof Error ? error.message : "配置未能应用", createdAt: new Date().toISOString() });
    } finally { setSending(false); }
  };

  const cancelPreview = async (preview: AssistantCommandPreview) => {
    setSending(true);
    try {
      await fetch(`/workspace/command/${encodeURIComponent(preview.commandId)}/cancel`, { method: "POST" });
      setState((current) => ({ ...current, pendingPreview: null }));
      appendMessage({ id: nowId("status"), type: "system_status", content: "已取消，这次配置没有应用。", createdAt: new Date().toISOString() });
    } finally { setSending(false); }
  };

  const undo = async () => {
    setSending(true);
    try {
      const response = await fetch("/workspace/undo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspace_id: state.currentWorkspaceId, confirmed: true }) });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message || "没有可撤销的版本");
      appendMessage({ id: nowId("status"), type: "system_status", content: "已恢复到上一个确认版本。", createdAt: new Date().toISOString() });
      window.dispatchEvent(new CustomEvent("anxin:snapshot-updated"));
      router.refresh();
    } catch (error) {
      appendMessage({ id: nowId("error"), type: "error_message", content: error instanceof Error ? error.message : "撤销失败", createdAt: new Date().toISOString() });
    } finally { setSending(false); }
  };

  const resetConversation = async () => {
    if (state.pendingPreview && !window.confirm("当前有一项待确认配置。重置会话会取消它，是否继续？")) return;
    await fetch("/assistant/session/reset", { method: "POST" }).catch(() => undefined);
    const next = createAssistantSession();
    next.currentRoute = pathname;
    next.currentWorkspaceId = state.currentWorkspaceId;
    next.selectedProvider = state.selectedProvider;
    setState(next);
  };

  const setOpen = (open: boolean) => setState((current) => ({ ...current, open, unreadCount: open ? 0 : current.unreadCount }));
  const value = useMemo<AssistantContextValue>(() => ({ state, setOpen, setDraft: (draft) => setState((current) => ({ ...current, draft })), send }), [send, state]);
  const availableProviders = providers.filter((provider) => provider.enabled);
  const currentProvider = providers.find((provider) => provider.providerId === state.selectedProvider) ?? providers.find((provider) => provider.isDefault) ?? providers[0];

  return (
    <AssistantContext.Provider value={value}>
      <div className="global-assistant-layout" data-assistant-open={state.open ? "true" : "false"}>
        <div className="global-assistant-content">{children}</div>
        <aside className={state.open ? "global-assistant-panel open" : "global-assistant-panel"} aria-label="安心看股 AI 助手" aria-hidden={!state.open}>
          <header className="assistant-header">
            <div className="assistant-title"><span><Bot /></span><div><strong>安心看股 AI 助手</strong><small>配置工作台、理解风险，不替你交易</small></div></div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="收起 AI 助手"><PanelRightClose /></Button>
          </header>

          <section className="assistant-model-bar" aria-label="当前 AI 模型">
            <div><Cpu /><span><small>当前模型</small><strong>{currentProvider?.displayName ?? "未连接"}</strong></span><Badge variant={currentProvider?.connectionStatus === "available" || currentProvider?.secretStatus === "not_required" ? "secondary" : "outline"}>{currentProvider?.providerId === "mock" ? "自由对话未启用" : currentProvider?.connectionStatus === "available" ? "已连接" : "需要配置"}</Badge></div>
            <Button variant="outline" size="sm" onClick={() => setProviderMenuOpen((open) => !open)}>{currentProvider?.providerId === "mock" ? "接入真实模型" : "切换"}<ChevronDown data-icon="inline-end" /></Button>
          </section>

          {providerMenuOpen && <section className="assistant-provider-menu" aria-label="切换 AI 模型">
            {availableProviders.map((provider) => <button key={provider.providerId} type="button" disabled={provider.secretStatus === "missing"} className={provider.providerId === state.selectedProvider ? "active" : undefined} onClick={() => { setState((current) => ({ ...current, selectedProvider:provider.providerId })); setProviderMenuOpen(false); }}><span><strong>{provider.displayName}</strong><small>{provider.model || (provider.providerId === "mock" ? "确定性规则" : "尚未配置")}</small></span><i>{provider.providerId === state.selectedProvider ? <Check /> : provider.secretStatus === "missing" ? "未接入" : "可用"}</i></button>)}
            <Button variant="outline" size="sm" onClick={() => { setProviderMenuOpen(false); setOpen(false); router.push("/ai-settings"); }}>管理或接入模型<ChevronRight data-icon="inline-end" /></Button>
          </section>}

          <div className="assistant-context-bar">
            <div><span>当前</span><strong>{context.label}</strong></div>
            <span>{currentProvider?.model || "规则计算"}</span>
          </div>

          <div className="assistant-messages" role="log" aria-live="polite" aria-label="AI 助手对话记录">
            {state.messages.map((message, index) => (
              <article key={message.id} className={`assistant-message ${message.type}`}>
                {message.type !== "user_message" && <span className="assistant-message-icon">{message.type === "error_message" || message.type === "risk_alert" ? <CircleAlert /> : message.type === "system_status" ? <Check /> : <Bot />}</span>}
                <div>
                  <p>{message.content}</p>
                  {index === 0 && <div className="assistant-quick-actions">{quickActions.map((action) => action.href
                    ? <Button key={action.label} variant="outline" size="sm" onClick={() => router.push(action.href!)}>{action.label}<ChevronRight data-icon="inline-end" /></Button>
                    : <Button key={action.label} variant="outline" size="sm" onClick={() => void send(action.prompt)}>{action.label}</Button>)}</div>}
                  {message.preview && <ConfigPreviewCard preview={message.preview} pending={state.pendingPreview?.commandId === message.preview.commandId} disabled={sending} onConfirm={confirmPreview} onCancel={cancelPreview} onContinue={(preview) => setState((current) => ({ ...current, draft: `${preview.changes.join("，")}，另外` }))} />}
                  {message.action === "undo" && <Button variant="outline" size="sm" disabled={sending} onClick={() => void undo()}><RotateCcw data-icon="inline-start" />撤销这次修改</Button>}
                </div>
              </article>
            ))}
            {sending && <article className="assistant-message system_status"><span className="assistant-message-icon"><Sparkles /></span><div><p>正在理解你的问题……</p></div></article>}
            <div ref={messageEndRef} />
          </div>

          <div className="assistant-suggestion-row" aria-label="当前页面建议">{context.suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => setState((current) => ({ ...current, draft: suggestion }))}>{suggestion}</button>)}</div>

          <form className="assistant-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>
            <Textarea value={state.draft} onChange={(event) => setState((current) => ({ ...current, draft: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="例如：隐藏复杂 K 线，把财报放到顶部" aria-label="向 AI 助手输入" rows={2} />
            <div><button type="button" onClick={() => void resetConversation()}><History />重置会话</button><span>Enter 发送 · Shift+Enter 换行</span><Button type="submit" size="icon" disabled={!state.draft.trim() || sending} aria-label="发送"><Send /></Button></div>
          </form>
        </aside>

        {!state.open && <button className="assistant-reopen" type="button" onClick={() => setOpen(true)} aria-label="打开安心看股 AI 助手"><PanelRightOpen /><span>{state.pendingPreview ? "待确认配置" : state.unreadCount ? `${state.unreadCount} 条新消息` : "AI 助手"}</span>{state.pendingPreview && <i />}</button>}
        <button className="assistant-mobile-trigger" type="button" onClick={() => setOpen(true)}><MessageSquareText /><span>{state.pendingPreview ? "待确认配置" : "AI 助手"}</span>{state.pendingPreview && <i />}</button>
        {state.open && <button className="assistant-mobile-backdrop" type="button" onClick={() => setOpen(false)} aria-label="关闭 AI 助手" />}
      </div>
    </AssistantContext.Provider>
  );
}

function ConfigPreviewCard({ preview, pending, disabled, onConfirm, onCancel, onContinue }: {
  preview: AssistantCommandPreview;
  pending: boolean;
  disabled: boolean;
  onConfirm: (preview: AssistantCommandPreview) => void;
  onCancel: (preview: AssistantCommandPreview) => void;
  onContinue: (preview: AssistantCommandPreview) => void;
}) {
  return (
    <section className="assistant-config-preview" aria-label="待确认的工作台配置">
      <header><Settings2 /><div><strong>即将修改工作台</strong><small>{pending ? "等待你的确认" : "已处理"}</small></div>{pending && <Badge variant="secondary">待确认</Badge>}</header>
      <ul>{preview.changes.map((change) => <li key={change}><Check /><span>{change}</span></li>)}</ul>
      {preview.warnings.map((warning) => <p key={warning}><ShieldCheck />{warning}</p>)}
      {preview.questions.map((question) => <p key={question}><CircleAlert />{question}</p>)}
      {pending && <footer><Button size="sm" disabled={disabled} onClick={() => onConfirm(preview)}>确认应用</Button><Button variant="outline" size="sm" disabled={disabled} onClick={() => onCancel(preview)}>取消</Button><Button variant="ghost" size="sm" disabled={disabled} onClick={() => onContinue(preview)}>继续修改</Button></footer>}
    </section>
  );
}

export function useGlobalAIAssistant() {
  const context = useContext(AssistantContext);
  if (!context) throw new Error("useGlobalAIAssistant must be used inside GlobalAIAssistantProvider");
  return context;
}
