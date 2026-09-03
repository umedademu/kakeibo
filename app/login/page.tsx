import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LoginForm from "./login-form";
import { isAuthenticated } from "../lib/auth";

export const metadata: Metadata = {
  title: "ログイン | kakeibo",
  description: "個人的な家計簿アプリ kakeibo へのログイン",
};

export default async function LoginPage() {
  const cookieStore = await cookies();

  if (isAuthenticated(cookieStore.get("kakeibo_session")?.value)) {
    redirect("/");
  }

  return (
    <main className="login-main">
      <div className="login-panel">
        <h1>kakeibo</h1>
        <p>個人の資産情報を表示するため、パスワードを入力してください。</p>
        <LoginForm />
      </div>
    </main>
  );
}
