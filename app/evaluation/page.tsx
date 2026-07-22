import Link from "next/link";
import { CheckCircle2, CircleAlert, FlaskConical, ShieldCheck } from "lucide-react";
import { requireChatGPTUser } from "../chatgpt-auth";
import { ProductToolShell } from "../components/product-tool-shell";
import { readPublicProviderState } from "../lib/ai-provider-catalog";
import { runRuleSafetyBaseline } from "../lib/course-evaluation";

export const dynamic="force-dynamic";

export default async function EvaluationPage(){
  await requireChatGPTUser("/evaluation");
  const baseline=runRuleSafetyBaseline();
  const providerState=await readPublicProviderState();
  const current=providerState.providers.find(item=>item.isDefault);
  const generativeReady=Boolean(current&&current.providerId!=="mock"&&current.connectionStatus==="available");
  return <ProductToolShell active="evaluation" title="质量与验证" description="区分已通过的产品检查、尚未运行的模型评测和真实用户证据。" status="评测结果不使用模拟用户">
    <section className="evaluation-center">
      <header className="evaluation-summary"><div><span>当前可重复基线</span><h2>{baseline.passed}/{baseline.total} 项通过</h2><p>{baseline.scope}</p></div><div className={baseline.failed?"warning":"ready"}><ShieldCheck/><span><strong>{baseline.score} 分</strong><small>{baseline.version} · {new Date(baseline.runAt).toLocaleString("zh-CN")}</small></span></div></header>
      <div className="evaluation-gates"><article className="ready"><CheckCircle2/><div><span>确定性规则</span><strong>{baseline.failed?`${baseline.failed} 项需修复`:"20 项基线通过"}</strong><small>社交内容风险与交易前规则</small></div></article><article className={generativeReady?"ready":"pending"}>{generativeReady?<CheckCircle2/>:<CircleAlert/>}<div><span>真实模型评测</span><strong>{generativeReady?`${current?.displayName} 已连接，待运行固定任务集`:"未运行"}</strong><small>{generativeReady?current?.model:"当前只有规则模式；不会用 Mock 冒充模型结果"}</small></div></article><article className="pending"><CircleAlert/><div><span>跨用户证据</span><strong>待真实测试</strong><small>需要任务完成率、行为改变、再次使用和付费意愿</small></div></article></div>
      <section className="evaluation-table"><header><div><span>规则基线明细</span><strong>每项都可在服务器重新计算</strong></div><FlaskConical/></header><div className="evaluation-table-head"><b>编号</b><b>场景</b><b>预期</b><b>实际</b><b>结果</b></div>{baseline.cases.map(item=><div key={item.id}><code>{item.id}</code><span title={item.input}>{item.category}</span><span>{item.expected}</span><span>{item.actual}</span><strong className={item.passed?"pass":"fail"}>{item.passed?"通过":"失败"}</strong></div>)}</section>
      <aside className="evaluation-next"><div><strong>距离课程 95 分还缺什么</strong><p>连接真实模型后运行固定任务集；邀请 10–20 位目标用户完成同一核心流程；记录行为改变和付费测试。没有这些证据，本页不会显示“已完成”。</p></div><Link href="/ai-settings">检查模型状态</Link></aside>
    </section>
  </ProductToolShell>;
}

