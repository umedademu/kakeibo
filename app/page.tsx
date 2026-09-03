import Link from "next/link";

const balances = [
  { name: "財布", amount: 0 },
  { name: "PayPay", amount: 0 },
  { name: "PayPay銀行", amount: 0 },
  { name: "貯玉", amount: 0 },
  { name: "FX口座", amount: 0 },
];

export default function Home() {
  return (
    <main className="home-main">
      <div className="home-content">
        <h1 className="brand-title">kakeibo</h1>

        <dl className="balance-list" aria-label="資産残高">
          {balances.map((balance) => (
            <div className="balance-row" key={balance.name}>
              <dt>{balance.name}</dt>
              <dd>{balance.amount.toLocaleString("ja-JP")}円</dd>
            </div>
          ))}
        </dl>

        <Link className="updates-link" href="/updates">
          更新情報
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </main>
  );
}
