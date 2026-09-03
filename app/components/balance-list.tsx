"use client";

import { FormEvent, useEffect, useState } from "react";

const fixedBalances = [
  { name: "PayPay", amount: 0 },
  { name: "PayPay銀行", amount: 0 },
  { name: "貯玉", amount: 0 },
  { name: "FX口座", amount: 0 },
];

type WalletResponse = {
  amount: number;
  updatedAt: string | null;
};

export default function BalanceList() {
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [input, setInput] = useState("0");
  const [message, setMessage] = useState("残高を読み込んでいます。");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    fetch("/api/wallet", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("残高を読み込めませんでした。");
        }

        return (await response.json()) as WalletResponse;
      })
      .then((data) => {
        if (!active) return;
        setWallet(data);
        setInput(String(data.amount));
        setMessage(
          data.updatedAt
            ? `最終更新：${new Date(data.updatedAt).toLocaleString("ja-JP")}`
            : "まだ残高は変更されていません。",
        );
      })
      .catch(() => {
        if (active) {
          setMessage("残高を読み込めませんでした。しばらくしてから再度お試しください。");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function saveWallet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(input);

    if (!Number.isSafeInteger(amount) || amount < 0) {
      setMessage("0円以上の整数で入力してください。");
      return;
    }

    setSaving(true);
    setMessage("保存しています。");

    try {
      const response = await fetch("/api/wallet", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });

      if (!response.ok) {
        throw new Error("保存できませんでした。");
      }

      const data = (await response.json()) as WalletResponse;
      setWallet(data);
      setInput(String(data.amount));
      setMessage("保存しました。ほかの端末にも同じ残高が表示されます。");
    } catch {
      setMessage("保存できませんでした。しばらくしてから再度お試しください。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="balance-heading">
      <h2 className="section-title" id="balance-heading">
        現在の残高
      </h2>

      <dl className="balance-list" aria-label="資産残高">
        <div className="balance-row wallet-row">
          <dt>財布</dt>
          <dd>
            <form className="wallet-form" onSubmit={saveWallet}>
              <label className="visually-hidden" htmlFor="wallet-amount">
                財布の残高
              </label>
              <input
                id="wallet-amount"
                inputMode="numeric"
                min="0"
                name="amount"
                onChange={(event) => setInput(event.target.value)}
                step="1"
                type="number"
                value={input}
              />
              <span>円</span>
              <button disabled={saving || wallet === null} type="submit">
                {saving ? "保存中" : "保存"}
              </button>
            </form>
          </dd>
          <p className="wallet-message" aria-live="polite">
            {message}
          </p>
        </div>

        {fixedBalances.map((balance) => (
          <div className="balance-row" key={balance.name}>
            <dt>{balance.name}</dt>
            <dd>{balance.amount.toLocaleString("ja-JP")}円</dd>
          </div>
        ))}
      </dl>

      <p className="cutoff-note">毎日午前4時の残高を、前日分として自動記録します。</p>
    </section>
  );
}
