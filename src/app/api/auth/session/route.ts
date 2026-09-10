import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionAsync, SESSION_COOKIE } from "@/lib/session";

export async function GET(request: NextRequest) {
  const user = await getSessionAsync(request.cookies.get(SESSION_COOKIE)?.value);
  return NextResponse.json({ user }, { headers: { "Cache-Control": "no-store" } });
}
