import { ToolFrame } from "@/app/components/tool-frame";

export default function TradeToolPage() {
  return (
    <ToolFrame
      title="持仓交易复盘"
      description="导入 CSV，按 FIFO 还原买卖、费用、未平仓数量与需要复核的交易行为。"
      path="/trade-tool"
    />
  );
}
