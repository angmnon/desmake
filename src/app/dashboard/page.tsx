import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionAsync, SESSION_COOKIE } from "@/lib/session";
import { DashboardClient } from "./DashboardClient";

// Reads the session cookie → must render per request. The root layout is now ISR
// (revalidate=600); keep this route explicitly dynamic so a user never sees
// another account's dashboard from the edge cache.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Creator dashboard — Desmake",
  description: "Track your designs, earnings, and referral growth on Desmake.",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = await getSessionAsync(token);
  if (!user) redirect("/auth?next=/dashboard");

  return <DashboardClient handle={user.handle} name={user.name} />;
}
