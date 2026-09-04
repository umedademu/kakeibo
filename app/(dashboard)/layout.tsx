import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AppTabs from "../components/app-tabs";
import AssetHistoryChart from "../components/asset-history-chart";
import FutureAssetChart from "../components/future-asset-chart";
import LogoutButton from "../components/logout-button";
import { isAuthenticated } from "../lib/auth";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();

  if (!isAuthenticated(cookieStore.get("kakeibo_session")?.value)) {
    redirect("/login");
  }

  return (
    <main className="home-main">
      <div className="home-content">
        <section className="home-summary" aria-label="家計簿の管理内容">
          <AppTabs />

          <div className="dashboard-view">{children}</div>

          <div className="home-links">
            <Link className="updates-link" href="/updates">
              更新情報
              <span aria-hidden="true">→</span>
            </Link>
            <LogoutButton />
          </div>
        </section>

        <aside className="home-charts" aria-label="資産推移グラフ">
          <FutureAssetChart />
          <AssetHistoryChart />
        </aside>
      </div>
    </main>
  );
}
