"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, CircleHelp, Database, FileChartColumn, RefreshCw, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type FinancialCheck = {
  id: string;
  title: string;
  state: "steady" | "watch" | "attention" | "unknown";
  finding: string;
  evidence: string;
  why_it_matters: string;
};

type FinancialPeriod = {
  report_date: string;
  revenue: number | null;
  net_profit: number | null;
  operating_cash_flow: number | null;
  accounts_receivable: number | null;
  inventory: number | null;
  debt_ratio: number | null;
};

type FinancialPayload = {
  code: string;
  name: string;
  report_date: string;
  headline: {
    revenue: number | null;
    revenue_yoy: number | null;
    net_profit: number | null;
    profit_yoy: number | null;
    roe: number | null;
    operating_cash_flow: number | null;
    cash_conversion: number | null;
    debt_ratio: number | null;
  };
  checks: FinancialCheck[];
  periods: FinancialPeriod[];
  coverage: { known_checks: number; total_checks: number };
  data_status: { source: string; is_demo: boolean; updated_at: string; message?: string };
  methodology: { comparison: string; cash_rule: string; disclaimer: string };
};

const stateMeta = {
  steady: { label: "未触发异常", icon: CheckCircle2 },
  watch: { label: "继续观察", icon: CircleHelp },
  attention: { label: "需要核实", icon: AlertCircle },
  unknown: { label: "数据不足", icon: CircleHelp },
};

function money(value: number | null) {
  if (value === null) return "暂无";
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(abs >= 10_000_000_000 ? 0 : 1)} 亿`;
  if (abs >= 10_000) return `${sign}${(abs / 10_000).toFixed(1)} 万`;
  return `${sign}${abs.toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`;
}

function percent(value: number | null, digits = 1) {
  return value === null ? "暂无" : `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

export function FinancialHealthPanel({ code, name }: { code: string; name: string }) {
  const [snapshot, setSnapshot] = useState<{ requestedCode: string; payload?: FinancialPayload; error?: string }>({ requestedCode: code });
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/financial/${code}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as FinancialPayload & { message?: string; detail?: string };
        if (!response.ok) throw new Error(result.message || result.detail || "暂时无法读取财报");
        setSnapshot({ requestedCode: code, payload: result });
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setSnapshot({ requestedCode: code, error: reason instanceof Error ? reason.message : "暂时无法读取财报" });
      });
    return () => controller.abort();
  }, [code, reloadKey]);

  const current = snapshot.requestedCode === code ? snapshot : { requestedCode: code };
  const payload = current.payload;
  const error = current.error ?? "";

  const chartPeriods = useMemo(() => payload?.periods.slice(0, 5).reverse() ?? [], [payload]);
  const chartMax = useMemo(() => Math.max(1, ...chartPeriods.flatMap((period) => [Math.abs(period.net_profit ?? 0), Math.abs(period.operating_cash_flow ?? 0)])), [chartPeriods]);

  if (error) {
    return <section className="financial-empty"><FileChartColumn /><div><strong>{name} 的财报体检暂未完成</strong><p>{error}</p><small>系统没有用演示数据或 AI 猜测填补缺失结果。</small></div><Button variant="outline" onClick={() => { setSnapshot({ requestedCode: code }); setReloadKey((value) => value + 1); }}><RefreshCw data-icon="inline-start" />重试</Button></section>;
  }
  if (!payload) {
    return <section className="financial-loading"><span className="financial-loader" /><div><strong>正在读取三张财务报表</strong><p>按相同报告日合并资产负债表、利润表和现金流量表，通常需要数秒。</p></div></section>;
  }

  return (
    <section className="financial-health">
      <header className="financial-health-header">
        <div><span className="eyebrow">FINANCIAL HEALTH · {payload.report_date}</span><h2>四项财报勾稽</h2><p>先看异常是否成立，再决定要不要打开财报附注。</p></div>
        <div className="financial-coverage"><strong>{payload.coverage.known_checks}/{payload.coverage.total_checks}</strong><span>可判断项目</span></div>
      </header>

      {payload.data_status.is_demo && <div className="financial-demo-warning"><AlertCircle /><span><strong>当前是演示财务数据</strong>不能用于判断真实公司；请等待公开报表服务恢复。</span></div>}

      <div className="financial-headlines">
        <article><span>营业收入</span><strong>{money(payload.headline.revenue)}</strong><small className={(payload.headline.revenue_yoy ?? 0) < 0 ? "down" : ""}>{percent(payload.headline.revenue_yoy)} 同比</small></article>
        <article><span>净利润</span><strong>{money(payload.headline.net_profit)}</strong><small className={(payload.headline.profit_yoy ?? 0) < 0 ? "down" : ""}>{percent(payload.headline.profit_yoy)} 同比</small></article>
        <article><span>经营现金流</span><strong>{money(payload.headline.operating_cash_flow)}</strong><small>{payload.headline.cash_conversion === null ? "转化率暂无" : `利润转化 ${payload.headline.cash_conversion.toFixed(2)}×`}</small></article>
        <article><span>资产负债率</span><strong>{payload.headline.debt_ratio === null ? "暂无" : `${payload.headline.debt_ratio.toFixed(1)}%`}</strong><small>行业差异需另行比较</small></article>
      </div>

      <div className="financial-check-grid">
        {payload.checks.map((check) => {
          const meta = stateMeta[check.state];
          const Icon = meta.icon;
          return <article key={check.id} className={`financial-check ${check.state}`}><div className="financial-check-top"><span><Icon /><b>{check.title}</b></span><Badge variant="outline">{meta.label}</Badge></div><strong>{check.finding}</strong><p>{check.evidence}</p><small>{check.why_it_matters}</small></article>;
        })}
      </div>

      <div className="financial-lower-grid">
        <section className="financial-trend-card">
          <div className="financial-section-title"><span><TrendingUp /><strong>利润与现金流</strong></span><small>亿元 · 各报告期累计值</small></div>
          <div className="financial-bars" role="img" aria-label="最近报告期净利润与经营现金流比较">
            {chartPeriods.map((period) => <div key={period.report_date} className="financial-bar-group"><div className="financial-bar-stage"><i className="profit" style={{ height: `${Math.max(4, Math.abs(period.net_profit ?? 0) / chartMax * 100)}%` }} title={`净利润 ${money(period.net_profit)}`} /><i className="cash" style={{ height: `${Math.max(4, Math.abs(period.operating_cash_flow ?? 0) / chartMax * 100)}%` }} title={`经营现金流 ${money(period.operating_cash_flow)}`} /></div><span>{period.report_date.slice(2, 7).replace("-", "/")}</span></div>)}
          </div>
          <div className="financial-legend"><span><i className="profit" />净利润</span><span><i className="cash" />经营现金流</span></div>
        </section>
        <section className="financial-method-card">
          <div className="financial-section-title"><span><Database /><strong>数据与口径</strong></span><Badge variant="outline">{payload.data_status.is_demo ? "演示" : "公开报表"}</Badge></div>
          <dl><div><dt>来源</dt><dd>{payload.data_status.source}</dd></div><div><dt>同比方法</dt><dd>{payload.methodology.comparison}</dd></div><div><dt>现金口径</dt><dd>{payload.methodology.cash_rule}</dd></div></dl>
          <p>{payload.data_status.message}</p><small>{payload.methodology.disclaimer}</small>
        </section>
      </div>
    </section>
  );
}
