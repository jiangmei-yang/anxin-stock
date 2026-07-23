import {requireChatGPTUser} from "../chatgpt-auth";
import {PilotJourney} from "../components/pilot-journey";
import {ProductToolShell} from "../components/product-tool-shell";
import {readPilotState} from "../lib/pilot-study";
export const dynamic="force-dynamic";
export default async function PilotPage(){await requireChatGPTUser("/pilot");const state=await readPilotState().catch(()=>({joined:false,participantRelation:undefined}));return <ProductToolShell active="pilot" title="早期用户体验研究" description="完成一次中性的交易前审查，提交匿名反馈，再自行决定是否加入付费测试候补。" status="约 5 分钟 · 不执行交易"><PilotJourney initialJoined={state.joined} initialJoinRelation={state.participantRelation}/></ProductToolShell>}
