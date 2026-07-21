import { ToolFrame } from "@/app/components/tool-frame";

export default function ETFToolPage() {
  return (
    <ToolFrame
      title="ETF 持仓诊断"
      description="穿透公开持仓，识别多只 ETF 之间的重复股票、主题集中和数据边界。"
      path="/etf-tool"
    />
  );
}
