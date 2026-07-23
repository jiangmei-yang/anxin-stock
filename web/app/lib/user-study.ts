import {authenticatedOwnerKey,getUserDatabase} from "./user-snapshot";
import {validateStudyInput,type ParticipantRelation,type ParticipantSegment,type StudyInput} from "./user-study-validation";

type StudySessionInput={
  sessionId:string;
  status:"started"|"task_completed"|"feedback_submitted"|"abandoned";
  durationSeconds?:number;
  participantRelation?:ParticipantRelation;
  participantSegment?:ParticipantSegment;
};

async function ensureTable(db:D1Database){
  await db.prepare(`CREATE TABLE IF NOT EXISTS user_study_events (
    owner_key TEXT NOT NULL, review_key TEXT NOT NULL, participant_key TEXT NOT NULL,
    result TEXT NOT NULL, duration_seconds INTEGER, satisfaction INTEGER NOT NULL,
    risk_understood INTEGER NOT NULL, repeat_intent INTEGER NOT NULL, paid_intent INTEGER NOT NULL,
    created_at TEXT NOT NULL, participant_segment TEXT, risk_explanation TEXT,
    confusing_step TEXT, consented_at TEXT, PRIMARY KEY(owner_key,review_key)
  )`).run();
  const schema=await db.prepare("PRAGMA table_info(user_study_events)").all() as {results?:Array<{name:string}>};
  const present=new Set((schema.results??[]).map(item=>item.name));
  const migrations=[
    ["participant_segment","ALTER TABLE user_study_events ADD COLUMN participant_segment TEXT"],
    ["risk_explanation","ALTER TABLE user_study_events ADD COLUMN risk_explanation TEXT"],
    ["confusing_step","ALTER TABLE user_study_events ADD COLUMN confusing_step TEXT"],
    ["consented_at","ALTER TABLE user_study_events ADD COLUMN consented_at TEXT"],
    ["participant_relation","ALTER TABLE user_study_events ADD COLUMN participant_relation TEXT"],
  ] as const;
  for(const[column,sql]of migrations)if(!present.has(column))await db.prepare(sql).run();
}
async function ensureSessionTable(db:D1Database){await db.prepare(`CREATE TABLE IF NOT EXISTS user_study_sessions (
  owner_key TEXT NOT NULL, session_key TEXT NOT NULL, status TEXT NOT NULL,
  started_at TEXT NOT NULL, completed_at TEXT, duration_seconds INTEGER,
  feedback_at TEXT, participant_relation TEXT, participant_segment TEXT,
  updated_at TEXT NOT NULL, PRIMARY KEY(owner_key,session_key)
)`).run();
  const schema=await db.prepare("PRAGMA table_info(user_study_sessions)").all() as {results?:Array<{name:string}>};
  const present=new Set((schema.results??[]).map(item=>item.name));
  const migrations=[
    ["feedback_at","ALTER TABLE user_study_sessions ADD COLUMN feedback_at TEXT"],
    ["participant_relation","ALTER TABLE user_study_sessions ADD COLUMN participant_relation TEXT"],
    ["participant_segment","ALTER TABLE user_study_sessions ADD COLUMN participant_segment TEXT"],
  ] as const;
  for(const[column,sql]of migrations)if(!present.has(column))await db.prepare(sql).run();
}
async function digest(value:string){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(item=>item.toString(16).padStart(2,"0")).join("");}
export async function saveUserStudyEvent(input:StudyInput){
  const owner=await authenticatedOwnerKey();if(!owner)throw new Error("请先登录");
  const clean=validateStudyInput(input);const db=await getUserDatabase();await ensureTable(db);
  const reviewKey=await digest(`${owner}:${clean.reviewId}`);
  // One authenticated account is one participant. A fresh browser session must
  // never inflate the participant count.
  const participantKey=await digest(`participant:${owner}`);
  const now=new Date().toISOString();
  await db.prepare(`INSERT INTO user_study_events(owner_key,review_key,participant_key,result,duration_seconds,satisfaction,risk_understood,repeat_intent,paid_intent,created_at,participant_segment,risk_explanation,confusing_step,consented_at,participant_relation)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(owner_key,review_key) DO UPDATE SET participant_key=excluded.participant_key,result=excluded.result,duration_seconds=excluded.duration_seconds,satisfaction=excluded.satisfaction,risk_understood=excluded.risk_understood,repeat_intent=excluded.repeat_intent,paid_intent=excluded.paid_intent,created_at=excluded.created_at,participant_segment=excluded.participant_segment,risk_explanation=excluded.risk_explanation,confusing_step=excluded.confusing_step,consented_at=excluded.consented_at,participant_relation=excluded.participant_relation`)
    .bind(owner,reviewKey,participantKey,clean.result,Number.isFinite(clean.durationSeconds)?Math.max(0,Math.round(clean.durationSeconds!)):null,clean.satisfaction,clean.riskUnderstood?1:0,clean.repeatIntent?1:0,clean.paidIntent?1:0,now,clean.participantSegment,clean.riskExplanation,clean.confusingStep,now,clean.participantRelation).run();
  return{status:"saved" as const};
}

