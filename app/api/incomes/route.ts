import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isAuthenticated, sessionCookieName } from "../../lib/auth";

function connection() {
  return {
    workerUrl: process.env.CLOUDFLARE_WORKER_URL?.replace(/\/$/, "") ?? "",
    secret: process.env.CLOUDFLARE_SHARED_SECRET ?? "",
  };
}

async function authenticated() {
  const cookieStore = await cookies();
  return isAuthenticated(cookieStore.get(sessionCookieName)?.value);
}

export async function GET() {
  if (!(await authenticated())) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const { workerUrl, secret } = connection();
  if (!workerUrl || !secret) {
    return NextResponse.json(
      { error: "データ保管先への接続設定が完了していません。" },
      { status: 503 },
    );
  }

  const response = await fetch(`${workerUrl}/incomes`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${secret}` },
  }).catch(() => null);

  if (!response?.ok) {
    return NextResponse.json({ error: "収入を取得できませんでした。" }, { status: 502 });
  }

  return NextResponse.json(await response.json(), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!(await authenticated())) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const { workerUrl, secret } = connection();
  if (!workerUrl || !secret) {
    return NextResponse.json(
      { error: "データ保管先への接続設定が完了していません。" },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const response = await fetch(`${workerUrl}/incomes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }).catch(() => null);

  if (!response) {
    return NextResponse.json({ error: "収入を保存できませんでした。" }, { status: 502 });
  }

  const responseBody = await response.json().catch(() => ({
    error: "収入を保存できませんでした。",
  }));
  return NextResponse.json(responseBody, {
    status: response.status,
    headers: { "Cache-Control": "no-store" },
  });
}
