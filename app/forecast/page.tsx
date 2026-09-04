import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ForecastTable from "../components/forecast-table";
import LogoutButton from "../components/logout-button";
import { isAuthenticated } from "../lib/auth";

export const metadata: Metadata = {
  title: "未来30日間の資産推移 | kakeibo",
  description: "収入と固定費を日割りして計算した未来30日間の資産推移表です。",
};

export default async function ForecastPage() {
  const cookieStore = await cookies();

  if (!isAuthenticated(cookieStore.get("kakeibo_session")?.value)) {
    redirect("/login");
  }

  return (
    <main className="forecast-main">
      <div className="forecast-container">
        <header className="fixed-costs-header">
          <Link className="small-brand-title" href="/">
            kakeibo
          </Link>
          <LogoutButton />
        </header>

        <Link className="back-link forecast-back-link" href="/">
          <span aria-hidden="true">←</span>
          資産画面に戻る
        </Link>

        <section className="forecast-section" aria-labelledby="forecast-title">
          <header className="forecast-heading">
            <h1 id="forecast-title">未来30日間の資産推移</h1>
            <p>
              現在の総資産に、収入と固定費をその月の日数で割った1日分を毎日加減した試算です。
              臨時収支や残高自体の変動は含みません。
            </p>
          </header>

          <ForecastTable />
        </section>
      </div>
    </main>
  );
}
