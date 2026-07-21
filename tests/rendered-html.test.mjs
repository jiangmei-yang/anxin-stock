import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/", init = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html", ...(init.headers ?? {}) }, ...init }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the decision workbench", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>安心看股 · 决策工作台<\/title>/i);
  assert.match(html, /有交易计划时，先把金额、理由和持仓放在一起检查/);
  assert.match(html, /填写持仓后，变化才会与你有关/);
  assert.match(html, /变化收件箱/);
  assert.match(html, /还未建立的判断/);
  assert.match(html, /开始第一次审查/);
  assert.match(html, /aria-label="主导航"/);
  assert.match(html, /id="main-content"/);
});

test("runs privacy-preserving trade attribution without a Python backend", async () => {
  const csv = "日期,代码,名称,方向,价格,数量,金额,费用\n2026-01-02,600519,贵州茅台,买入,100,10,1000,1\n2026-01-03,600519,贵州茅台,卖出,110,4,440,1";
  const response = await render("/api/trade/attribution", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ file_content: csv, delimiter: "," }),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.record_count, 2);
  assert.equal(body.attribution.active_positions, 1);
  assert.equal(body.attribution.positions[0].net_quantity, 6);
  assert.equal(body.attribution.realized_pnl, 38.6);
  assert.match(body.data_status.notice, /未保存 CSV/);
});

test("server-renders native ETF and trade review workspaces", async () => {
  const [etfResponse, tradeResponse] = await Promise.all([render("/etf-tool"), render("/trade-tool")]);
  assert.equal(etfResponse.status, 200);
  assert.equal(tradeResponse.status, 200);
  const [etfHtml, tradeHtml] = await Promise.all([etfResponse.text(), tradeResponse.text()]);
  assert.match(etfHtml, /ETF 持仓诊断/);
  assert.match(etfHtml, /检查底层暴露/);
  assert.match(etfHtml, /持仓披露不是实时数据/);
  assert.doesNotMatch(etfHtml, /<iframe/i);
  assert.match(tradeHtml, /持仓交易复盘/);
  assert.match(tradeHtml, /开始复盘/);
  assert.match(tradeHtml, /仅按导入记录计算/);
  assert.doesNotMatch(tradeHtml, /<iframe/i);
});

