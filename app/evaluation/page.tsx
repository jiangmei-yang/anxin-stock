import Link from "next/link";
import { CheckCircle2, CircleAlert, FlaskConical, ShieldCheck } from "lucide-react";
import { requireChatGPTUser } from "../chatgpt-auth";
import { ProductToolShell } from "../components/product-tool-shell";
import { EvaluationRunner } from "../components/evaluation-runner";
import {AgentFunctionalEvaluationRunner} from "../components/agent-functional-evaluation-runner";
import {DataSourceEvaluationRunner} from "../components/data-source-evaluation-runner";
import {LocalizedText as T} from "../components/localized-text";
import { publicProvidersForSnapshot,readPublicProviderState } from "../lib/ai-provider-catalog";
import { runRuleSafetyBaseline,type ModelEvaluationRun } from "../lib/course-evaluation";
import {readUserSnapshot} from "../lib/user-snapshot";
import {readUserStudySummary} from "../lib/user-study";
import {readPilotSummary} from "../lib/pilot-study";
import {readLatestDataSourceEvaluationRun} from "../lib/data-source-evaluation";
import {formatHongKongDateTime} from "../lib/date-format";
import type {AgentFunctionalEvaluationRun} from "../lib/agent-functional-evaluation";

export const dynamic="force-dynamic";

