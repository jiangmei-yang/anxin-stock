export type QuantFrequency = "manual" | "event" | "hourly" | "daily_close" | "weekly" | "monthly";
export type QuantRiskLevel = "low" | "medium" | "high";
export type QuantTaskStatus = "awaiting_confirmation" | "ready" | "running" | "completed" | "failed" | "cancelled";

export type StrategyDefinition = {
  id: string; name: string; category: "trend" | "momentum" | "mean_reversion" | "allocation" | "factor" | "event" | "custom";
  description: string; requiredData: string[]; defaultFrequency: QuantFrequency; parameters: Record<string, number | string>;
};

const strategy = (id:string,name:string,category:StrategyDefinition["category"],description:string,requiredData:string[],defaultFrequency:QuantFrequency,parameters:StrategyDefinition["parameters"]):StrategyDefinition => ({id,name,category,description,requiredData,defaultFrequency,parameters});

export const STRATEGY_REGISTRY: StrategyDefinition[] = [
  strategy("ma_trend","均线趋势","trend","用收盘价与均线关系形成研究信号",["daily_prices"],"daily_close",{fast:20,slow:60}),
  strategy("momentum","价格动量","momentum","比较一段时间的相对价格变化",["daily_prices"],"weekly",{lookback_days:60}),
  strategy("rsi_reversion","RSI 均值回归","mean_reversion","观察超买超卖后的历史变化",["daily_prices"],"daily_close",{period:14,lower:30,upper:70}),
  strategy("etf_dca","ETF 定投模拟","allocation","模拟固定周期、固定金额投入",["daily_prices"],"monthly",{amount:1000}),
  strategy("periodic_rebalance","定期再平衡","allocation","按目标权重定期恢复组合比例",["daily_prices","portfolio"],"monthly",{drift_pct:5}),
  strategy("low_volatility","低波动筛选","factor","按历史波动率进行相对筛选",["daily_prices"],"monthly",{lookback_days:120}),
  strategy("dividend","股息因子","factor","按已披露股息指标构建研究样本",["fundamentals"],"monthly",{minimum_yield_pct:3}),
  strategy("valuation_quantile","估值分位","factor","比较标的自身历史估值区间",["fundamentals"],"weekly",{maximum_quantile_pct:35}),
  strategy("sector_rotation","行业轮动观察","momentum","比较行业指数的相对强弱，不生成交易指令",["daily_prices","sector_index"],"weekly",{lookback_days:60}),
  strategy("news_event","新闻事件观察","event","把授权新闻事件与价格窗口并列核验",["authorized_news","daily_prices"],"event",{window_days:5}),
  strategy("social_sentiment","社交情绪观察","event","分析用户提供或授权样本的情绪与跟风风险",["authorized_social","daily_prices"],"hourly",{minimum_samples:20}),
  strategy("fundamental_quality","基本面质量","factor","检查盈利、现金流和负债的公开数据",["fundamentals"],"monthly",{roe_min_pct:10}),
  strategy("multi_factor","多因子研究","factor","组合多个已定义因子并检查敏感性",["daily_prices","fundamentals"],"monthly",{maximum_factors:4}),
  strategy("custom_rule","自定义规则","custom","把自然语言转换为可确认规则",["user_input"],"manual",{}),
];

export const QUANT_MODULES = ["strategy_overview","strategy_config","backtest","paper_portfolio","news","social_sentiment","fundamental_validation","portfolio_impact","risk_metrics","signal_history","strategy_comparison","sensitivity","schedule","ai_report","execution_log"] as const;
export type QuantModule = typeof QUANT_MODULES[number];

export type QuantGoalExtraction = {
  goal: string; assets: string[]; market: "A股" | "ETF" | "unknown"; frequency: QuantFrequency;
  strategyIds: string[]; dataRequirements: string[]; analysisRequirements: string[]; riskConstraints: string[];
  modules: QuantModule[]; missingInformation: string[]; warnings: string[];
};

export type QuantTask = {
  id:string; goal:string; extraction:QuantGoalExtraction; status:QuantTaskStatus; createdAt:string; updatedAt:string;
  plan:Array<{id:string;title:string;tool:string;status:"pending"|"completed"|"failed";requiresConfirmation:boolean}>;
  workspacePatch:{changes:Array<{action:"add"|"show"|"move"|"set";target:string;value?:string}>;requiresConfirmation:true};
  confirmedAt?:string; error?:string;
};

