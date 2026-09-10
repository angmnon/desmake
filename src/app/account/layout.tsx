import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionAsync } from "@/lib/session";

// B1 migration: replaces the auth fast-path that used to live in proxy.ts
// (Next 16's Node.js middleware, which OpenNext does not support). This layout
// runs per request and bounces signed-out visitors to /auth before the page renders.
export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const token = (await cookies()).get("dm_session")?.value;
  const session = await getSessionAsync(token);
  if (!session) redirect("/auth?next=/account");
  return <>{children}</>;
}
