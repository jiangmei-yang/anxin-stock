"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, CircleHelp, Database, FileChartColumn, RefreshCw, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { pick, useI18n } from "../i18n";

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
  deducted_net_profit?: number | null;
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
    deducted_net_profit?: number | null;
    deducted_profit_yoy?: number | null;
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

function stateMeta(state: FinancialCheck["state"], isEnglish: boolean) {
  const meta = {
    steady: { label: pick(isEnglish, "未触发异常", "No exception triggered"), icon: CheckCircle2 },
    watch: { label: pick(isEnglish, "继续观察", "Monitor"), icon: CircleHelp },
    attention: { label: pick(isEnglish, "需要核实", "Verify"), icon: AlertCircle },
    unknown: { label: pick(isEnglish, "数据不足", "Insufficient data"), icon: CircleHelp },
  };
  return meta[state];
}

function money(value: number | null, isEnglish: boolean) {
  if (value === null) return pick(isEnglish, "暂无", "N/A");
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (isEnglish && abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}bn`;
  if (isEnglish && abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}m`;
  if (isEnglish && abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}k`;
  if (!isEnglish && abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(abs >= 10_000_000_000 ? 0 : 1)} 亿`;
  if (!isEnglish && abs >= 10_000) return `${sign}${(abs / 10_000).toFixed(1)} 万`;
  return `${sign}${abs.toLocaleString(isEnglish ? "en-GB" : "zh-CN", { maximumFractionDigits: 0 })}`;
}

