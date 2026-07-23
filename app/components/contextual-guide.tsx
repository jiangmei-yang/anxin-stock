"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight, CircleHelp, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type GuideStep = { title: string; body: string; target?: string; action?: { label: string; href: string } };
type Guide = { title: string; summary: string; steps: GuideStep[] };

const GUIDES: Array<{ match: (path: string) => boolean; guide: Guide }> = [
  { match: (path) => path === "/", guide: { title: "工作台", summary: "先掌握市场状态，再进入研究或检查。", steps: [
    { title: "先扫一眼市场", body: "指数和数据时间用于判断今天的市场环境，不代表买卖方向。", target: '[data-guide="market-pulse"]' },
    { title: "打开默认股票", body: "价格、区间、成交变化和事件会放在同一张图中，点击可进入完整研究。", target: '[data-guide="stock-focus"]' },
    { title: "从一个动作开始", body: "研究股票、核实消息或检查组合，选最接近你当前问题的一项。", target: '[data-guide="home-actions"]', action: { label: "看 90 秒示例", href: "/demo" } },
  ] } },
  { match: (path) => path === "/analysis", guide: { title: "股票研究", summary: "搜索股票后，按价格、事件、财务和决策影响阅读。", steps: [
    { title: "搜索代码或名称", body: "顶部搜索支持股票名称和 6 位代码，不需要先填写持仓。", target: '[data-guide="page-header"]' },
    { title: "先看变化，再看原因", body: "价格走势、公告事件与基准表现应结合阅读；时间相邻不代表因果。", target: "#main-content" },
    { title: "需要行动时再检查", body: "只有准备买入、补仓或卖出时，才进入决策验证填写金额与理由。", action: { label: "打开决策验证", href: "/analysis?view=decision" } },
  ] } },
  { match: (path) => path === "/opportunity", guide: { title: "机会检查", summary: "把一条说法拆成事实、推断和待核实来源。", steps: [
    { title: "粘贴你看到的内容", body: "可以是文字、链接或截图摘要；系统不会把讨论热度当成投资价值。", target: "#main-content" },
    { title: "补充最少背景", body: "只需说明涉及标的、来源和你为什么在意，其余可以选择“不确定”。" },
    { title: "先看结论与缺口", body: "结果会优先说明这条信息能否影响决定，以及还缺少哪些原始证据。" },
  ] } },
  { match: (path) => path === "/portfolio", guide: { title: "我的组合", summary: "用模拟或手工持仓查看集中度和重复暴露。", steps: [
    { title: "先录入最少信息", body: "股票代码和金额已经足够；不需要券商账号、成本价或密码。", target: "#main-content" },
    { title: "查看资金集中在哪里", body: "先看单一资产和行业占比，再看它们是否超过你的个人边界。" },
    { title: "从风险进入研究", body: "点击具体持仓可继续查看行情、公告和与当前组合的关系。" },
  ] } },
  { match: (path) => path === "/etf-tool", guide: { title: "ETF 诊断", summary: "ETF 名称不同，底层持仓仍可能高度重复。", steps: [
    { title: "添加 ETF", body: "搜索代码或名称，先加入一至三只你真实关注的 ETF。", target: "#tool-main" },
    { title: "检查底层重合", body: "重点看共同重仓股、行业集中度和披露日期，而不是只看基金名称。" },
    { title: "保存为观察", body: "诊断结果只用于研究和组合检查，不会直接生成调仓指令。" },
  ] } },
  { match: (path) => path === "/quant", guide: { title: "量化研究", summary: "描述想法，确认规则，再用历史数据检验。", steps: [
    { title: "用一句话描述", body: "例如：每周检查低波动 ETF，先模拟。无需选择底层量化框架。", target: "#tool-main" },
    { title: "确认机器理解", body: "检查标的、频率、条件和成本假设；模糊条件会要求确认。" },
    { title: "看稳定性而非单一收益", body: "重点比较最大回撤、样本外结果、换手率和数据质量。" },
  ] } },
  { match: (path) => path === "/trade-tool", guide: { title: "交易复盘", summary: "导入记录后，区分标的、择时、仓位和费用影响。", steps: [
    { title: "导入交易记录", body: "支持 CSV 上传或粘贴；页面提供字段示例。", target: "#tool-main" },
    { title: "先读事实归因", body: "FIFO、手续费和未平仓数量由规则计算，不交给模型猜测。" },
    { title: "再看行为模式", body: "复盘关注追高、频繁交易和集中度，不输出必须买卖的结论。" },
  ] } },
  { match: (path) => path === "/agent", guide: { title: "任务助手", summary: "说目标即可，系统会拆解任务和需要确认的修改。", steps: [
    { title: "描述你想完成什么", body: "可以说“研究我的 ETF 重复暴露”，不需要知道工具名称。", target: "#tool-main" },
    { title: "查看执行计划", body: "数据查询可以直接运行；修改工作台、规则或提醒必须先预览。" },
    { title: "确认或撤销", body: "所有界面修改都有确认、撤销和恢复默认入口。" },
  ] } },
  { match: (path) => path === "/features", guide: { title: "产品说明", summary: "查看真实能力状态，并用能力知识库准备 Pitch。", steps: [
    { title: "先看产品闭环", body: "这里说明安心看股如何把公开信息、个人持仓和行动前检查连接起来。", target: '[data-guide="capability-overview"]' },
    { title: "核对交付状态", body: "能力卡直接读取平台注册中心，区分已上线、测试中和当前不可用。", target: '[data-guide="capability-matrix"]' },
    { title: "向产品知识库提问", body: "输入组员或评委可能问的问题，回答会附能力来源、入口、版本与更新时间。", target: '[data-guide="capability-ask"]' },
  ] } },
];