test("keeps the daily workflow and decision loop in the product source", async () => {
  const [page, css, layout, informationRoute, stockSearchRoute, evidenceRoute, etfPage, tradePage, etfWorkspace, tradeWorkspace, etfSearchRoute, etfDiagnosisRoute, etfPublic, tradeAttributionRoute, financialPanel, financialRoute] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/information/[code]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/stocks/search/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/evidence/[code]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/etf-tool/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/trade-tool/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/etf-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/trade-review-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/etf/search/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/etf/diagnosis/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/etf-public.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/trade/attribution/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/financial-health-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/financial/[code]/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /DeskUpdate/);
  assert.match(page, /HoldingCoverage/);
  assert.match(page, /本次实际取得的公开行情和公告/);
  assert.ok(page.includes("/api/evidence/${holding.code}"));
  assert.match(page, /只显示本设备实际完成的审查/);
  assert.match(page, /DEFAULT_HOLDINGS: HoldingBook = \{\}/);
  assert.doesNotMatch(page, /const reviewRows/);
  assert.doesNotMatch(page, /const dailyChanges/);
  assert.doesNotMatch(page, /今天还有 4 条变化值得查看/);
  assert.doesNotMatch(page, /系统从 27 条行情/);
  assert.match(page, /当前资料状态/);
  assert.match(page, /价格与事件/);
  assert.match(page, /财报体检/);
  assert.match(page, /研究一个具体问题/);
  assert.match(page, /输入你想核实的说法、新闻或财务问题/);
  assert.match(page, /encodeURIComponent\(submittedQuery\)/);
  assert.match(page, /证据链/);
  assert.match(page, /下跌情景金额影响/);
  assert.match(page, /判断失效条件/);
  assert.match(page, /下次复核/);
  assert.match(page, /开始.*审查/);
  assert.match(page, /HoldingBook/);
  assert.match(page, /LOCAL_HOLDINGS_KEY/);
  assert.match(page, /安心看股-持仓备份\.csv/);
  assert.match(page, /parseHoldingCsv/);
  assert.match(page, /尚无持仓/);
  assert.match(page, /本次计划将新建仓位/);
  assert.match(page, /任何新增金额都无法使计划后仓位回到边界内/);
  assert.match(page, /研究页优先读取真实行情/);
  assert.match(page, /实时行情与历史价格已载入/);
  assert.match(page, /followedStocks\[stock\.code\] === true/);
  assert.match(page, /选择股票和准备进行的操作/);
  assert.match(page, /进入研究页后载入真实资料/);
  assert.match(page, /输入股票名称、代码或行业，例如半导体/);
  assert.match(page, /stock\.industry\.toLowerCase\(\)\.includes\(normalized\)/);
  assert.match(page, /createCodeStock/);
  assert.match(page, /从真实数据服务载入 A 股资料/);
  assert.match(page, /genericResearchProfile/);
  assert.match(page, /liveEvidence/);
  assert.match(page, /实时公开资料/);
  assert.match(page, /公开资料正在并行核实/);
  assert.match(page, /ResearchEvidenceSnapshot/);
  assert.match(page, /evidence-title-link/);
  assert.match(page, /核实这条说法/);
  assert.match(page, /本次实时公开资料/);
  assert.match(page, /ETF 诊断/);
  assert.match(page, /交易复盘/);
  assert.match(page, /pickReasonClause/);
  assert.match(page, /随你的输入更新；不把原话自动当作事实/);
  assert.match(page, /我的提醒规则/);
  assert.match(page, /parseRuleDescription/);
  assert.match(page, /LOCAL_RULES_KEY/);
  assert.match(page, /LOCAL_DECISIONS_KEY/);
  assert.match(page, /个人提醒规则已更新/);
  assert.match(page, /最近一次完整记录/);
  assert.match(page, /原始理由/);
  assert.match(page, /当前未连接单条原文/);
  assert.match(page, /固定样例行情 · 非实时数据/);
  assert.match(page, /evidence: evidenceCheck/);
  assert.match(page, /当时的证据核实/);
  assert.match(page, /证据来源链接/);
  assert.match(page, /suggestedAmount: 30000/);
  assert.match(page, /const \[reason, setReason\] = useState\(""\)/);
  assert.match(page, /本次会话草稿/);
  assert.match(page, /LOCAL_DECISION_KEY/);
  assert.match(page, /localStorage\.setItem/);
  assert.match(page, /安心看股-决策记录\.csv/);
  assert.match(page, /系统不会用样例公告填充真实证据链/);
  assert.doesNotMatch(page, /const evidenceByStock/);
  assert.doesNotMatch(page, /official_count \?\? 1/);
  assert.doesNotMatch(page, /source_count \?\? 3/);
  assert.match(page, /completeReview\("维持计划", initialAmount/);
  assert.match(page, /\/api\/information\/\$\{stock\.code\}/);
  assert.match(page, /实时行情与历史价格已载入/);
  assert.match(page, /样例回退/);
  assert.match(page, /600519/);
  assert.doesNotMatch(page, /\(46800 \+ amount\)/);
  assert.match(css, /\.change-inbox/);
  assert.match(css, /\.thesis-card/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(layout, /lang="zh-CN"/);
  assert.match(informationRoute, /fallbackHistoryUrl/);
  assert.match(informationRoute, /quoteFromHistory/);
  assert.match(informationRoute, /!result\.quote && !result\.history/);
  assert.doesNotMatch(informationRoute, /evidenceUrl/);
  assert.match(page, /正在搜索 A 股列表/);
  assert.match(page, /\/api\/stocks\/search\?q=/);
  assert.match(stockSearchRoute, /stocks\/search/);
  assert.match(stockSearchRoute, /searchapi\.eastmoney\.com/);
  assert.match(informationRoute, /web\.ifzq\.gtimg\.cn/);
  assert.match(evidenceRoute, /np-anotice-stock\.eastmoney\.com/);
  assert.match(evidenceRoute, /www\.cninfo\.com\.cn/);
  assert.match(evidenceRoute, /巨潮资讯 · 法定披露平台/);
  assert.match(evidenceRoute, /未找到不等于事实不存在/);
  assert.doesNotMatch(page, /买入建议|卖出建议|收益保证/);
  assert.match(page, /URLSearchParams\(window\.location\.search\)/);
  assert.match(etfPage, /ETFWorkspace/);
  assert.match(tradePage, /TradeReviewWorkspace/);
  assert.doesNotMatch(etfPage, /ToolFrame|iframe/);
  assert.doesNotMatch(tradePage, /ToolFrame|iframe/);
  assert.match(etfWorkspace, /持仓披露日期/);
  assert.match(etfWorkspace, /定期披露不等于当前实时持仓/);
  assert.match(etfWorkspace, /区分真实、缓存和演示数据/);
  assert.match(etfWorkspace, /当前不能把重合结果当作最新真实持仓/);
  assert.match(etfWorkspace, /取得底层股票/);
  assert.doesNotMatch(etfWorkspace, /<dt>已披露股票<\/dt>/);
  assert.match(tradeWorkspace, /不会自动填入示例记录/);
  assert.match(tradeWorkspace, /FIFO/);
  assert.match(tradeWorkspace, /signedMoney/);
  assert.match(etfSearchRoute, /没有使用演示持仓替代/);
  assert.match(etfDiagnosisRoute, /未使用演示结果替代本次诊断/);
  assert.match(etfSearchRoute, /searchPublicEtfs/);
  assert.match(etfDiagnosisRoute, /diagnosePublicEtfs/);
  assert.match(etfDiagnosisRoute, /holdings_report_date/);
  assert.match(etfDiagnosisRoute, /is_demo/);
  assert.match(etfPublic, /fundf10\.eastmoney\.com/);
  assert.match(etfPublic, /holdings_report_date/);
  assert.match(etfPublic, /定期披露，不等同于当前实时持仓/);
  assert.match(tradeAttributionRoute, /没有被替换为示例数据/);
  assert.match(financialPanel, /四项财报勾稽/);
  assert.match(financialPanel, /系统没有用演示数据或 AI 猜测填补缺失结果/);
  assert.match(financialPanel, /利润与现金流/);
  assert.match(financialRoute, /没有使用演示结果代替/);
  assert.match(financialRoute, /SINA_FINANCE_URL/);
  assert.match(financialRoute, /publicFinancialHealth/);
  assert.match(css, /\.financial-check-grid/);
});
