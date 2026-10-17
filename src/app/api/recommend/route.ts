import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionAsync, SESSION_COOKIE } from "@/lib/session";
import { listOrdersForUserAsync } from "@/lib/stores";
import { DESIGNS } from "@/lib/data";
import { recommendForUser } from "@/lib/recommend";

// 与 /api/orders 一致：Node 运行时（D1 绑定需 Node）。切勿加 `export const runtime = "edge"`。

/**
 * GET /api/recommend
 * 登录用户的个性化 "For You" 推荐。
 *  - 匿名 / 无购买历史 → 返回 { forYou: [] }（前端据此不显示 "For You" 标签）。
 *  - 已登录且有订单 → 读取订单、推导类目/创作者偏好、融合全局打分后返回 ≤8 个 Design。
 * 任何异常都降级为空数组（200），不阻断首页渲染。
 */
export async function GET(request: NextRequest) {
  const user = await getSessionAsync(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ forYou: [] }, { status: 200 });
  }
  try {
    const orders = await listOrdersForUserAsync(user.id);
    const forYou = recommendForUser(DESIGNS, orders);
    return NextResponse.json(
      { forYou },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[recommend] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ forYou: [] }, { status: 200 });
  }
}
