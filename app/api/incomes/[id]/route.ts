import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isAuthenticated, sessionCookieName } from "../../../lib/auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const cookieStore = await cookies();
  if (!isAuthenticated(cookieStore.get(sessionCookieName)?.value)) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!/^\d+$/.test(id) || Number(id) < 1) {
    return NextResponse.json({ error: "収入が見つかりません。" }, { status: 404 });
  }

  const workerUrl = process.env.CLOUDFLARE_WORKER_URL?.replace(/\/$/, "");
  const secret = process.env.CLOUDFLARE_SHARED_SECRET;
  if (!workerUrl || !secret) {
    return NextResponse.json(
      { error: "データ保管先への接続設定が完了していません。" },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const response = await fetch(`${workerUrl}/incomes/${id}`, {
    method: "PUT",
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
