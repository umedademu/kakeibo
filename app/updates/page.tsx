import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "更新情報 | kakeibo",
  description: "個人的な家計簿アプリ kakeibo の更新履歴",
};

const updates = [
  {
    version: "v0.1.17",
    date: "2026年9月3日",
    dateTime: "2026-09-03",
    title: "直近30日の資産推移を追加",
    changes: [
      "パソコンでは現在の資産表示を左、直近30日の資産推移を右に、4対6の割合で配置しました。",
      "毎日午前4時に記録した5項目の合計を、折れ線グラフで確認できます。",
      "スマートフォンでは、現在の資産表示とグラフを上下に並べます。",
    ],
  },
  {
    version: "v0.1.16",
    date: "2026年9月3日",
    dateTime: "2026-09-03",
    title: "収入の登録画面を追加",
    changes: [
      "資産、固定費に加えて、収入を管理できるタブを追加しました。",
      "着金日、摘要、金額を入力し、収入の新規追加と編集ができます。",
      "登録内容をCloudflareへ保存し、収入の合計額も表示します。",
    ],
  },
  {
    version: "v0.1.15",
    date: "2026年9月3日",
    dateTime: "2026-09-03",
    title: "固定費一覧の見出しを変更",
    changes: [
      "登録済みの件数表示を省き、支払日、摘要、金額の列見出しを追加しました。",
      "各支払日は「毎月」を省略し、「22日」のように日付だけを表示します。",
    ],
  },
  {
    version: "v0.1.14",
    date: "2026年9月3日",
    dateTime: "2026-09-03",
    title: "固定費の列順を変更",
    changes: [
      "固定費の入力欄、登録済み一覧、編集欄を、支払日、項目名、金額の順に統一しました。",
    ],
  },
  {
    version: "v0.1.13",
    date: "2026年9月3日",
    dateTime: "2026-09-03",
    title: "固定費の合計表示を追加",
    changes: [
      "登録されている固定費の合計額を、固定費画面の一番下に表示するようにしました。",
      "固定費を追加または編集すると、合計額もすぐに更新されます。",
    ],
  },
  {
    version: "v0.1.12",
    date: "2026年9月3日",
    dateTime: "2026-09-03",
    title: "固定費の入力欄を簡略化",
    changes: [
      "固定費画面の見出しと説明文を省き、表示をすっきりさせました。",
      "項目名、金額、支払日の入力欄と追加ボタンを横1行にまとめました。",
    ],
  },
  {
    version: "v0.1.11",
    date: "2026年9月3日",
    dateTime: "2026-09-03",
    title: "固定費の登録画面を追加",
    changes: [
      "資産画面とは別に、固定費を管理できる画面を追加しました。",
      "項目名、金額、毎月の支払日を入力して、新しい固定費を登録できます。",
      "登録済みの固定費を編集し、変更内容をCloudflareへ保存できます。",
    ],
  },
  {
    version: "v0.1.10",
    date: "2026年9月3日",
    dateTime: "2026-09-03",
    title: "FX口座に含み損益を反映",
    changes: [
      "FX口座の取得対象を、MT5の口座残高から有効証拠金へ変更しました。",
      "保有中の取引に生じている含み益・含み損を、FX口座と総資産に反映します。",
      "取得時刻は、これまでどおり日本時間の午前1時、3時59分、9時、13時、17時、21時です。",
    ],
  },
  {
    version: "v0.1.9",
    date: "2026年9月3日",
    dateTime: "2026-09-03",
    title: "残高入力画面を簡潔に変更",
    changes: [
      "財布、PayPay、PayPay銀行は、普段は金額だけを表示するようにしました。",
      "金額を押すと入力欄へ切り替わり、入力後は保存ボタンなしで自動保存します。",
      "貯玉とFX口座にも最終更新時刻を表示するようにしました。",
    ],
  },
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
