import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "更新情報 | kakeibo",
  description: "個人的な家計簿アプリ kakeibo の更新履歴",
};

const updates = [
  {
    version: "v0.1.8",
    date: "2026年9月3日",
    dateTime: "2026-09-03",
    title: "MT5残高の取得頻度を変更",
    changes: [
      "MT5のドル残高とドル円レートの取得を1日6回に変更しました。",
      "日本時間の午前1時、3時59分、9時、13時、17時、21時だけ取得します。",
      "午前3時59分の取得結果を、午前4時の日別記録へ反映します。",
    ],
  },
  {
    version: "v0.1.7",
    date: "2026年9月3日",
    dateTime: "2026-09-03",
    title: "MT5のFX口座残高を自動連携",
    changes: [
      "常用しているMT5のドル残高を定期的に取得するようにしました。",
      "MT5のドル円レートで円換算し、FX口座と総資産へ自動反映します。",
      "画面を開いたままでも、最新の残高を定期的に読み込みます。",
      "午前4時の日別記録に間に合うよう、午前3時59分にも残高を更新します。",
    ],
  },
  {
    version: "v0.1.6",
    date: "2026年9月3日",
    dateTime: "2026-09-03",
    title: "総資産の表示を追加",
    changes: [
      "財布、PayPay、PayPay銀行、貯玉、FX口座の合計を、総資産として表示するようにしました。",
      "各残高を変更すると、総資産にもすぐに反映されます。",
    ],
  },
  {
    version: "v0.1.5",
    date: "2026年9月3日",
    dateTime: "2026-09-03",
    title: "PayPay残高の手動入力に対応",
    changes: [
      "PayPayとPayPay銀行の残高を、財布と同じように入力して保存できるようにしました。",
      "保存した残高は共通の保管先へ反映され、パソコンとスマートフォンで共有されます。",
    ],
  },
  {
    version: "v0.1.4",
    date: "2026年9月3日",
    dateTime: "2026-09-03",
    title: "貯玉残高の自動連携に対応",
    changes: [
      "収支管理アプリに保存された全店舗合計の貯玉を、円換算して取り込むようにしました。",
      "毎日午前4時に最新の貯玉残高を取得し、前日分として自動記録します。",
    ],
  },
  {
    version: "v0.1.3",
    date: "2026年9月3日",
    dateTime: "2026-09-03",
    title: "財布残高の共有と日別記録に対応",
    changes: [
      "財布の残高を入力して、パソコンとスマートフォンで共有できるようにしました。",
      "毎日午前4時の残高を前日分として自動記録する仕組みを追加しました。",
      "個人の資産情報を守るため、ログイン画面を追加しました。",
    ],
  },
  {
    version: "v0.1.2",
    date: "2026年9月3日",
    dateTime: "2026-09-03",
    title: "データの保管先を準備",
    changes: [
      "Cloudflareにkakeibo専用のD1データベースを作成しました。",
      "保存する内容と接続方法は、今後の仕様に合わせて追加します。",
    ],
  },
  {
    version: "v0.1.1",
    date: "2026年9月3日",
    dateTime: "2026-09-03",
    title: "5つの残高を表示",
    changes: [
      "トップページに財布、PayPay、PayPay銀行、貯玉、FX口座の残高を追加しました。",
      "初期残高はすべて0円に設定しています。",
    ],
  },
  {
    version: "v0.1.0",
    date: "2026年9月3日",
    dateTime: "2026-09-03",
    title: "kakeiboの開発を開始",
    changes: [
      "Vercelで動作するWebアプリの土台を作成しました。",
      "更新履歴を確認できるページを追加しました。",
    ],
  },
];

export default function UpdatesPage() {
  return (
    <main className="updates-main">
      <div className="updates-container">
        <Link className="back-link" href="/">
          <span aria-hidden="true">←</span>
          kakeiboに戻る
        </Link>

        <header className="updates-header">
          <h1>更新情報</h1>
          <p>kakeiboの機能追加や改善の履歴をお知らせします。</p>
        </header>

        <ol className="update-list">
          {updates.map((update) => (
            <li className="update-item" key={update.version}>
              <div className="update-meta">
                <span className="update-version">{update.version}</span>
                <time className="update-date" dateTime={update.dateTime}>
                  {update.date}
                </time>
              </div>

              <article className="update-body">
                <h2>{update.title}</h2>
                <ul>
                  {update.changes.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
