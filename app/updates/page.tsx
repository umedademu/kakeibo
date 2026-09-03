import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "更新情報 | kakeibo",
  description: "個人的な家計簿アプリ kakeibo の更新履歴",
};

const updates = [
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