export default async function EvaluationPage(){
  await requireChatGPTUser("/evaluation");
  const baseline=runRuleSafetyBaseline();
  const providerState=await readPublicProviderState().catch(()=>{const providers=publicProvidersForSnapshot({});return{providers,defaultProviderId:providers.find(item=>item.isDefault)?.providerId??"mock",privacyMode:false};});
  const current=providerState.providers.find(item=>item.isDefault);
  const generativeReady=Boolean(current&&current.providerId!=="mock"&&current.connectionStatus==="available");
  const snapshotResult=await readUserSnapshot().catch(()=>({status:"empty" as const}));
  const modelRuns=snapshotResult.status==="ready"&&Array.isArray(snapshotResult.snapshot.modelEvaluationRuns)?snapshotResult.snapshot.modelEvaluationRuns as ModelEvaluationRun[]:[];
  const latestModelRun=modelRuns[0];
  const agentRuns=snapshotResult.status==="ready"&&Array.isArray(snapshotResult.snapshot.agentFunctionalEvaluationRuns)?snapshotResult.snapshot.agentFunctionalEvaluationRuns as AgentFunctionalEvaluationRun[]:[];
  const latestAgentRun=agentRuns[0];
  const userStudy=await readUserStudySummary().catch(()=>({reviews:0,participants:0,changed:0,understood:0,riskRestatements:0,repeatIntent:0,paidIntent:0,representedSegments:0,segments:{} as Record<string,number>,averageSeconds:null,averageSatisfaction:null,started:0,completed:0,quickCompleted:0,engagedCompleted:0,abandoned:0,completionSeconds:null}));
  const pilot=await readPilotSummary().catch(()=>({responses:0,joined:0,exposed:0,views:0,offer:{priceMonthly:19}}));
  const dataSourceRun=await readLatestDataSourceEvaluationRun().catch(()=>null);
  const completionRate=userStudy.started?Math.round(userStudy.completed/userStudy.started*100):0;
  const conversionRate=pilot.exposed?Math.round(pilot.joined/pilot.exposed*100):0;
  const segments=[["投资经验不足1年","Under one year of investing"],["ETF或长期持有","ETF or long-term investor"],["近3个月主动交易","Active trader in the past 3 months"]] as const;
  return <ProductToolShell active="evaluation" title="质量与验证" description="区分已通过的产品检查、尚未运行的模型评测和真实用户证据。" status="评测结果不使用模拟用户">
    <section className="evaluation-center">
      <header className="evaluation-summary"><div><span><T zh="当前可重复基线" en="Current reproducible baseline"/></span><h2>{baseline.passed}/{baseline.total} <T zh="项通过" en="checks passed"/></h2><p><T zh={baseline.scope} en="Deterministic rules only; this is not a language-model quality score."/></p></div><div className={baseline.failed?"warning":"ready"}><ShieldCheck/><span><strong>{baseline.score} <T zh="分" en="points"/></strong><small>{baseline.version} · {formatHongKongDateTime(baseline.runAt)}</small></span></div></header>
      <div className="evaluation-gates">
        <article className="ready"><CheckCircle2/><div><span><T zh="确定性规则" en="Deterministic rules"/></span><strong><T zh={baseline.failed?`${baseline.failed} 项需修复`:"20 项基线通过"} en={baseline.failed?`${baseline.failed} checks need work`:"20 baseline checks passed"}/></strong><small><T zh="社交内容风险与交易前规则" en="Social-content risk and pre-trade rules"/></small></div></article>
        <article className={latestModelRun?(latestModelRun.score>=90?"ready":"warning"):generativeReady?"ready":"pending"}>{latestModelRun&&latestModelRun.score>=90?<CheckCircle2/>:<CircleAlert/>}<div><span><T zh="真实模型评测" en="Real-model evaluation"/></span><strong>{latestModelRun?<>{latestModelRun.passed}/{latestModelRun.total} · {latestModelRun.score} <T zh="分" en="points"/></>:generativeReady?<T zh={`${current?.displayName} 已连接，待运行固定任务集`} en={`${current?.displayName} connected; fixed tasks not run`}/>:<T zh="未运行" en="Not run"/>}</strong><small>{latestModelRun?`${latestModelRun.model} · ${formatHongKongDateTime(latestModelRun.runAt)}`:generativeReady?current?.model:<T zh="当前只有规则模式；不会用 Mock 冒充模型结果" en="Rules-only mode; Mock is never presented as model evidence"/>}</small></div></article>
        <article className="pending"><CircleAlert/><div><span><T zh="跨用户证据" en="Cross-user evidence"/></span><strong><T zh="待真实测试" en="Awaiting real testing"/></strong><small><T zh="需要任务完成率、行为改变、再次使用和付费意愿" en="Needs task completion, behavior change, repeat use and payment evidence"/></small></div></article>
      </div>
      <EvaluationRunner ready={generativeReady} provider={current?.displayName??"Rules-only mode"} model={current?.model??"mock"} initialRun={latestModelRun}/>
      <AgentFunctionalEvaluationRunner ready={generativeReady} provider={current?.displayName??"Rules-only mode"} model={current?.model??"mock"} initialRun={latestAgentRun}/>
      <DataSourceEvaluationRunner initialRun={dataSourceRun}/>
      <section className="study-funnel"><header><div><span><T zh="核心任务漏斗" en="Core task funnel"/></span><strong><T zh="开始 → 完成或放弃 → 提交反馈" en="Start → complete or abandon → submit feedback"/></strong></div><span><T zh="超 30 分钟未完成计为放弃" en="Incomplete after 30 minutes is counted as abandoned"/></span></header><div>
        <article><span><T zh="开始审查" en="Started"/></span><strong>{userStudy.started}</strong></article>
        <article><span><T zh="完成审查" en="Completed"/></span><strong>{userStudy.completed}</strong><small>{userStudy.started?<T zh={`${completionRate}% 完成率`} en={`${completionRate}% completion rate`}/>:<T zh="尚无样本" en="No sample yet"/>}</small></article>
        <article><span><T zh="有参与度完成" en="Engaged completion"/></span><strong>{userStudy.engagedCompleted}</strong><small><T zh="耗时超过 15 秒" en="More than 15 seconds"/></small></article>
        <article><span><T zh="15 秒内快速结束" en="Finished within 15 seconds"/></span><strong>{userStudy.quickCompleted}</strong><small><T zh="单独显示，不冒充深度使用" en="Reported separately; not treated as deep use"/></small></article>
        <article><span><T zh="放弃或超时" en="Abandoned or timed out"/></span><strong>{userStudy.abandoned}</strong></article>
        <article><span><T zh="平均流程耗时" en="Average task time"/></span><strong>{userStudy.completionSeconds==null?<T zh="暂无" en="None yet"/>:<><span>{userStudy.completionSeconds}</span> <T zh="秒" en="sec"/></>}</strong></article>
      </div><footer><a href="/api/evaluation/user-study?format=sessions"><T zh="导出会话 CSV" en="Export session CSV"/></a><span><T zh="只记录匿名会话状态和时间；15 秒阈值仅用于发现“点进即退”，不代表投资判断质量。" en="Only anonymous session state and timing are recorded. The 15-second threshold detects immediate exits; it does not measure decision quality."/></span></footer></section>
      <section className="user-study-summary"><header><div><span><T zh="完成后的真实反馈" en="Real post-task feedback"/></span><strong>{userStudy.participants} <T zh="位匿名参与者" en="anonymous participants"/> · {userStudy.reviews} <T zh="次明确同意的反馈" en="consented responses"/> · {userStudy.representedSegments}/3 <T zh="类用户" en="segments"/></strong></div><a href="/api/evaluation/user-study?format=csv"><T zh="导出反馈 CSV" en="Export feedback CSV"/></a></header><div>
        <article><span><T zh="修改或延迟" en="Changed or delayed"/></span><strong>{userStudy.reviews?Math.round(userStudy.changed/userStudy.reviews*100):0}%</strong></article>
        <article><span><T zh="自报看懂风险" en="Self-reported risk understanding"/></span><strong>{userStudy.reviews?Math.round(userStudy.understood/userStudy.reviews*100):0}%</strong></article>
        <article><span><T zh="提交风险复述" en="Submitted a risk restatement"/></span><strong>{userStudy.reviews?Math.round(userStudy.riskRestatements/userStudy.reviews*100):0}%</strong><small><T zh="原文仅供人工核对，不等同于自动判定正确" en="Restatements require human review and are not automatically marked correct"/></small></article>
        <article><span><T zh="愿意再次使用" en="Would use again"/></span><strong>{userStudy.reviews?Math.round(userStudy.repeatIntent/userStudy.reviews*100):0}%</strong></article>
        <article><span><T zh="愿意进入付费测试" en="Joined paid-test interest"/></span><strong>{userStudy.reviews?Math.round(userStudy.paidIntent/userStudy.reviews*100):0}%</strong></article>
        <article><span><T zh="平均完成时间" en="Average completion time"/></span><strong>{userStudy.averageSeconds==null?<T zh="暂无" en="None yet"/>:<>{userStudy.averageSeconds} <T zh="秒" en="sec"/></>}</strong></article>
      </div><p><T zh="所有问题默认未选择，只有用户明确作答并同意匿名体验研究后才计入；风险复述需要人工核对是否准确。" en="No answer is preselected. Responses count only after explicit consent; risk restatements require human review."/></p></section>
      <section className="study-cohort-coverage"><header><div><span><T zh="招募配额" en="Recruitment quota"/></span><strong><T zh="三类目标用户各 5 位" en="Five users in each of three target segments"/></strong></div><small><T zh="同一参与者在同一类别只计一次" en="Each participant counts once per segment"/></small></header><div>{segments.map(([zh,en])=><article key={zh}><span><T zh={zh} en={en}/></span><strong>{userStudy.segments[zh]??0}<small>/5</small></strong><i><b style={{width:`${Math.min(100,(userStudy.segments[zh]??0)/5*100)}%`}}/></i></article>)}</div></section>
      <section className="pilot-evidence"><div><span><T zh="行为型价格测试" en="Behavioral price test"/></span><strong>¥{pilot.offer.priceMonthly}<T zh="/月 · 每周持仓判断复核" en="/month · weekly portfolio decision review"/></strong><small><T zh={`${pilot.exposed} 人看过方案，${pilot.joined} 人当前在候补，转化率 ${conversionRate}%。尚未接支付，不把态度题算作收入。`} en={`${pilot.exposed} people saw the offer, ${pilot.joined} joined the waitlist; conversion ${conversionRate}%. Payments are not connected, and attitude questions are not counted as revenue.`}/></small></div><Link href="/pilot"><T zh="查看并加入测试" en="View and join the test"/></Link></section>
      <section className="evaluation-table"><header><div><span><T zh="规则基线明细" en="Rule-baseline details"/></span><strong><T zh="每项都可在服务器重新计算" en="Every check can be recomputed on the server"/></strong></div><FlaskConical/></header><div className="evaluation-table-head"><b><T zh="编号" en="ID"/></b><b><T zh="场景" en="Scenario"/></b><b><T zh="预期" en="Expected"/></b><b><T zh="实际" en="Observed"/></b><b><T zh="结果" en="Result"/></b></div>{baseline.cases.map(item=><div key={item.id}><code>{item.id}</code><span title={item.input}><T zh={item.category} en={item.category==="社交内容风险"?"Social-content risk":"Pre-trade rule"}/></span><span><T zh={item.expected} en="Expected policy behavior"/></span><span><T zh={item.actual} en={item.passed?"Deterministic output matched":"Deterministic output differed"}/></span><strong className={item.passed?"pass":"fail"}><T zh={item.passed?"通过":"失败"} en={item.passed?"Pass":"Fail"}/></strong></div>)}</section>
      <aside className="evaluation-next"><div><strong><T zh="下一阶段需要验证什么" en="What must be validated next"/></strong><p><T zh="运行固定模型任务集；邀请目标用户完成同一核心流程；验证持续使用与付费测试意愿。缺少真实证据时，本页会明确显示“尚未验证”。" en="Run the fixed model tasks, invite target users through the same core flow, and measure repeat use and payment behavior. Missing evidence remains explicitly unverified."/></p></div><span><Link href="/demo"><T zh="打开 90 秒演示" en="Open 90-second demo"/></Link><Link href="/ai-settings"><T zh="检查模型状态" en="Check model status"/></Link></span></aside>
    </section>
  </ProductToolShell>;
}
