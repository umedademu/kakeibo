import { NextResponse } from "next/server";
import { sessionCookieName } from "../../lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, "", {
    expires: new Date(0),
    httpOnly: true,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
