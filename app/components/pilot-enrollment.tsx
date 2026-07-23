"use client";

import {useEffect,useState} from "react";
import {BellRing,Check,RefreshCw,ShieldCheck} from "lucide-react";

import {pick,useI18n} from "../i18n";
import type{ParticipantRelation}from "../lib/user-study-validation";

const PILOT_OFFER={
  priceMonthly:19,
  trialDays:14,
} as const;

export function PilotEnrollment({initialJoined=false,participantRelation}:{initialJoined?:boolean;participantRelation:ParticipantRelation}){
  const{isEnglish}=useI18n();
  const[joined,setJoined]=useState(initialJoined);
  const[busy,setBusy]=useState(false);
  const[message,setMessage]=useState("");

  useEffect(()=>{
    void fetch("/api/evaluation/pilot",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({event:"view",participantRelation}),
    });
  },[participantRelation]);

  async function update(next:boolean){
    setBusy(true);
    setMessage("");
    try{
      const response=await fetch("/api/evaluation/pilot",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({joined:next,participantRelation}),
      });
      const body=await response.json() as{message?:string};
      if(!response.ok)throw new Error(body.message??pick(isEnglish,"操作失败","Action failed"));
      setJoined(next);
      setMessage(next
        ?pick(isEnglish,"已加入候补。正式开始前仍会再次确认，不会自动扣费。","You joined the waitlist. We will ask again before any paid test; there is no automatic charge.")
        :pick(isEnglish,"已退出候补。","You left the waitlist."));
    }catch(error){
      setMessage(error instanceof Error?error.message:pick(isEnglish,"操作失败","Action failed"));
    }finally{
      setBusy(false);
    }
  }

  return <section className="pilot-offer">
    <header>
      <div>
        <span>{pick(isEnglish,"单一价格实验 · 不接支付","Single-price experiment · no payment connection")}</span>
        <h2>{pick(isEnglish,"每周持仓判断复核","Weekly portfolio decision review")}</h2>
        <p>{pick(isEnglish,"每周汇总持仓相关的新证据、原判断变化和需要重新核对的风险。","A weekly summary of new evidence, changes to your original thesis, and risks that need another look.")}</p>
      </div>
      <strong>¥{PILOT_OFFER.priceMonthly}<small>{pick(isEnglish,"/ 月","/ month")}</small></strong>
    </header>
    <div className="pilot-offer-grid">
      <article><BellRing/><span><strong>{pick(isEnglish,"每周一次","Once a week")}</strong><small>{pick(isEnglish,"只报告“什么变了”，不制造盘中焦虑。","Reports what changed without creating intraday urgency.")}</small></span></article>
      <article><ShieldCheck/><span><strong>{pick(isEnglish,"以原判断为中心","Centred on your thesis")}</strong><small>{pick(isEnglish,"把新资料、持仓影响和个人边界放在一起复核。","Reviews new evidence, portfolio impact and personal limits together.")}</small></span></article>
      <article><Check/><span><strong>{PILOT_OFFER.trialDays} {pick(isEnglish,"天体验","day trial")}</strong><small>{pick(isEnglish,"候补不等于订阅；没有自动续费或扣款。","A waitlist is not a subscription; there is no automatic renewal or charge.")}</small></span></article>
    </div>
    <aside>
      <div>
        <strong>{joined
          ?pick(isEnglish,"你已加入付费测试候补","You joined the paid-test waitlist")
          :pick(isEnglish,"愿意用真实行动验证这个需求吗？","Would you validate this demand with a real action?")}</strong>
        <span>{joined
          ?pick(isEnglish,"这是一条真实候补记录，可随时退出。","This is a real waitlist record, and you can leave at any time.")
          :pick(isEnglish,"加入表示：如果体验达到预期，你愿意测试 ¥19/月；现在不会收费。","Joining means you would test the service at ¥19/month if it meets expectations. You will not be charged now.")}</span>
        {message&&<small>{message}</small>}
      </div>
      <button disabled={busy} onClick={()=>update(!joined)}>
        {busy?<RefreshCw className="spin"/>:joined?<Check/>:<BellRing/>}
        {joined
          ?pick(isEnglish,"退出候补","Leave waitlist")
          :pick(isEnglish,"加入 14 天付费测试","Join the 14-day paid test")}
      </button>
    </aside>
    <footer>{pick(isEnglish,"仅记录登录账户的匿名哈希、方案版本、价格和操作时间；不保存手机号、微信号或支付信息。","Only an anonymous account hash, offer version, price and action time are recorded. No phone number, messaging ID or payment information is stored.")}</footer>
  </section>;
}
