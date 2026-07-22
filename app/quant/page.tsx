import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { ProductToolShell } from "@/app/components/product-tool-shell";
import { QuantWorkspace } from "@/app/components/quant-workspace";

export const dynamic = "force-dynamic";

export default async function QuantPage() {
  await requireChatGPTUser("/quant");
  return <ProductToolShell active="quant" title="量化研究" description="配置规则、核验数据、运行模拟并保留审计记录。" status="研究与模拟 · 不连接交易"><QuantWorkspace /></ProductToolShell>;
}
