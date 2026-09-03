import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "更新情報 | kakeibo",
  description: "個人的な家計簿アプリ kakeibo の更新履歴",
};

const updates = [
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
