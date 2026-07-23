"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, CheckCircle2, Clock3, ShieldCheck, Users } from "lucide-react";

import { DemoWalkthrough, type DemoOutcome } from "./demo-walkthrough";
import { PilotEnrollment } from "./pilot-enrollment";
import { PARTICIPANT_SEGMENTS, type ParticipantRelation, type ParticipantSegment } from "../lib/user-study-validation";
import { pick, useI18n } from "../i18n";

type Phase = "intro" | "task" | "feedback" | "offer";

const SEGMENT_LABELS: Record<ParticipantSegment, { zh: string; en: string; detailZh: string; detailEn: string }> = {
  "投资经验不足1年": { zh: "投资经验不足 1 年", en: "Less than 1 year", detailZh: "仍在建立自己的投资流程", detailEn: "Still building an investing process" },
  "ETF或长期持有": { zh: "主要持有 ETF 或长期投资", en: "ETF or long-term investor", detailZh: "交易不频繁，更重视持续复核", detailEn: "Trades less often and reviews over time" },
  "近3个月主动交易": { zh: "近 3 个月有主动交易", en: "Active in the past 3 months", detailZh: "近期做过买入、补仓或卖出决定", detailEn: "Recently made a buy, add or sell decision" },
};

export function PilotJourney({ initialJoined = false, initialJoinRelation }: { initialJoined?: boolean; initialJoinRelation?: ParticipantRelation }) {
  const { isEnglish } = useI18n();
  const [phase, setPhase] = useState<Phase>("intro");
  const [segment, setSegment] = useState<ParticipantSegment>();
  const [relation, setRelation] = useState<ParticipantRelation>();
  const [outcome, setOutcome] = useState<DemoOutcome>();
  const [feedbackStep, setFeedbackStep] = useState(0);
  const [testerCode, setTesterCode] = useState("");
  const [satisfaction, setSatisfaction] = useState<number>();
  const [riskUnderstood, setRiskUnderstood] = useState<boolean>();
  const [riskExplanation, setRiskExplanation] = useState("");
  const [confusingStep, setConfusingStep] = useState("");
  const [repeatIntent, setRepeatIntent] = useState<boolean>();
  const [paidIntent, setPaidIntent] = useState<boolean>();
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const sessionIdRef = useRef("");
  const startedAtRef = useRef(0);
  const sessionStartedRef = useRef(false);
  const taskCompletedRef = useRef(false);
  const durationRef = useRef(0);

  useEffect(() => {
    const sessionId = `pilot-${crypto.randomUUID()}`;
    sessionIdRef.current = sessionId;
    setTesterCode(`P-${sessionId.slice(-6).toUpperCase()}`);
    return () => {
      if (!sessionStartedRef.current || taskCompletedRef.current) return;
      const payload = JSON.stringify({ eventType: "session", sessionId, status: "abandoned" });
      if (navigator.sendBeacon) navigator.sendBeacon("/api/evaluation/user-study", new Blob([payload], { type: "application/json" }));
      else void fetch("/api/evaluation/user-study", { method: "POST", headers: { "content-type": "application/json" }, body: payload, keepalive: true });
    };
  }, []);

  const startTask = () => {
    if (!segment || !relation) return;
    sessionStartedRef.current = true;
    startedAtRef.current = Date.now();
    setPhase("task");
    void fetch("/api/evaluation/user-study", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventType: "session", sessionId: sessionIdRef.current, status: "started", participantRelation: relation, participantSegment: segment }),
    });
  };

  const completeTask = (nextOutcome: DemoOutcome) => {
    setOutcome(nextOutcome);
    setPhase("feedback");
    if (!taskCompletedRef.current) {
      taskCompletedRef.current = true;
      durationRef.current = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
      void fetch("/api/evaluation/user-study", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventType: "session", sessionId: sessionIdRef.current, status: "task_completed", durationSeconds: durationRef.current, participantRelation: relation, participantSegment: segment }),
      });
    }
    requestAnimationFrame(() => document.querySelector(".pilot-feedback")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const firstFeedbackComplete = Boolean(satisfaction && typeof riskUnderstood === "boolean");
  const secondFeedbackComplete = riskExplanation.trim().length >= 8;
  const finalFeedbackComplete = typeof repeatIntent === "boolean" && typeof paidIntent === "boolean" && consent;

  const submitFeedback = async () => {
    if (!segment || !relation || !outcome || !firstFeedbackComplete || !secondFeedbackComplete || !finalFeedbackComplete) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/evaluation/user-study", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reviewId: `pilot-demo-${sessionIdRef.current}`,
          testerCode,
          participantSegment: segment,
          participantRelation: relation,
          result: outcome.result,
          durationSeconds: durationRef.current,
          satisfaction,
          riskUnderstood,
          riskExplanation: riskExplanation.trim(),
          repeatIntent,
          paidIntent,
          confusingStep: confusingStep.trim(),
          consent,
        }),
      });
      const body = await response.json() as { message?: string };
      if (!response.ok) throw new Error(body.message ?? pick(isEnglish, "提交失败", "Submission failed"));
      const sessionResponse = await fetch("/api/evaluation/user-study", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventType: "session", sessionId: sessionIdRef.current, status: "feedback_submitted", durationSeconds: durationRef.current, participantRelation: relation, participantSegment: segment }),
      });
      if (!sessionResponse.ok) {
        const sessionBody = await sessionResponse.json().catch(() => ({})) as { message?: string };
        throw new Error(sessionBody.message ?? pick(isEnglish, "反馈已保存，但流程状态同步失败，请重试", "Feedback was saved, but the study status did not sync. Please retry."));
      }
      setPhase("offer");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(isEnglish, "提交失败，请稍后重试", "Submission failed. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pilot-journey">
      <section className="pilot-progress" aria-label={pick(isEnglish, "体验进度", "Study progress")}>
        {[
          pick(isEnglish, "选择用户类型", "Choose profile"),
          pick(isEnglish, "完成审查任务", "Complete task"),
          pick(isEnglish, "提交匿名反馈", "Give feedback"),
          pick(isEnglish, "查看价格方案", "View offer"),
        ].map((label, index) => {
          const current = ["intro", "task", "feedback", "offer"].indexOf(phase);
          return <span key={label} className={index === current ? "active" : index < current ? "done" : ""}><i>{index < current ? <Check /> : index + 1}</i>{label}</span>;
        })}
      </section>

      {phase === "intro" && <section className="pilot-intro">
        <header><span>{pick(isEnglish, "早期用户体验研究", "Early user study")}</span><h2>{pick(isEnglish, "完成一次交易前审查，约 5 分钟", "Complete one pre-trade review in about 5 minutes")}</h2><p>{pick(isEnglish, "没有标准答案。我们需要观察你是否能看懂风险，并允许你维持、修改或延迟原计划。", "There is no correct answer. We want to see whether the risks are understandable while allowing you to keep, change or delay the plan.")}</p></header>
        <div className="pilot-task-brief"><Clock3 /><span><strong>{pick(isEnglish, "你的任务", "Your task")}</strong><small>{pick(isEnglish, "检查一笔补仓计划，阅读证据与仓位影响，然后独立作出选择。", "Review an add-to-position plan, inspect its evidence and position impact, then make your own choice.")}</small></span></div>
        <fieldset className="pilot-relation"><legend>{pick(isEnglish, "你与这个项目的关系", "Your relationship to this project")}</legend><div className="pilot-binary">{[
          ["external", pick(isEnglish, "我是外部体验者", "I am an external participant")],
          ["team_member", pick(isEnglish, "我是项目团队成员或内部测试者", "I am on the project team or testing internally")],
        ].map(([value, label]) => <button type="button" key={value} className={relation === value ? "selected" : ""} aria-pressed={relation === value} onClick={() => setRelation(value as ParticipantRelation)}>{label}</button>)}</div><small>{pick(isEnglish, "团队内部记录会保留，但不会计入外部用户证据。", "Internal records are retained but excluded from external-user evidence.")}</small></fieldset>
        <fieldset><legend>{pick(isEnglish, "请选择最符合你的情况", "Choose the closest description")}</legend>{PARTICIPANT_SEGMENTS.map((item) => { const label = SEGMENT_LABELS[item]; return <button type="button" key={item} className={segment === item ? "selected" : ""} aria-pressed={segment === item} onClick={() => setSegment(item)}><Users /><span><strong>{isEnglish ? label.en : label.zh}</strong><small>{isEnglish ? label.detailEn : label.detailZh}</small></span>{segment === item && <CheckCircle2 />}</button>; })}</fieldset>
        <button className="pilot-primary" disabled={!segment || !relation} onClick={startTask}>{pick(isEnglish, "开始体验任务", "Start the task")}<ArrowRight /></button>
        <footer><ShieldCheck />{pick(isEnglish, "不收集姓名、联系方式、证券账户或真实资产。匿名会话用于统计完成与退出。", "No name, contact details, brokerage account or real assets are collected. Anonymous sessions measure completion and exits.")}</footer>
      </section>}

      {phase === "task" && <DemoWalkthrough onComplete={completeTask} />}

      {phase === "feedback" && outcome && <section className="pilot-feedback">
        <header><span>{pick(isEnglish, "匿名编号", "Anonymous ID")} · {testerCode}</span><h2>{pick(isEnglish, "你刚才看懂了什么？", "What did you understand?")}</h2><p>{pick(isEnglish, "问题分三小步，没有预选答案。你的选择不会影响是否可以继续使用产品。", "Three short steps, with no preselected answers. Your answers do not affect access to the product.")}</p></header>
        <nav aria-label={pick(isEnglish, "反馈步骤", "Feedback steps")}>{[0, 1, 2].map((index) => <i key={index} className={index === feedbackStep ? "active" : index < feedbackStep ? "done" : ""} />)}</nav>

        {feedbackStep === 0 && <div className="pilot-feedback-step">
          <fieldset><legend>{pick(isEnglish, "这次体验整体有多清楚？", "How clear was this experience?")}</legend><div className="pilot-scale">{[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} className={satisfaction === value ? "selected" : ""} aria-pressed={satisfaction === value} onClick={() => setSatisfaction(value)}><b>{value}</b><small>{value === 1 ? pick(isEnglish, "很不清楚", "Very unclear") : value === 5 ? pick(isEnglish, "很清楚", "Very clear") : ""}</small></button>)}</div></fieldset>
          <fieldset><legend>{pick(isEnglish, "你是否理解系统指出的主要风险？", "Did you understand the main risk identified?")}</legend><div className="pilot-binary">{[[true, pick(isEnglish, "理解", "Yes")], [false, pick(isEnglish, "没有完全理解", "Not fully")]].map(([value, label]) => <button type="button" key={String(value)} className={riskUnderstood === value ? "selected" : ""} aria-pressed={riskUnderstood === value} onClick={() => setRiskUnderstood(value as boolean)}>{label as string}</button>)}</div></fieldset>
          <button className="pilot-primary" disabled={!firstFeedbackComplete} onClick={() => setFeedbackStep(1)}>{pick(isEnglish, "下一步", "Next")}<ArrowRight /></button>
        </div>}

        {feedbackStep === 1 && <div className="pilot-feedback-step">
          <label><span>{pick(isEnglish, "请用自己的话写出一个最重要的风险", "In your own words, describe one important risk")}</span><textarea value={riskExplanation} onChange={(event) => setRiskExplanation(event.target.value)} rows={4} placeholder={pick(isEnglish, "例如：计划后单只股票占比超过了个人上限……", "For example: the plan would push one stock above the personal limit…")} /><small>{riskExplanation.trim().length}/8 {pick(isEnglish, "个字符起", "characters minimum")}</small></label>
          <label><span>{pick(isEnglish, "哪一步最困惑？（可不填）", "Which step was most confusing? (optional)")}</span><input value={confusingStep} onChange={(event) => setConfusingStep(event.target.value)} placeholder={pick(isEnglish, "例如：不知道“失效条件”是什么意思", "For example: I did not understand the invalidation condition")} /></label>
          <div className="pilot-feedback-actions"><button type="button" onClick={() => setFeedbackStep(0)}>{pick(isEnglish, "返回", "Back")}</button><button className="pilot-primary" disabled={!secondFeedbackComplete} onClick={() => setFeedbackStep(2)}>{pick(isEnglish, "下一步", "Next")}<ArrowRight /></button></div>
        </div>}

        {feedbackStep === 2 && <div className="pilot-feedback-step">
          <fieldset><legend>{pick(isEnglish, "如果下次遇到类似决定，你愿意再次使用吗？", "Would you use this again for a similar decision?")}</legend><div className="pilot-binary">{[[true, pick(isEnglish, "愿意", "Yes")], [false, pick(isEnglish, "暂时不会", "Not yet")]].map(([value, label]) => <button type="button" key={String(value)} className={repeatIntent === value ? "selected" : ""} aria-pressed={repeatIntent === value} onClick={() => setRepeatIntent(value as boolean)}>{label as string}</button>)}</div></fieldset>
          <fieldset><legend>{pick(isEnglish, "你愿意在提交后查看 ¥19/月的测试方案吗？", "Would you view a ¥19/month test offer after submitting?")}</legend><div className="pilot-binary">{[[true, pick(isEnglish, "愿意查看", "Show me")], [false, pick(isEnglish, "不需要", "No thanks")]].map(([value, label]) => <button type="button" key={String(value)} className={paidIntent === value ? "selected" : ""} aria-pressed={paidIntent === value} onClick={() => setPaidIntent(value as boolean)}>{label as string}</button>)}</div><small>{pick(isEnglish, "这只是态度问题；只有下一页主动加入候补才算行为证据。", "This is an attitude question. Only joining the waitlist on the next screen counts as behavioral evidence.")}</small></fieldset>
          <label className="pilot-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>{pick(isEnglish, "我同意将以上匿名回答用于课程产品研究；不包含姓名和联系方式。", "I consent to these anonymous responses being used for course product research. No name or contact details are included.")}</span></label>
          {message && <p className="pilot-error" role="alert">{message}</p>}
          <div className="pilot-feedback-actions"><button type="button" onClick={() => setFeedbackStep(1)}>{pick(isEnglish, "返回", "Back")}</button><button className="pilot-primary" disabled={!finalFeedbackComplete || saving} onClick={() => void submitFeedback()}>{saving ? pick(isEnglish, "正在提交…", "Submitting…") : pick(isEnglish, "提交匿名反馈", "Submit anonymous feedback")}<ArrowRight /></button></div>
        </div>}
      </section>}

      {phase === "offer" && relation && <section className="pilot-offer-stage"><header><CheckCircle2 /><span><strong>{pick(isEnglish, "匿名反馈已保存", "Anonymous feedback saved")}</strong><small>{pick(isEnglish, "下面的价格方案与反馈分开记录。加入候补不会扣费。", "The price offer is recorded separately from feedback. Joining does not charge you.")}</small></span></header><PilotEnrollment initialJoined={initialJoined&&initialJoinRelation===relation} participantRelation={relation} /></section>}
    </div>
  );
}
