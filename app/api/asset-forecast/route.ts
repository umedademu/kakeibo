import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAssetForecast } from "../../lib/asset-forecast";
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

  const headers = { Authorization: `Bearer ${secret}` };
  const [balancesResponse, fixedCostsResponse, incomesResponse] = await Promise.all([
    fetch(`${workerUrl}/balances`, { cache: "no-store", headers }).catch(() => null),
    fetch(`${workerUrl}/fixed-costs`, { cache: "no-store", headers }).catch(() => null),
    fetch(`${workerUrl}/incomes`, { cache: "no-store", headers }).catch(() => null),
  ]);

  if (!balancesResponse?.ok || !fixedCostsResponse?.ok || !incomesResponse?.ok) {
    return NextResponse.json({ error: "未来の資産推移を計算できませんでした。" }, { status: 502 });
  }

  const forecast = createAssetForecast(
    await balancesResponse.json().catch(() => null),
    await fixedCostsResponse.json().catch(() => null),
    await incomesResponse.json().catch(() => null),
  );

  if (!forecast) {
    return NextResponse.json({ error: "未来の資産推移を計算できませんでした。" }, { status: 502 });
  }

  return NextResponse.json(forecast, {
    headers: { "Cache-Control": "no-store" },
  });
}
