import { headers } from "next/headers";

import { PersonalWorkbench } from "../components/personal-workbench";

export default async function AISettingsPage() {
  const requestHeaders = await headers();
  const user = requestHeaders.get("oai-authenticated-user-email") ?? "已登录用户";
  return <PersonalWorkbench surface="ai-settings" authenticatedUser={user} />;
}
