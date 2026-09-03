import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import BalanceList from "./components/balance-list";
import LogoutButton from "./components/logout-button";
import { isAuthenticated } from "./lib/auth";

export default async function Home() {
  const cookieStore = await cookies();

  if (!isAuthenticated(cookieStore.get("kakeibo_session")?.value)) {
    redirect("/login");
  }

  return (
    <main className="home-main">
      <div className="home-content">
        <header className="home-header">
          <h1 className="brand-title">kakeibo</h1>
          <LogoutButton />
        </header>

        <BalanceList />

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
