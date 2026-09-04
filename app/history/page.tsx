import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AssetHistoryTable from "../components/asset-history-table";
import { AssetPeriodLinks } from "../components/asset-period-switch";
import LogoutButton from "../components/logout-button";
import { parseAssetPeriod } from "../lib/asset-period";
import { isAuthenticated } from "../lib/auth";

export const metadata: Metadata = {
  title: "過去の資産推移 | kakeibo",
  description: "毎日午前4時に記録した過去の総資産を確認できる表です。",
};

type HistoryPageProps = {
  searchParams: Promise<{ days?: string | string[] }>;
};

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const cookieStore = await cookies();

  if (!isAuthenticated(cookieStore.get("kakeibo_session")?.value)) {
    redirect("/login");
  }

  const params = await searchParams;
  const daysValue = Array.isArray(params.days) ? params.days[0] : params.days;
  const days = parseAssetPeriod(daysValue);

  return (
    <main className="forecast-main">
      <div className="forecast-container">
        <Link className="back-link forecast-back-link" href="/">
          <span aria-hidden="true">←</span>
          資産画面に戻る
        </Link>

        <section className="forecast-section" aria-labelledby="history-title">
          <header className="forecast-heading">
            <div className="forecast-title-row">
              <h1 id="history-title">過去{days}日間の資産推移</h1>
              <AssetPeriodLinks basePath="/history" days={days} label="過去の表示期間" />
            </div>
            <p>毎日午前4時に前日分として記録した、借金を含めない総資産です。</p>
          </header>

          <AssetHistoryTable days={days} />
        </section>

        <footer className="forecast-footer">
          <LogoutButton />
        </footer>
      </div>
    </main>
  );
}
