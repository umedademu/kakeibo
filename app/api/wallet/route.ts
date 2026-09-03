import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isAuthenticated, sessionCookieName } from "../../lib/auth";

function getConnection() {
  const url = process.env.CLOUDFLARE_WORKER_URL?.replace(/\/$/, "");
  const secret = process.env.CLOUDFLARE_SHARED_SECRET;

  if (!url || !secret) {
    return null;
  }

  return { url, secret };
}

async function hasValidSession() {
  const cookieStore = await cookies();
  return isAuthenticated(cookieStore.get(sessionCookieName)?.value);
}

function unavailable() {
  return NextResponse.json(
    { error: "データ保管先への接続設定が完了していません。" },
    { status: 503 },
  );
}

export async function GET() {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const connection = getConnection();
  if (!connection) return unavailable();

  const response = await fetch(`${connection.url}/balances/wallet`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${connection.secret}` },
  }).catch(() => null);

  if (!response?.ok) {
    return NextResponse.json({ error: "残高を取得できませんでした。" }, { status: 502 });
  }

  return NextResponse.json(await response.json(), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PUT(request: Request) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const connection = getConnection();
  if (!connection) return unavailable();

  const body = (await request.json().catch(() => null)) as { amount?: unknown } | null;
  const amount = body?.amount;

  if (!Number.isSafeInteger(amount) || Number(amount) < 0) {
    return NextResponse.json({ error: "残高が正しくありません。" }, { status: 400 });
  }

  const response = await fetch(`${connection.url}/balances/wallet`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${connection.secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount }),
  }).catch(() => null);

  if (!response?.ok) {
    return NextResponse.json({ error: "残高を保存できませんでした。" }, { status: 502 });
  }

  return NextResponse.json(await response.json(), {
    headers: { "Cache-Control": "no-store" },
  });
}
