"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function logout() {
    setSubmitting(true);
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button className="logout-button" disabled={submitting} onClick={logout} type="button">
      ログアウト
    </button>
  );
}
