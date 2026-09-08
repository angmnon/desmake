import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession, SESSION_COOKIE } from "@/lib/session";
import { creatorAnalytics, perDesignAnalytics } from "@/lib/analytics";

// No edge runtime — reads the analytics + earnings stores / D1 (R2/C1).

export async function GET(request: NextRequest) {
  const user = getSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in to view analytics" } }, { status: 401 });
  }
  const [overview, designs] = await Promise.all([
    creatorAnalytics(user.id),
    perDesignAnalytics(user.id),
  ]);
  return NextResponse.json({ overview, designs }, { headers: { "Cache-Control": "no-store" } });
}
