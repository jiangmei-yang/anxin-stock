import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { ProductToolShell } from "@/app/components/product-tool-shell";
import { QuantWorkspace } from "@/app/components/quant-workspace";
import {NaturalStrategyAssistant} from "@/app/components/natural-strategy-assistant";
import {QuantGoalRouter} from "@/app/components/quant-goal-router";

export const dynamic = "force-dynamic";

export default async function QuantPage() {
  await requireChatGPTUser("/quant");
  return <ProductToolShell active="quant" title="量化研究" description="描述目标，平台自动安排数据、规则、回测和模拟。" status="研究与模拟 · 不连接交易"><QuantGoalRouter/><details className="quant-rule-shortcut"><summary><span>已有明确条件？</span><b>直接描述均线、RSI、成交量或事件规则</b></summary><NaturalStrategyAssistant/></details><QuantWorkspace /></ProductToolShell>;
}
