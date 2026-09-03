"use client";

import { KeyboardEvent, useEffect, useState } from "react";

type ManualAccountId = "wallet" | "paypay" | "paypay_bank";

const manualAccounts: { accountId: ManualAccountId; name: string }[] = [
  { accountId: "wallet", name: "財布" },
  { accountId: "paypay", name: "PayPay" },
  { accountId: "paypay_bank", name: "PayPay銀行" },
];

const readonlyAccounts = [
  { accountId: "pachinko", name: "貯玉" },
  { accountId: "fx", name: "FX口座" },
];

type BalanceResponse = {
  accountId: string;
  name: string;
  amount: number;
  updatedAt: string | null;
};

const initialInputs: Record<ManualAccountId, string> = {
  wallet: "0",
  paypay: "0",
  paypay_bank: "0",
};

const initialMessages: Record<ManualAccountId, string> = {
  wallet: "残高を読み込んでいます。",
  paypay: "残高を読み込んでいます。",
  paypay_bank: "残高を読み込んでいます。",
};

function updatedMessage(balance: BalanceResponse | undefined) {
  return balance?.updatedAt
    ? `最終更新：${new Date(balance.updatedAt).toLocaleString("ja-JP")}`
    : "まだ残高は変更されていません。";
}

export default function BalanceList() {
  const [balances, setBalances] = useState<Record<string, BalanceResponse>>({});
  const [inputs, setInputs] = useState(initialInputs);
  const [messages, setMessages] = useState(initialMessages);
  const [editingAccount, setEditingAccount] = useState<ManualAccountId | null>(null);
  const [savingAccount, setSavingAccount] = useState<ManualAccountId | null>(null);
  const totalAssets = [...manualAccounts, ...readonlyAccounts].reduce(
    (total, account) => total + (balances[account.accountId]?.amount ?? 0),
    0,
  );

  useEffect(() => {
    let active = true;

    function loadBalances(initializeForms: boolean) {
      fetch("/api/balances", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("残高を読み込めませんでした。");
          }

          return (await response.json()) as BalanceResponse[];
        })
        .then((items) => {
          if (!active) return;
          const nextBalances = Object.fromEntries(items.map((item) => [item.accountId, item]));
          setBalances(nextBalances);

          if (!initializeForms) return;
          setInputs({
            wallet: String(nextBalances.wallet?.amount ?? 0),
            paypay: String(nextBalances.paypay?.amount ?? 0),
            paypay_bank: String(nextBalances.paypay_bank?.amount ?? 0),
          });
          setMessages({
            wallet: updatedMessage(nextBalances.wallet),
            paypay: updatedMessage(nextBalances.paypay),
            paypay_bank: updatedMessage(nextBalances.paypay_bank),
          });
        })
        .catch(() => {
          if (active && initializeForms) {
            const errorMessage = "残高を読み込めませんでした。しばらくしてから再度お試しください。";
            setMessages({
              wallet: errorMessage,
              paypay: errorMessage,
              paypay_bank: errorMessage,
            });
          }
        });
    }

    loadBalances(true);
    const intervalId = window.setInterval(() => loadBalances(false), 60 * 1000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  function startEditing(accountId: ManualAccountId) {
    const balance = balances[accountId];
    if (!balance || savingAccount) return;

    setInputs((current) => ({ ...current, [accountId]: String(balance.amount) }));
    setEditingAccount(accountId);
    setMessages((current) => ({ ...current, [accountId]: updatedMessage(balance) }));
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    }
  }

  async function saveBalance(accountId: ManualAccountId) {
    const amount = Number(inputs[accountId]);

    if (!Number.isSafeInteger(amount) || amount < 0) {
      setInputs((current) => ({
        ...current,
        [accountId]: String(balances[accountId]?.amount ?? 0),
      }));
      setEditingAccount(null);
      setMessages((current) => ({
        ...current,
        [accountId]: "0円以上の整数で入力してください。",
      }));
      return;
    }

    if (amount === balances[accountId]?.amount) {
      setEditingAccount(null);
      setMessages((current) => ({
        ...current,
        [accountId]: updatedMessage(balances[accountId]),
      }));
      return;
    }

    setSavingAccount(accountId);
    setMessages((current) => ({ ...current, [accountId]: "保存しています。" }));

    try {
      const response = await fetch(`/api/balances/${accountId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });

      if (!response.ok) {
        throw new Error("保存できませんでした。");
      }

      const data = (await response.json()) as Pick<BalanceResponse, "amount" | "updatedAt">;
      const account = manualAccounts.find((item) => item.accountId === accountId);
      setBalances((current) => ({
        ...current,
        [accountId]: {
          accountId,
          name: account?.name ?? accountId,
          amount: data.amount,
          updatedAt: data.updatedAt,
        },
      }));
      setInputs((current) => ({ ...current, [accountId]: String(data.amount) }));
      setMessages((current) => ({
        ...current,
        [accountId]: "保存しました。ほかの端末にも同じ残高が表示されます。",
      }));
      setEditingAccount(null);
    } catch {
      setMessages((current) => ({
        ...current,
        [accountId]: "保存できませんでした。しばらくしてから再度お試しください。",
      }));
    } finally {
      setSavingAccount(null);
    }
  }

  return (
    <section aria-labelledby="balance-heading">
      <h2 className="section-title" id="balance-heading">
        現在の残高
      </h2>

      <dl className="balance-list" aria-label="資産残高">
        <div className="balance-row total-balance-row">
          <dt>総資産</dt>
          <dd>{totalAssets.toLocaleString("ja-JP")}円</dd>
        </div>

        {manualAccounts.map((account) => (
          <div className="balance-row editable-balance-row" key={account.accountId}>
            <dt>{account.name}</dt>
            <dd>
              {editingAccount === account.accountId ? (
                <div className="balance-editor">
                  <label className="visually-hidden" htmlFor={`${account.accountId}-amount`}>
                    {account.name}の残高
                  </label>
                  <input
                    aria-describedby={`${account.accountId}-message`}
                    autoFocus
                    disabled={savingAccount === account.accountId}
                    id={`${account.accountId}-amount`}
                    inputMode="numeric"
                    min="0"
                    name="amount"
                    onBlur={() => void saveBalance(account.accountId)}
                    onChange={(event) => {
                      setInputs((current) => ({
                        ...current,
                        [account.accountId]: event.target.value,
                      }));
                      setMessages((current) => ({
                        ...current,
                        [account.accountId]: "入力を終えると自動保存します。",
                      }));
                    }}
                    onFocus={(event) => event.currentTarget.select()}
                    onKeyDown={handleEditorKeyDown}
                    step="1"
                    type="number"
                    value={inputs[account.accountId]}
                  />
                  <span>円</span>
                </div>
              ) : (
                <button
                  aria-label={`${account.name}の残高を編集`}
                  className="balance-value-button"
                  disabled={!balances[account.accountId] || savingAccount !== null}
                  onClick={() => startEditing(account.accountId)}
                  type="button"
                >
                  {(balances[account.accountId]?.amount ?? 0).toLocaleString("ja-JP")}円
                </button>
              )}
            </dd>
            <p
              className="balance-message"
              id={`${account.accountId}-message`}
              aria-live="polite"
            >
              {messages[account.accountId]}
            </p>
          </div>
        ))}

        {readonlyAccounts.map((account) => (
          <div className="balance-row readonly-balance-row" key={account.accountId}>
            <dt>{account.name}</dt>
            <dd>{(balances[account.accountId]?.amount ?? 0).toLocaleString("ja-JP")}円</dd>
            <p className="balance-message">
              {balances[account.accountId]
                ? updatedMessage(balances[account.accountId])
                : "残高を読み込んでいます。"}
            </p>
          </div>
        ))}
      </dl>

      <p className="cutoff-note">毎日午前4時の残高を、前日分として自動記録します。</p>
    </section>
  );
}
