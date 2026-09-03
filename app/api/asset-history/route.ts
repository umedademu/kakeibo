import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isAuthenticated, sessionCookieName } from "../../lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  if (!isAuthenticated(cookieStore.get(sessionCookieName)?.value)) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const workerUrl = process.env.CLOUDFLARE_WORKER_URL?.replace(/\/$/, "");
  const secret = process.env.CLOUDFLARE_SHARED_SECRET;

  if (!workerUrl || !secret) {
    return NextResponse.json(
      { error: "データ保管先への接続設定が完了していません。" },
      { status: 503 },
    );
  }

  const response = await fetch(`${workerUrl}/asset-history?days=30`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${secret}` },
  }).catch(() => null);

  if (!response?.ok) {
    return NextResponse.json({ error: "資産推移を取得できませんでした。" }, { status: 502 });
  }

  return NextResponse.json(await response.json(), {
    headers: { "Cache-Control": "no-store" },
  });
}