export async function saveUserStudySession(input:StudySessionInput){const owner=await authenticatedOwnerKey();if(!owner)throw new Error("请先登录");const db=await getUserDatabase();await ensureSessionTable(db);const sessionKey=await digest(`${owner}:${input.sessionId}`);const now=new Date().toISOString();const duration=Number.isFinite(input.durationSeconds)?Math.max(0,Math.round(input.durationSeconds!)):null;
  if(input.status==="started"){
    await db.prepare(`INSERT INTO user_study_sessions(owner_key,session_key,status,started_at,completed_at,duration_seconds,feedback_at,participant_relation,participant_segment,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner_key,session_key) DO NOTHING`).bind(owner,sessionKey,"started",now,null,null,null,input.participantRelation??null,input.participantSegment??null,now).run();
  }else{
    await db.prepare(`INSERT INTO user_study_sessions(owner_key,session_key,status,started_at,completed_at,duration_seconds,feedback_at,participant_relation,participant_segment,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(owner_key,session_key) DO UPDATE SET
        status=CASE
          WHEN user_study_sessions.status='feedback_submitted' THEN 'feedback_submitted'
          WHEN excluded.status='feedback_submitted' THEN 'feedback_submitted'
          WHEN user_study_sessions.status='task_completed' THEN 'task_completed'
          WHEN excluded.status='task_completed' THEN 'task_completed'
          ELSE excluded.status END,
        completed_at=CASE WHEN excluded.status='task_completed' AND user_study_sessions.completed_at IS NULL THEN excluded.completed_at ELSE user_study_sessions.completed_at END,
        duration_seconds=CASE WHEN excluded.duration_seconds IS NOT NULL THEN excluded.duration_seconds ELSE user_study_sessions.duration_seconds END,
        feedback_at=CASE WHEN excluded.status='feedback_submitted' THEN excluded.feedback_at ELSE user_study_sessions.feedback_at END,
        participant_relation=COALESCE(user_study_sessions.participant_relation,excluded.participant_relation),
        participant_segment=COALESCE(user_study_sessions.participant_segment,excluded.participant_segment),
        updated_at=excluded.updated_at`).bind(owner,sessionKey,input.status,now,input.status==="task_completed"?now:null,duration,input.status==="feedback_submitted"?now:null,input.participantRelation??null,input.participantSegment??null,now).run();
  }
  return{status:input.status};
}

export async function readUserStudySummary(){
  const db=await getUserDatabase();await ensureTable(db);await ensureSessionTable(db);
  const externalFilter="consented_at IS NOT NULL AND participant_relation='external'";
  const response=await db.prepare(`SELECT COUNT(*) reviews,COUNT(DISTINCT participant_key) participants,SUM(CASE WHEN result='已修改' THEN 1 ELSE 0 END) modified,SUM(CASE WHEN result='维持计划' THEN 1 ELSE 0 END) maintained,SUM(CASE WHEN result='已延迟' THEN 1 ELSE 0 END) delayed,SUM(CASE WHEN result!='维持计划' THEN 1 ELSE 0 END) changed,SUM(risk_understood) understood,SUM(CASE WHEN length(trim(COALESCE(risk_explanation,'')))>=8 THEN 1 ELSE 0 END) risk_restatements,SUM(repeat_intent) repeat_intent,SUM(paid_intent) paid_intent,COUNT(DISTINCT CASE WHEN participant_segment IS NOT NULL THEN participant_segment END) represented_segments,AVG(duration_seconds) average_seconds,AVG(satisfaction) average_satisfaction FROM user_study_events WHERE ${externalFilter}`).all() as {results?:Array<Record<string,number|null>>};
  const internal=await db.prepare("SELECT COUNT(*) reviews FROM user_study_events WHERE consented_at IS NOT NULL AND participant_relation='team_member'").all() as {results?:Array<Record<string,number|null>>};
  const sessions=await db.prepare(`SELECT COUNT(*) started,SUM(CASE WHEN status IN ('completed','task_completed','feedback_submitted') THEN 1 ELSE 0 END) task_completed,SUM(CASE WHEN status='feedback_submitted' THEN 1 ELSE 0 END) feedback_submitted,SUM(CASE WHEN status IN ('completed','task_completed','feedback_submitted') AND duration_seconds<=15 THEN 1 ELSE 0 END) quick_completed,SUM(CASE WHEN status IN ('completed','task_completed','feedback_submitted') AND duration_seconds>15 THEN 1 ELSE 0 END) engaged_completed,SUM(CASE WHEN status='abandoned' OR (status='started' AND updated_at < datetime('now','-30 minutes')) THEN 1 ELSE 0 END) abandoned,AVG(CASE WHEN status IN ('completed','task_completed','feedback_submitted') THEN duration_seconds END) completion_seconds FROM user_study_sessions WHERE participant_relation='external'`).all() as {results?:Array<Record<string,number|null>>};
  const cohorts=await db.prepare(`SELECT participant_segment segment,COUNT(DISTINCT participant_key) participants FROM user_study_events WHERE ${externalFilter} AND participant_segment IS NOT NULL GROUP BY participant_segment`).all() as {results?:Array<{segment:string;participants:number}>};
  const segments=Object.fromEntries((cohorts.results??[]).map(item=>[item.segment,Number(item.participants)]));
  const row=response.results?.[0]??{};const funnel=sessions.results?.[0]??{};const internalRow=internal.results?.[0]??{};
  return{reviews:Number(row.reviews??0),participants:Number(row.participants??0),modified:Number(row.modified??0),maintained:Number(row.maintained??0),delayed:Number(row.delayed??0),changed:Number(row.changed??0),understood:Number(row.understood??0),riskRestatements:Number(row.risk_restatements??0),repeatIntent:Number(row.repeat_intent??0),paidIntent:Number(row.paid_intent??0),internalReviews:Number(internalRow.reviews??0),representedSegments:Number(row.represented_segments??0),segments,averageSeconds:row.average_seconds==null?null:Math.round(Number(row.average_seconds)),averageSatisfaction:row.average_satisfaction==null?null:Number(Number(row.average_satisfaction).toFixed(1)),started:Number(funnel.started??0),completed:Number(funnel.task_completed??0),feedbackSubmitted:Number(funnel.feedback_submitted??0),quickCompleted:Number(funnel.quick_completed??0),engagedCompleted:Number(funnel.engaged_completed??0),abandoned:Number(funnel.abandoned??0),completionSeconds:funnel.completion_seconds==null?null:Math.round(Number(funnel.completion_seconds))};
}