const DEFAULT_GUIDE: Guide = { title: "本页指引", summary: "先确认页面用途，再完成一个最小任务。", steps: [
  { title: "确认当前页面", body: "页面顶部说明当前工具处理什么，以及数据是否可用。", target: '[data-guide="page-header"]' },
  { title: "完成一个最小输入", body: "只填写完成当前任务必须的信息，其余内容可稍后补充。", target: "main" },
  { title: "查看来源与下一步", body: "金融结论应同时显示数据来源、时间和仍然缺失的信息。" },
] };

export function ContextualGuide() {
  const pathname = usePathname();
  const guide = useMemo(() => GUIDES.find((item) => item.match(pathname))?.guide ?? DEFAULT_GUIDE, [pathname]);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    document.querySelectorAll(".guide-highlight").forEach((node) => node.classList.remove("guide-highlight"));
    if (!open) return;
    const target = guide.steps[step]?.target ? document.querySelector(guide.steps[step].target!) : null;
    if (target) { target.classList.add("guide-highlight"); target.scrollIntoView({ behavior: "smooth", block: "center" }); }
    return () => target?.classList.remove("guide-highlight");
  }, [guide, open, step]);

  const current = guide.steps[step];
  return <>
    <button className="context-guide-trigger" onClick={() => setOpen(true)} aria-label={`打开${guide.title}新手指引`}><CircleHelp /><span>本页怎么用</span></button>
    {open && <div className="context-guide-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
      <aside className="context-guide-panel" role="dialog" aria-modal="true" aria-labelledby="context-guide-title">
        <header><div><span>{guide.title}</span><h2 id="context-guide-title">{guide.summary}</h2></div><button onClick={() => setOpen(false)} aria-label="关闭指引"><X /></button></header>
        <div className="context-guide-progress" aria-label={`第 ${step + 1} 步，共 ${guide.steps.length} 步`}>{guide.steps.map((item, index) => <button key={item.title} className={index === step ? "active" : index < step ? "done" : ""} onClick={() => setStep(index)} aria-label={`第 ${index + 1} 步：${item.title}`} />)}</div>
        <section><span>第 {step + 1} 步</span><h3>{current.title}</h3><p>{current.body}</p>{current.action && <Link href={current.action.href} onClick={() => setOpen(false)}>{current.action.label}<ArrowRight /></Link>}</section>
        <footer><button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}><ArrowLeft />上一步</button>{step < guide.steps.length - 1 ? <button className="primary" onClick={() => setStep(step + 1)}>下一步<ArrowRight /></button> : <button className="primary" onClick={() => setOpen(false)}>知道了</button>}</footer>
      </aside>
    </div>}
  </>;
}
