import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import FixedCostManager from "../components/fixed-cost-manager";
import LogoutButton from "../components/logout-button";
import { isAuthenticated } from "../lib/auth";

export const metadata: Metadata = {
  title: "固定費 | kakeibo",
  description: "毎月の固定費を登録・編集します。",
};

export default async function FixedCostsPage() {
  const cookieStore = await cookies();

  if (!isAuthenticated(cookieStore.get("kakeibo_session")?.value)) {
    redirect("/login");
  }

  return (
    <main className="fixed-costs-main">
      <div className="fixed-costs-container">
        <header className="fixed-costs-header">
          <Link className="small-brand-title" href="/">kakeibo</Link>
          <LogoutButton />
        </header>

        <nav className="app-tabs" aria-label="家計簿の表示切り替え">
          <Link href="/">資産</Link>
          <span aria-current="page">固定費</span>
        </nav>

        <FixedCostManager />

        <div className="home-links">
          <Link className="updates-link" href="/updates">
            更新情報
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