function percent(value: number | null, isEnglish: boolean, digits = 1) {
  return value === null ? pick(isEnglish, "暂无", "N/A") : `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function updatedAt(value: string, isEnglish: boolean) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(isEnglish ? "en-GB" : "zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function auditMeta(check: FinancialCheck, payload: FinancialPayload, isEnglish: boolean) {
  if (check.id === "cash_quality") return {
    formula: pick(isEnglish, "经营活动现金流净额 ÷ 归母净利润", "Operating cash flow ÷ attributable net profit"),
    fields: pick(isEnglish, `经营现金流 ${money(payload.headline.operating_cash_flow, false)} · 归母净利润 ${money(payload.headline.net_profit, false)}`, `Operating cash flow ${money(payload.headline.operating_cash_flow, true)} · net profit ${money(payload.headline.net_profit, true)}`),
    threshold: pick(isEnglish, "低于 0.50 需核实；0.50–0.80 继续观察", "Below 0.50: verify; 0.50–0.80: monitor"),
  };
  if (check.id === "receivables") return { formula: pick(isEnglish, "应收账款同比 − 营业收入同比", "Receivables YoY − revenue YoY"), fields: check.evidence, threshold: pick(isEnglish, "差值超过 10 个百分点需核实", "Verify when the gap exceeds 10 percentage points") };
  if (check.id === "inventory") return { formula: pick(isEnglish, "存货同比 − 营业收入同比", "Inventory YoY − revenue YoY"), fields: check.evidence, threshold: pick(isEnglish, "差值超过 15 个百分点继续观察", "Monitor when the gap exceeds 15 percentage points") };
  return { formula: pick(isEnglish, "总负债 ÷ 总资产", "Total liabilities ÷ total assets"), fields: check.evidence, threshold: pick(isEnglish, "高于 70% 需核实；仍需结合行业解释", "Above 70%: verify and compare with industry context") };
}

function checkFinding(check: FinancialCheck, isEnglish: boolean) {
  if (!isEnglish) return check.finding;
  if (check.state === "unknown") return "Unable to assess";
  if (check.id === "cash_quality") return check.state === "attention" ? "Operating cash flow is well below net profit" : check.state === "watch" ? "Cash conversion is below net profit" : "Cash conversion did not trigger the preset threshold";
  if (check.id === "receivables") return check.state === "attention" ? "Receivables grew faster than revenue" : "Receivables did not materially outgrow revenue";
  if (check.id === "inventory") return check.state === "watch" || check.state === "attention" ? "Inventory grew faster than revenue" : "Inventory did not materially outgrow revenue";
  return check.state === "attention" ? "Debt ratio is above the preset review threshold" : "Debt ratio did not trigger the preset threshold";
}

function checkEvidence(check: FinancialCheck, isEnglish: boolean) {
  if (!isEnglish) return check.evidence;
  return check.evidence
    .replace("经营现金流 / 净利润", "Operating cash flow / net profit")
    .replace("应收同比", "Receivables YoY")
    .replace("存货同比", "Inventory YoY")
    .replace("收入同比", "Revenue YoY")
    .replace("资产负债率", "Debt ratio")
    .replace("缺少经营现金流净额或净利润金额", "Operating cash flow or net profit is missing")
    .replace("缺少去年同期应收账款或营业收入", "Prior-year receivables or revenue is missing")
    .replace("缺少去年同期存货或营业收入", "Prior-year inventory or revenue is missing")
    .replace("缺少总资产或总负债", "Total assets or liabilities are missing");
}

function checkBoundary(check: FinancialCheck, isEnglish: boolean) {
  if (!isEnglish) return check.why_it_matters;
  if (check.id === "cash_quality") return "Compare receivables, inventory, seasonality and the industry's settlement cycle before interpreting cash conversion.";
  if (check.id === "receivables") return "A large gap needs confirmation in the notes; a non-trigger does not eliminate credit or collection risk.";
  if (check.id === "inventory") return "Inventory growth can reflect stocking or sales pressure. Review the mix, cycle and impairment provisions.";
  return "Debt needs industry context and a review of interest costs, maturity and cash flow; the ratio alone is not a conclusion.";
}

function MetricTrend({ values, label, isEnglish }: { values: Array<number | null | undefined>; label: string; isEnglish: boolean }) {
  const usable = values.map((value) => typeof value === "number" && Number.isFinite(value) ? value : null);
  const known = usable.filter((value): value is number => value !== null);
  if (known.length < 2) return <span className="metric-trend-empty">{pick(isEnglish, "趋势数据不足", "Not enough trend data")}</span>;
  const minimum = Math.min(...known);
  const maximum = Math.max(...known);
  const spread = Math.max(maximum - minimum, 1);
  const path = usable.map((value, index) => value === null ? null : `${index === 0 ? "M" : "L"}${(index / Math.max(usable.length - 1, 1) * 112).toFixed(1)} ${(27 - (value - minimum) / spread * 22).toFixed(1)}`).filter(Boolean).join(" ");
  return <svg className="metric-trend" viewBox="0 0 112 30" role="img" aria-label={pick(isEnglish, `${label}最近报告期趋势`, `${label} trend across recent reports`)} preserveAspectRatio="none"><path d={path} /></svg>;
}

export function FinancialHealthPanel({ code, name, judgment }: { code: string; name: string; judgment?: { reason?: string; invalidation?: string; reviewedAt?: string } }) {
  const { isEnglish } = useI18n();
  const [snapshot, setSnapshot] = useState<{ requestedCode: string; payload?: FinancialPayload; error?: string }>({ requestedCode: code });
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/financial/${code}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as FinancialPayload & { message?: string; detail?: string };
        if (!response.ok) throw new Error(result.message || result.detail || pick(isEnglish, "暂时无法读取财报", "Financial statements are temporarily unavailable"));
        setSnapshot({ requestedCode: code, payload: result });
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setSnapshot({ requestedCode: code, error: reason instanceof Error ? reason.message : pick(isEnglish, "暂时无法读取财报", "Financial statements are temporarily unavailable") });
      });
    return () => controller.abort();
  }, [code, reloadKey, isEnglish]);

  const current = snapshot.requestedCode === code ? snapshot : { requestedCode: code };
  const payload = current.payload;
  const error = current.error ?? "";

  const chartPeriods = useMemo(() => payload?.periods.slice(0, 5).reverse() ?? [], [payload]);
  const chartMax = useMemo(() => Math.max(1, ...chartPeriods.flatMap((period) => [Math.abs(period.net_profit ?? 0), Math.abs(period.operating_cash_flow ?? 0)])), [chartPeriods]);

  if (error) {
    return <section className="financial-empty"><FileChartColumn /><div><strong>{pick(isEnglish, `${name} 的财报体检暂未完成`, `${name} financial checks are unavailable`)}</strong><p>{error}</p><small>{pick(isEnglish, "系统没有用演示数据或 AI 猜测填补缺失结果。", "Missing results are not replaced with demo data or AI guesses.")}</small></div><Button variant="outline" onClick={() => { setSnapshot({ requestedCode: code }); setReloadKey((value) => value + 1); }}><RefreshCw data-icon="inline-start" />{pick(isEnglish, "重试", "Retry")}</Button></section>;
  }
  if (!payload) {
    return <section className="financial-loading"><span className="financial-loader" /><div><strong>{pick(isEnglish, "正在读取三张财务报表", "Reading the three financial statements")}</strong><p>{pick(isEnglish, "按相同报告日合并资产负债表、利润表和现金流量表，通常需要数秒。", "The balance sheet, income statement and cash-flow statement are matched by reporting date.")}</p></div></section>;
  }

  const attentionChecks = payload.checks.filter((check) => check.state === "attention" || check.state === "watch");
  const metrics = [
    { label: pick(isEnglish, "营业收入", "Revenue"), value: money(payload.headline.revenue, isEnglish), change: percent(payload.headline.revenue_yoy, isEnglish), values: chartPeriods.map((period) => period.revenue) },
    { label: pick(isEnglish, "归母净利润", "Attributable net profit"), value: money(payload.headline.net_profit, isEnglish), change: percent(payload.headline.profit_yoy, isEnglish), values: chartPeriods.map((period) => period.net_profit) },
    { label: pick(isEnglish, "扣非净利润", "Recurring net profit"), value: money(payload.headline.deducted_net_profit ?? null, isEnglish), change: percent(payload.headline.deducted_profit_yoy ?? null, isEnglish), values: chartPeriods.map((period) => period.deducted_net_profit) },
    { label: pick(isEnglish, "经营现金流", "Operating cash flow"), value: money(payload.headline.operating_cash_flow, isEnglish), change: payload.headline.cash_conversion === null ? pick(isEnglish, "转化率暂无", "Conversion N/A") : pick(isEnglish, `利润转化 ${payload.headline.cash_conversion.toFixed(2)}×`, `Profit conversion ${payload.headline.cash_conversion.toFixed(2)}×`), values: chartPeriods.map((period) => period.operating_cash_flow) },
  ];

  return (
    <section className="financial-health">
      <header className="financial-health-header">
        <div><span className="financial-source-line"><Database />{payload.data_status.source}<i />{pick(isEnglish, "更新于", "Updated")} {updatedAt(payload.data_status.updated_at, isEnglish)}</span><h2>{name} · {payload.report_date} {pick(isEnglish, "财报体检", "financial health")}</h2><p>{pick(isEnglish, "同报告期勾稽利润、现金流、应收、存货和负债。", "Cross-check profit, cash flow, receivables, inventory and debt for the same reporting period.")}</p></div>
        <div className="financial-coverage"><strong>{payload.coverage.known_checks}/{payload.coverage.total_checks}</strong><span>{pick(isEnglish, "规则可判断", "checks available")}</span></div>
      </header>

      {payload.data_status.is_demo && <div className="financial-demo-warning"><AlertCircle /><span><strong>{pick(isEnglish, "当前是演示财务数据", "Demo financial data")}</strong>{pick(isEnglish, "不能用于判断真实公司；请等待公开报表服务恢复。", "Do not use it to assess a real company. Wait for the public source to recover.")}</span></div>}

      <section className={attentionChecks.length ? "financial-verdict attention" : "financial-verdict steady"}><span>{attentionChecks.length ? <AlertCircle /> : <CheckCircle2 />}</span><div><small>{pick(isEnglish, "本期规则检查", "Current-period rule checks")}</small><h3>{attentionChecks.length ? pick(isEnglish, `${attentionChecks.length} 项需要展开核实`, `${attentionChecks.length} checks need review`) : pick(isEnglish, "未触发四项预设异常线", "No preset exception threshold triggered")}</h3><p>{attentionChecks.length ? attentionChecks.map((check) => `${check.id === "cash_quality" ? pick(isEnglish, check.title, "Cash conversion") : check.id === "receivables" ? pick(isEnglish, check.title, "Receivables pressure") : check.id === "inventory" ? pick(isEnglish, check.title, "Inventory movement") : pick(isEnglish, check.title, "Debt pressure")}: ${checkFinding(check, isEnglish)}`).join(" · ") : pick(isEnglish, "这只表示当前四条规则未触发，仍需结合行业、附注和公司经营解释。", "This only means the four rules did not trigger. Industry context, notes and operations still matter.")}</p></div><div><strong>{payload.report_date}</strong><small>{pick(isEnglish, "最新报告期", "Latest report")}</small></div></section>

      {judgment?.reason && <section className="financial-judgment-link"><div><span>{pick(isEnglish, "与你最近记录的判断", "Your latest recorded thesis")}</span><strong>{judgment.reason}</strong><small>{judgment.reviewedAt ?? pick(isEnglish, "已保存", "Saved")}</small></div><div><span>{pick(isEnglish, "失效条件", "Invalidation condition")}</span><strong>{judgment.invalidation || pick(isEnglish, "尚未记录", "Not recorded")}</strong><small>{attentionChecks.length ? pick(isEnglish, `当前有 ${attentionChecks.length} 项财务异常需要人工对照；系统不自动判定支持或推翻。`, `${attentionChecks.length} financial checks require manual comparison; the system does not automatically confirm or reject the thesis.`) : pick(isEnglish, "当前规则结果不足以自动证明判断成立。", "These rule results are not sufficient to prove the thesis.")}</small></div></section>}

      <div className="financial-headlines">{metrics.map((metric) => <article key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small className={metric.change.startsWith("−") ? "down" : ""}>{metric.change}{metric.change === pick(isEnglish, "暂无", "N/A") ? pick(isEnglish, " · 源未返回", " · source unavailable") : metric.change.includes("转化") || metric.change.includes("conversion") ? "" : pick(isEnglish, " 同比", " YoY")}</small><MetricTrend values={metric.values} label={metric.label} isEnglish={isEnglish} /></article>)}</div>

      <section className="financial-check-list">
        <div className="financial-check-heading"><div><h3>{pick(isEnglish, "异常勾稽明细", "Financial statement cross-checks")}</h3><p>{pick(isEnglish, "展开可查看公式、字段、阈值和解释边界。", "Expand a check to inspect its formula, fields, threshold and interpretation boundary.")}</p></div><Badge variant="outline">{pick(isEnglish, "规则引擎 · 无需 AI Key", "Rules engine · no AI key")}</Badge></div>
        {payload.checks.map((check) => {
          const meta = stateMeta(check.state, isEnglish);
          const Icon = meta.icon;
          const audit = auditMeta(check, payload, isEnglish);
          const title = check.id === "cash_quality" ? pick(isEnglish, check.title, "Cash conversion") : check.id === "receivables" ? pick(isEnglish, check.title, "Receivables pressure") : check.id === "inventory" ? pick(isEnglish, check.title, "Inventory movement") : pick(isEnglish, check.title, "Debt pressure");
          return <details key={check.id} className={`financial-check-row ${check.state}`} open={check.state === "attention" || check.state === "watch"}><summary><span className="check-state-icon"><Icon /></span><span><b>{title}</b><small>{checkFinding(check, isEnglish)}</small></span><strong>{checkEvidence(check, isEnglish)}</strong><Badge variant="outline">{meta.label}</Badge><i /></summary><div className="financial-check-audit"><dl><div><dt>{pick(isEnglish, "公式", "Formula")}</dt><dd>{audit.formula}</dd></div><div><dt>{pick(isEnglish, "本期字段", "Current fields")}</dt><dd>{checkEvidence({ ...check, evidence: audit.fields }, isEnglish)}</dd></div><div><dt>{pick(isEnglish, "触发阈值", "Threshold")}</dt><dd>{audit.threshold}</dd></div><div><dt>{pick(isEnglish, "结果边界", "Interpretation boundary")}</dt><dd>{checkBoundary(check, isEnglish)}</dd></div><div><dt>{pick(isEnglish, "来源 / 报告期", "Source / period")}</dt><dd>{payload.data_status.source} · {payload.report_date}</dd></div></dl></div></details>;
        })}
      </section>

      <div className="financial-lower-grid">
        <section className="financial-trend-card">
          <div className="financial-section-title"><span><TrendingUp /><strong>{pick(isEnglish, "利润与现金流", "Profit and cash flow")}</strong></span><small>{pick(isEnglish, "各报告期累计值 · 不直接比较相邻柱", "Cumulative period values · adjacent bars are not directly comparable")}</small></div>
          <div className="financial-bars" role="img" aria-label={pick(isEnglish, "最近报告期净利润与经营现金流比较", "Net profit and operating cash flow across recent reports")}>
            {chartPeriods.map((period) => <div key={period.report_date} className="financial-bar-group"><div className="financial-bar-stage"><i className="profit" style={{ height: `${Math.max(4, Math.abs(period.net_profit ?? 0) / chartMax * 100)}%` }} title={pick(isEnglish, `净利润 ${money(period.net_profit, false)}`, `Net profit ${money(period.net_profit, true)}`)} /><i className="cash" style={{ height: `${Math.max(4, Math.abs(period.operating_cash_flow ?? 0) / chartMax * 100)}%` }} title={pick(isEnglish, `经营现金流 ${money(period.operating_cash_flow, false)}`, `Operating cash flow ${money(period.operating_cash_flow, true)}`)} /></div><span>{period.report_date.slice(2, 7).replace("-", "/")}</span></div>)}
          </div>
          <div className="financial-legend"><span><i className="profit" />{pick(isEnglish, "净利润", "Net profit")}</span><span><i className="cash" />{pick(isEnglish, "经营现金流", "Operating cash flow")}</span></div>
          <div className="financial-period-table"><span>{pick(isEnglish, "报告期", "Period")}</span><span>{pick(isEnglish, "营业收入", "Revenue")}</span><span>{pick(isEnglish, "归母净利润", "Net profit")}</span><span>{pick(isEnglish, "经营现金流", "Operating cash flow")}</span>{chartPeriods.slice().reverse().map((period) => <div key={period.report_date}><strong>{period.report_date}</strong><span>{money(period.revenue, isEnglish)}</span><span>{money(period.net_profit, isEnglish)}</span><span>{money(period.operating_cash_flow, isEnglish)}</span></div>)}</div>
        </section>
        <section className="financial-method-card">
          <div className="financial-section-title"><span><Database /><strong>{pick(isEnglish, "数据与口径", "Data and methodology")}</strong></span><Badge variant="outline">{payload.data_status.is_demo ? pick(isEnglish, "演示", "Demo") : pick(isEnglish, "公开报表", "Public statements")}</Badge></div>
          <dl><div><dt>{pick(isEnglish, "来源", "Source")}</dt><dd>{payload.data_status.source}</dd></div><div><dt>{pick(isEnglish, "同比方法", "YoY method")}</dt><dd>{pick(isEnglish, payload.methodology.comparison, "Year-on-year comparisons use the same reporting date; cumulative quarters are not compared with the immediately preceding quarter.")}</dd></div><div><dt>{pick(isEnglish, "现金口径", "Cash-flow method")}</dt><dd>{pick(isEnglish, payload.methodology.cash_rule, "Operating cash flow ÷ net profit; cash flow as a share of revenue is not substituted.")}</dd></div></dl>
          <div className="financial-peer-unavailable"><strong>{pick(isEnglish, "同行比较暂不展示", "Peer comparison unavailable")}</strong><p>{pick(isEnglish, "尚未取得同一行业、同一报告期、同一字段口径的完整可比样本，因此不生成假排名。", "A complete like-for-like peer sample is unavailable, so no synthetic ranking is shown.")}</p></div>
          <p>{pick(isEnglish, payload.data_status.message ?? "", "Statement fields are merged by reporting date; cumulative quarters are not comparable with standalone quarters.")}</p><small>{pick(isEnglish, payload.methodology.disclaimer, "Financial checks provide reconciliation and anomaly flags only. They are not earnings forecasts or trading advice.")}</small>
        </section>
      </div>
    </section>
  );
}
