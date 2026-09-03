"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (response.ok) {
      router.push("/");
      router.refresh();
      return;
    }

    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    setMessage(data?.error ?? "ログインできませんでした。");
    setSubmitting(false);
  }

  return (
    <form className="login-form" onSubmit={login}>
      <label htmlFor="password">パスワード</label>
      <input autoComplete="current-password" id="password" name="password" required type="password" />
      <button disabled={submitting} type="submit">
        {submitting ? "確認中" : "ログイン"}
      </button>
      {message ? (
        <p className="login-error" role="alert">
          {message}
        </p>
      ) : null}
    </form>
  );
}
