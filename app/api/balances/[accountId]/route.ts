import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isAuthenticated, sessionCookieName } from "../../../lib/auth";

const editableAccountIds = new Set(["wallet", "paypay", "paypay_bank"]);

type RouteContext = {
  params: Promise<{ accountId: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const cookieStore = await cookies();
  if (!isAuthenticated(cookieStore.get(sessionCookieName)?.value)) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const { accountId } = await context.params;
  if (!editableAccountIds.has(accountId)) {
    return NextResponse.json({ error: "この項目は手動で変更できません。" }, { status: 400 });
  }

  const workerUrl = process.env.CLOUDFLARE_WORKER_URL?.replace(/\/$/, "");
  const secret = process.env.CLOUDFLARE_SHARED_SECRET;
  if (!workerUrl || !secret) {
    return NextResponse.json(
      { error: "データ保管先への接続設定が完了していません。" },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as { amount?: unknown } | null;
  const amount = body?.amount;
  if (!Number.isSafeInteger(amount) || Number(amount) < 0) {
    return NextResponse.json({ error: "残高が正しくありません。" }, { status: 400 });
  }

  const response = await fetch(`${workerUrl}/balances/${accountId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${secret}`,
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
