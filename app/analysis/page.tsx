import ClientHome from "../client-page";
import { requireChatGPTUser } from "../chatgpt-auth";

export const dynamic = "force-dynamic";

type AnalysisView = "desk" | "research" | "newDecision" | "decision" | "decisionResult" | "history" | "portfolio" | "rules" | "privacy";
const allowedViews = new Set<AnalysisView>(["desk", "research", "newDecision", "decision", "decisionResult", "history", "portfolio", "rules", "privacy"]);

export default async function AnalysisPage({ searchParams }: { searchParams?: Promise<{ view?: string }> }) {
  const user = await requireChatGPTUser("/analysis");
  const requestedView = (await searchParams)?.view as AnalysisView | undefined;
  const initialView = requestedView && allowedViews.has(requestedView) ? requestedView : "research";
  return <ClientHome authenticatedUser={user.fullName ?? user.email.split("@")[0]} initialView={initialView} />;
}