export async function exportCurrentUserStudyCsv(){const owner=await authenticatedOwnerKey();if(!owner)throw new Error("请先登录");const db=await getUserDatabase();await ensureTable(db);const response=await db.prepare(`SELECT substr(participant_key,1,12) participant,participant_relation,participant_segment,result,duration_seconds,satisfaction,risk_understood,risk_explanation,repeat_intent,paid_intent,confusing_step,consented_at,created_at FROM user_study_events WHERE owner_key=? ORDER BY created_at DESC`).bind(owner).all() as {results?:Array<Record<string,unknown>>};const header=["匿名参与者","样本关系","参与者类型","最终选择","完成耗时秒","满意度","自报看懂风险","主要风险复述","再次使用","愿意查看价格方案","最困惑步骤","同意时间","提交时间"];const rows=(response.results??[]).map(row=>[row.participant,row.participant_relation,row.participant_segment,row.result,row.duration_seconds,row.satisfaction,row.risk_understood,row.risk_explanation,row.repeat_intent,row.paid_intent,row.confusing_step,row.consented_at,row.created_at]);const escape=(value:unknown)=>`"${String(value??"").replaceAll('"','""')}"`;return `\uFEFF${[header,...rows].map(row=>row.map(escape).join(",")).join("\n")}`;}

export async function exportCurrentUserStudySessionsCsv(){const owner=await authenticatedOwnerKey();if(!owner)throw new Error("请先登录");const db=await getUserDatabase();await ensureSessionTable(db);const response=await db.prepare(`SELECT substr(session_key,1,12) session,participant_relation,participant_segment,status,started_at,completed_at,feedback_at,duration_seconds FROM user_study_sessions WHERE owner_key=? ORDER BY started_at DESC`).bind(owner).all() as {results?:Array<Record<string,unknown>>};const rows=[["匿名会话","样本关系","参与者类型","状态","开始时间","任务完成时间","反馈提交时间","任务耗时秒"],...(response.results??[]).map(row=>[row.session,row.participant_relation,row.participant_segment,row.status,row.started_at,row.completed_at,row.feedback_at,row.duration_seconds])];const escape=(value:unknown)=>`"${String(value??"").replaceAll('"','""')}"`;return `\uFEFF${rows.map(row=>row.map(escape).join(",")).join("\n")}`;}

export async function deleteCurrentUserStudyData(){const owner=await authenticatedOwnerKey();if(!owner)throw new Error("请先登录");const db=await getUserDatabase();await ensureTable(db);await ensureSessionTable(db);await db.batch([db.prepare("DELETE FROM user_study_events WHERE owner_key=?").bind(owner),db.prepare("DELETE FROM user_study_sessions WHERE owner_key=?").bind(owner)]);return{status:"deleted" as const};}
