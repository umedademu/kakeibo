import { NextResponse } from "next/server";
import {
  createSessionValue,
  isAuthenticationConfigured,
  passwordMatches,
  sessionCookieName,
} from "../../lib/auth";

export async function POST(request: Request) {
  if (!isAuthenticationConfigured()) {
    return NextResponse.json(
      { error: "ログイン設定が完了していません。" },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";

  if (!passwordMatches(password)) {
    return NextResponse.json({ error: "パスワードが違います。" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, createSessionValue(), {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
