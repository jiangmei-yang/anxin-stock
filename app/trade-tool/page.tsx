import { ProductToolShell } from "@/app/components/product-tool-shell";
import { TradeReviewWorkspace } from "@/app/components/trade-review-workspace";

export default function TradeToolPage() {
  return (
    <ProductToolShell
      active="trade"
      title="持仓交易复盘"
      description="按 FIFO 还原买卖、费用、未平仓数量和行为规则。"
      status="仅按导入记录计算"
    ><TradeReviewWorkspace /></ProductToolShell>
  );
}