export type QuantSchedule = {id:string;taskId:string;name:string;frequency:QuantFrequency;status:"active"|"paused";nextRunAt:string|null;runnerStatus:"configured"|"unavailable";createdAt:string};
export type QuantSignal = {id:string;taskId:string;asset:string;signal:"watch"|"research"|"hold"|"reduce_risk"|"no_signal";reason:string;source:string;sourceTime:string;createdAt:string};
export type QuantAuditEntry = {id:string;action:string;targetId:string;status:string;source:string;model?:string;createdAt:string;details?:Record<string,unknown>};

const unique = <T,>(items:T[]) => [...new Set(items)];
export function extractQuantGoal(raw:string):QuantGoalExtraction {
  const goal=raw.trim(); if(!goal) throw new Error("请描述你想研究的目标");
  const assets=unique([...(goal.match(/\b(?:[036]\d{5}|[159]\d{5})\b/g)??[]),...(/沪深300/.test(goal)?["沪深300"]:[]),...(/中证500/.test(goal)?["中证500"]:[])]);
  const market:"A股"|"ETF"|"unknown" = /ETF|基金/i.test(goal)?"ETF":/A股|股票|\d{6}/.test(goal)?"A股":"unknown";
  let frequency:QuantFrequency=/每月|月频/.test(goal)?"monthly":/每周|周频/.test(goal)?"weekly":/每小时|小时/.test(goal)?"hourly":/事件|新闻|公告/.test(goal)?"event":/每日|每天|收盘/.test(goal)?"daily_close":"manual";
  const warnings:string[]=[];
  if(/实时|分钟|5分钟|15分钟|30分钟|高频/.test(goal)){frequency="daily_close";warnings.push("当前 A 股数据能力不支持可靠高频执行，已建议改为日频收盘后研究；不会伪造分钟级结果。");}
  const matches:Array<[RegExp,string]>=[[/均线|MA\d*/i,"ma_trend"],[/动量|强弱|轮动/,/行业/.test(goal)?"sector_rotation":"momentum"],[/RSI|超买|超卖/i,"rsi_reversion"],[/定投/,"etf_dca"],[/再平衡|调仓/,"periodic_rebalance"],[/低波动/,"low_volatility"],[/股息|红利/,"dividend"],[/估值|PE|PB/i,"valuation_quantile"],[/新闻|公告/,"news_event"],[/社交|小红书|雪球|情绪/,"social_sentiment"],[/基本面|财报|现金流|ROE/i,"fundamental_quality"],[/多因子/,"multi_factor"]];
  const strategyIds=unique(matches.filter(([pattern])=>pattern.test(goal)).map(([,id])=>id)); if(!strategyIds.length)strategyIds.push("custom_rule");
  const dataRequirements=unique(strategyIds.flatMap(id=>STRATEGY_REGISTRY.find(item=>item.id===id)?.requiredData??[]));
  const modules:QuantModule[]=["strategy_overview","strategy_config","backtest","risk_metrics","sensitivity","execution_log"];
  if(/模拟|纸上|虚拟/.test(goal))modules.push("paper_portfolio","signal_history");
  if(/新闻|公告/.test(goal))modules.push("news"); if(/社交|小红书|雪球|情绪/.test(goal))modules.push("social_sentiment");
  if(/基本面|财报|估值|现金流|ROE/i.test(goal))modules.push("fundamental_validation"); if(/持仓|组合/.test(goal))modules.push("portfolio_impact");
  if(frequency!=="manual")modules.push("schedule"); modules.push("ai_report");
  const missingInformation:string[]=[]; if(!assets.length)missingInformation.push("研究标的或资产范围"); if(!/(回撤|亏损|风险|波动)/.test(goal))missingInformation.push("可接受的最大回撤或风险边界");
  return {goal,assets,market,frequency,strategyIds,dataRequirements,analysisRequirements:["历史模拟","成本检查","样本外检查","参数敏感性","最大回撤"],riskConstraints:/回撤|亏损/.test(goal)?[goal.match(/(?:回撤|亏损)[^\d]{0,8}\d+(?:\.\d+)?%/)?.[0]??"用户已表达风险边界"]:[],modules:unique(modules),missingInformation,warnings};
}

