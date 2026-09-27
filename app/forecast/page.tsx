import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AssetPeriodLinks } from "../components/asset-period-switch";
import ForecastTable from "../components/forecast-table";
import LogoutButton from "../components/logout-button";
import ThemeSwitcher from "../components/theme-switcher";
import { parseAssetPeriod } from "../lib/asset-period";
import { isAuthenticated } from "../lib/auth";

export const metadata: Metadata = {
  title: "未来の資産推移 | kakeibo",
  description: "収入と固定費の反映方法に合わせて計算した未来の資産推移表です。",
};

type ForecastPageProps = {
  searchParams: Promise<{ days?: string | string[] }>;
};

export default async function ForecastPage({ searchParams }: ForecastPageProps) {
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

        <section className="forecast-section" aria-labelledby="forecast-title">
          <header className="forecast-heading">
            <div className="forecast-title-row">
              <h1 id="forecast-title">未来{days}日間の資産推移</h1>
              <AssetPeriodLinks basePath="/forecast" days={days} label="未来の表示期間" />
            </div>
            <p>
              現在の総資産に、項目ごとに一括または日割りで反映した収入と固定費を加減した試算です。
              臨時収支や残高自体の変動は含みません。
            </p>
          </header>

          <ForecastTable days={days} />
        </section>

        <footer className="forecast-footer">
          <ThemeSwitcher />
          <LogoutButton />
        </footer>
      </div>
    </main>
  );
}
