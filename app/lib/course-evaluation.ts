import { analyzeSocialContent, DEFAULT_PROFILE, precheckTrade } from "./personal-workbench";

type EvaluationCase = { id: string; category: string; input: string; expected: string; passed: boolean; actual: string };

const socialCases = [
  ["S01", "现在不上车就晚了，内部消息说马上翻倍", "时间压力"],
  ["S02", "老师说主力已经进场，闭眼买", "权威暗示"],
  ["S03", "晒一下收益截图，这个月已经赚了很多", "收益展示"],
  ["S04", "公司公告披露订单增长，但仍需看现金流和风险", "低"],
  ["S05", "朋友在机构，说这是最后机会", "时间压力"],
  ["S06", "大V说必涨，没有给出链接", "情绪化表达"],
  ["S07", "600519 最近很热，大家都在讨论", "证据不足"],
  ["S08", "财报显示利润增长，来源是年报，仍存在回撤风险", "低"],
  ["S09", "赶紧上车，明天就没机会", "时间压力"],
  ["S10", "我觉得会涨，但没有公告、财报或数据", "风险缺失"],
] as const;

const pretradeCases = [
  { id:"P01", input:{ amount:60000,portfolioValue:100000,currentAssetValue:20000,currentSectorValue:20000,reason:"基本面改善",holdingPeriod:"1年",exitCondition:"现金流恶化",recentChange:0,source:"self",similarAssets:[] }, expected:"超过单一持仓上限" },
  { id:"P02", input:{ amount:20000,portfolioValue:100000,currentAssetValue:0,currentSectorValue:50000,reason:"估值较低",holdingPeriod:"1年",exitCondition:"估值逻辑失效",recentChange:0,source:"self",similarAssets:[] }, expected:"超过行业上限" },
  { id:"P03", input:{ amount:10000,portfolioValue:100000,currentAssetValue:0,currentSectorValue:0,reason:"",holdingPeriod:"1年",exitCondition:"条件",recentChange:0,source:"self",similarAssets:[] }, expected:"缺少交易理由" },
  { id:"P04", input:{ amount:10000,portfolioValue:100000,currentAssetValue:0,currentSectorValue:0,reason:"现金流改善",holdingPeriod:"",exitCondition:"条件",recentChange:0,source:"self",similarAssets:[] }, expected:"缺少持有期限" },
  { id:"P05", input:{ amount:10000,portfolioValue:100000,currentAssetValue:0,currentSectorValue:0,reason:"现金流改善",holdingPeriod:"1年",exitCondition:"",recentChange:0,source:"self",similarAssets:[] }, expected:"缺少退出条件" },
  { id:"P06", input:{ amount:10000,portfolioValue:100000,currentAssetValue:0,currentSectorValue:0,reason:"朋友说马上翻倍",holdingPeriod:"1个月",exitCondition:"消息被证伪",recentChange:0,source:"friend",similarAssets:[] }, expected:"社交信息触发" },
  { id:"P07", input:{ amount:10000,portfolioValue:100000,currentAssetValue:0,currentSectorValue:0,reason:"均线突破",holdingPeriod:"1个月",exitCondition:"跌破均线",recentChange:12,source:"self",similarAssets:[] }, expected:"触发不追连续上涨规则" },
  { id:"P08", input:{ amount:10000,portfolioValue:100000,currentAssetValue:0,currentSectorValue:0,reason:"资产配置",holdingPeriod:"3年",exitCondition:"配置目标改变",recentChange:0,source:"self",similarAssets:["科技 ETF"] }, expected:"可能重复暴露" },
  { id:"P09", input:{ amount:5000,portfolioValue:100000,currentAssetValue:0,currentSectorValue:0,reason:"现金流与利润持续改善",holdingPeriod:"3年",exitCondition:"现金流连续恶化",recentChange:0,source:"self",similarAssets:[] }, expected:"通过" },
  { id:"P10", input:{ amount:5000,portfolioValue:100000,currentAssetValue:0,currentSectorValue:0,reason:"PE 低于历史中位数",holdingPeriod:"1年",exitCondition:"估值口径变化",recentChange:0,source:"self",similarAssets:[] }, expected:"估值" },
] as const;

export function runRuleSafetyBaseline() {
  const cases: EvaluationCase[] = [];
  for (const [id,input,expected] of socialCases) {
    const result=analyzeSocialContent(input);
    const actual=[result.level,...result.signals.map(item=>item.category)].join(" · ");
    cases.push({id,category:"社交内容风险",input,expected,actual,passed:actual.includes(expected)});
  }
  for (const row of pretradeCases) {
    const result=precheckTrade(row.input,DEFAULT_PROFILE);
    const actual=row.expected==="通过"?(result.canContinue?"通过":result.violations.join(" · ")):row.expected==="估值"?result.reasonType:result.violations.join(" · ");
    cases.push({id:row.id,category:"交易前规则",input:row.input.reason||"未填写理由",expected:row.expected,actual,passed:actual.includes(row.expected)});
  }
  const passed=cases.filter(item=>item.passed).length;
  return {name:"规则安全基线",version:"2026-07-23.1",runAt:new Date().toISOString(),total:cases.length,passed,failed:cases.length-passed,score:Math.round(passed/cases.length*100),cases,scope:"只验证确定性规则，不代表大语言模型质量。"};
}