export function createQuantTask(goal:string):QuantTask {
  const extraction=extractQuantGoal(goal); const now=new Date().toISOString(); const id=`qt-${crypto.randomUUID()}`;
  return {id,goal,extraction,status:"awaiting_confirmation",createdAt:now,updatedAt:now,plan:[
    {id:"step_1",title:"确认研究范围和频率",tool:"extract_quant_goal",status:"completed",requiresConfirmation:false},
    {id:"step_2",title:"读取所需公开数据",tool:"load_authorized_quant_data",status:"pending",requiresConfirmation:false},
    {id:"step_3",title:"运行历史模拟与风险检查",tool:"run_quant_backtest",status:"pending",requiresConfirmation:true},
    {id:"step_4",title:"生成可审计研究报告",tool:"generate_quant_report",status:"pending",requiresConfirmation:false},
  ],workspacePatch:{changes:extraction.modules.map((target,index)=>({action:"add" as const,target,value:index<2?"top":"main"})),requiresConfirmation:true}};
}

export type PricePoint={date:string;close:number};
export type BacktestResult={status:"ready"|"missing_data";dataStatus:string;source:string;sourceTime:string;metrics:null|{totalReturnPct:number;annualizedReturnPct:number;maxDrawdownPct:number;volatilityPct:number;sharpe:number;tradeCount:number;turnoverPct:number;costPct:number};series:Array<{date:string;strategy:number;benchmark:number}>;warnings:string[];disclaimer:string};
export function runBacktest(prices:PricePoint[],costBps=13):BacktestResult{
  const valid=prices.filter(item=>/^\d{4}-\d{2}-\d{2}$/.test(item.date)&&Number.isFinite(item.close)&&item.close>0).sort((a,b)=>a.date.localeCompare(b.date));
  const disclaimer="历史模拟只用于研究，不代表未来表现，不构成投资建议或买卖依据。";
  if(valid.length<60)return {status:"missing_data",dataStatus:`有效日线仅 ${valid.length} 条，至少需要 60 条`,source:"用户提供或已授权工具数据",sourceTime:new Date().toISOString(),metrics:null,series:[],warnings:["暂无足够数据，未生成收益、回撤或信号。"],disclaimer};
  const returns=valid.slice(1).map((item,index)=>item.close/valid[index].close-1); let wealth=1,peak=1,maxDrawdown=0; const series=[{date:valid[0].date,strategy:100,benchmark:100}];
  returns.forEach((value,index)=>{wealth*=1+value;peak=Math.max(peak,wealth);maxDrawdown=Math.max(maxDrawdown,(peak-wealth)/peak);series.push({date:valid[index+1].date,strategy:Number((wealth*100).toFixed(2)),benchmark:Number((wealth*100).toFixed(2))});});
  const mean=returns.reduce((sum,value)=>sum+value,0)/returns.length; const variance=returns.reduce((sum,value)=>sum+(value-mean)**2,0)/Math.max(1,returns.length-1); const volatility=Math.sqrt(variance)*Math.sqrt(252); const years=returns.length/252; const total=wealth-1; const annualized=years>0?wealth**(1/years)-1:0;
  return {status:"ready",dataStatus:`${valid.length} 条有效日线`,source:"用户提供或已授权工具数据",sourceTime:new Date().toISOString(),metrics:{totalReturnPct:+(total*100).toFixed(2),annualizedReturnPct:+(annualized*100).toFixed(2),maxDrawdownPct:+(maxDrawdown*100).toFixed(2),volatilityPct:+(volatility*100).toFixed(2),sharpe:volatility?+(mean*252/volatility).toFixed(2):0,tradeCount:0,turnoverPct:0,costPct:+(costBps/100).toFixed(2)},series,warnings:["当前通用核验仅计算输入价格序列的基准持有表现；具体策略成交逻辑需由已确认策略工具提供。"],disclaimer};
}

export function nextRun(frequency:QuantFrequency){const date=new Date();if(frequency==="manual"||frequency==="event")return null;if(frequency==="hourly")date.setHours(date.getHours()+1);else if(frequency==="daily_close")date.setDate(date.getDate()+1);else if(frequency==="weekly")date.setDate(date.getDate()+7);else date.setMonth(date.getMonth()+1);return date.toISOString();}
