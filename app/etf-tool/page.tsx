import { ETFWorkspace } from "@/app/components/etf-workspace";
import { ProductToolShell } from "@/app/components/product-tool-shell";

export default function ETFToolPage() {
  return (
    <ProductToolShell
      active="etf"
      title="ETF 持仓诊断"
      description="穿透定期披露持仓，识别重复股票与主题暴露。"
      status="持仓披露不是实时数据"
    ><ETFWorkspace /></ProductToolShell>
  );
}
