"use client";

import { FormEvent, useEffect, useState } from "react";

type IncomeAccrualMethod = "lump_sum" | "daily";

type FixedCost = {
  id: number;
  name: string;
  amount: number;
  paymentDay?: number;
  accrualMethod?: IncomeAccrualMethod;
  createdAt: string;
  updatedAt: string;
};

type Draft = {
  name: string;
  amount: string;
  paymentDay: string;
  accrualMethod: IncomeAccrualMethod;
};

type ManagerKind = "fixed-costs" | "incomes" | "debts";

type FixedCostManagerProps = {
  kind?: ManagerKind;
};

type ManagerSettings = {
  apiPath: string;
  subject: string;
  dayLabel: string | null;
  nameInputLabel: string;
  emptyMessage: string;
  totalLabel: string;
};

const managerSettings: Record<ManagerKind, ManagerSettings> = {
  "fixed-costs": {
    apiPath: "/api/fixed-costs",
    subject: "固定費",
    dayLabel: "支払日",
    nameInputLabel: "項目名",
    emptyMessage: "登録済みの固定費はありません。",
    totalLabel: "固定費合計",
  },
  incomes: {
    apiPath: "/api/incomes",
    subject: "収入",
    dayLabel: "着金日",
    nameInputLabel: "摘要",
    emptyMessage: "登録済みの収入はありません。",
    totalLabel: "収入合計",
  },
  debts: {
    apiPath: "/api/debts",
    subject: "借金",
    dayLabel: null,
    nameInputLabel: "摘要",
    emptyMessage: "登録済みの借金はありません。",
    totalLabel: "借金合計",
  },
};

const emptyDraft: Draft = {
  name: "",
  amount: "",
  paymentDay: "",
  accrualMethod: "lump_sum",
};

function sorted(items: FixedCost[], hasDay: boolean) {
  return [...items].sort((a, b) =>
    hasDay ? (a.paymentDay ?? 0) - (b.paymentDay ?? 0) || a.id - b.id : a.id - b.id,
  );
}

function values(draft: Draft, hasDay: boolean, isIncome: boolean) {
  const name = draft.name.trim();
  const amount = Number(draft.amount);

  if (!name || name.length > 80 || !Number.isSafeInteger(amount) || amount < 0) {
    return null;
  }

  if (!hasDay) {
    return { name, amount };
  }

  const paymentDay = Number(draft.paymentDay);
  if (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 31) {
    return null;
  }

  if (isIncome) {
    return { name, amount, paymentDay, accrualMethod: draft.accrualMethod };
  }

  return { name, amount, paymentDay };
}

export default function FixedCostManager({ kind = "fixed-costs" }: FixedCostManagerProps) {
  const settings = managerSettings[kind];
  const hasDay = settings.dayLabel !== null;
  const isIncome = kind === "incomes";
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [newDraft, setNewDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const totalAmount = fixedCosts.reduce((total, item) => total + item.amount, 0);

  useEffect(() => {
    let active = true;

    fetch(settings.apiPath, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`${settings.subject}を読み込めませんでした。`);
        }
        return (await response.json()) as FixedCost[];
      })
      .then((items) => {
        if (active) {
          setFixedCosts(sorted(items, hasDay));
        }
      })
      .catch(() => {
        if (active) {
          setMessage(`${settings.subject}を読み込めませんでした。時間をおいて再度お試しください。`);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [hasDay, settings]);

  async function addFixedCost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = values(newDraft, hasDay, isIncome);
    if (!body) {
      setMessage(
        hasDay
          ? `${settings.nameInputLabel}、0円以上の金額、1～31日の${settings.dayLabel}を入力してください。`
          : `${settings.nameInputLabel}と0円以上の金額を入力してください。`,
      );
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(settings.apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error();
      }

      const saved = (await response.json()) as FixedCost;
      setFixedCosts((current) => sorted([...current, saved], hasDay));
      setNewDraft(emptyDraft);
      setMessage(`${settings.subject}を追加しました。`);
    } catch {
      setMessage(`${settings.subject}を保存できませんでした。時間をおいて再度お試しください。`);
    } finally {
      setSaving(false);
    }
  }

  function startEditing(item: FixedCost) {
    setEditingId(item.id);
    setEditDraft({
      name: item.name,
      amount: String(item.amount),
      paymentDay: item.paymentDay === undefined ? "" : String(item.paymentDay),
      accrualMethod: item.accrualMethod ?? "lump_sum",
    });
    setMessage("");
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingId === null) {
      return;
    }

    const body = values(editDraft, hasDay, isIncome);
    if (!body) {
      setMessage(
        hasDay
          ? `${settings.nameInputLabel}、0円以上の金額、1～31日の${settings.dayLabel}を入力してください。`
          : `${settings.nameInputLabel}と0円以上の金額を入力してください。`,
      );
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`${settings.apiPath}/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error();
      }

      const saved = (await response.json()) as FixedCost;
      setFixedCosts((current) =>
        sorted(current.map((item) => (item.id === saved.id ? saved : item)), hasDay),
      );
      setEditingId(null);
      setMessage(`${settings.subject}を更新しました。`);
    } catch {
      setMessage(`${settings.subject}を保存できませんでした。時間をおいて再度お試しください。`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="fixed-cost-section" aria-labelledby={`${kind}-heading`}>
      <h1 className="visually-hidden" id={`${kind}-heading`}>{settings.subject}</h1>

      <form
        aria-label={`${settings.subject}の新規追加`}
        className={`fixed-cost-form${isIncome ? " income-form" : hasDay ? "" : " debt-form"}`}
        onSubmit={addFixedCost}
      >
        {hasDay ? (
          <input
            aria-label={settings.dayLabel ?? undefined}
            inputMode="numeric"
            max="31"
            min="1"
            onChange={(event) =>
              setNewDraft((current) => ({
                ...current,
                paymentDay: event.target.value,
              }))
            }
            placeholder={settings.dayLabel ?? undefined}
            required
            step="1"
            type="number"
            value={newDraft.paymentDay}
          />
        ) : null}
        {isIncome ? (
          <select
            aria-label="反映"
            onChange={(event) =>
              setNewDraft((current) => ({
                ...current,
                accrualMethod: event.target.value as IncomeAccrualMethod,
              }))
            }
            value={newDraft.accrualMethod}
          >
            <option value="lump_sum">一括</option>
            <option value="daily">日割り</option>
          </select>
        ) : null}
        <input
          aria-label={settings.nameInputLabel}
          maxLength={80}
          onChange={(event) =>
            setNewDraft((current) => ({ ...current, name: event.target.value }))
          }
          placeholder={settings.nameInputLabel}
          required
          type="text"
          value={newDraft.name}
        />
        <input
          aria-label="金額"
          inputMode="numeric"
          min="0"
          onChange={(event) =>
            setNewDraft((current) => ({ ...current, amount: event.target.value }))
          }
          placeholder="金額"
          required
          step="1"
          type="number"
          value={newDraft.amount}
        />
        <button className="primary-button" disabled={saving} type="submit">
          {saving ? "保存中…" : "追加"}
        </button>
      </form>

      <div
        className={`fixed-cost-column-headings${isIncome ? " income-column-headings" : hasDay ? "" : " debt-column-headings"}`}
      >
        {hasDay ? <span>{settings.dayLabel}</span> : null}
        {isIncome ? <span>反映</span> : null}
        <span>摘要</span>
        <span>金額</span>
        <span aria-hidden="true" />
      </div>

      {message ? <p className="fixed-cost-message" role="status">{message}</p> : null}

      {loading ? (
        <p className="fixed-cost-empty">読み込み中…</p>
      ) : fixedCosts.length === 0 ? (
        <p className="fixed-cost-empty">{settings.emptyMessage}</p>
      ) : (
        <ul className="fixed-cost-list">
          {fixedCosts.map((item) => (
            <li key={item.id}>
              {editingId === item.id ? (
                <form
                  className={`fixed-cost-edit-form${isIncome ? " income-edit-form" : hasDay ? "" : " debt-edit-form"}`}
                  onSubmit={saveEdit}
                >
                  {hasDay ? (
                    <label>
                      {settings.dayLabel}
                      <input
                        inputMode="numeric"
                        max="31"
                        min="1"
                        onChange={(event) =>
                          setEditDraft((current) => ({
                            ...current,
                            paymentDay: event.target.value,
                          }))
                        }
                        required
                        step="1"
                        type="number"
                        value={editDraft.paymentDay}
                      />
                    </label>
                  ) : null}
                  {isIncome ? (
                    <label>
                      反映
                      <select
                        onChange={(event) =>
                          setEditDraft((current) => ({
                            ...current,
                            accrualMethod: event.target.value as IncomeAccrualMethod,
                          }))
                        }
                        value={editDraft.accrualMethod}
                      >
                        <option value="lump_sum">一括</option>
                        <option value="daily">日割り</option>
                      </select>
                    </label>
                  ) : null}
                  <label>
                    {settings.nameInputLabel}
                    <input
                      maxLength={80}
                      onChange={(event) =>
                        setEditDraft((current) => ({ ...current, name: event.target.value }))
                      }
                      required
                      type="text"
                      value={editDraft.name}
                    />
                  </label>
                  <label>
                    金額
                    <input
                      inputMode="numeric"
                      min="0"
                      onChange={(event) =>
                        setEditDraft((current) => ({ ...current, amount: event.target.value }))
                      }
                      required
                      step="1"
                      type="number"
                      value={editDraft.amount}
                    />
                  </label>
                  <div className="fixed-cost-edit-actions">
                    <button className="primary-button" disabled={saving} type="submit">
                      保存する
                    </button>
                    <button
                      className="secondary-button"
                      disabled={saving}
                      onClick={() => setEditingId(null)}
                      type="button"
                    >
                      取り消す
                    </button>
                  </div>
                </form>
              ) : (
                <div
                  className={`fixed-cost-row${isIncome ? " income-row" : hasDay ? "" : " debt-row"}`}
                >
                  {hasDay ? <p>{item.paymentDay}日</p> : null}
                  {isIncome ? (
                    <p>{item.accrualMethod === "daily" ? "日割り" : "一括"}</p>
                  ) : null}
                  <h3>{item.name}</h3>
                  <strong>{item.amount.toLocaleString("ja-JP")}円</strong>
                  <button
                    className="edit-button"
                    disabled={saving || editingId !== null}
                    onClick={() => startEditing(item)}
                    type="button"
                  >
                    編集
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="fixed-cost-total">
        <span>{settings.totalLabel}</span>
        <strong>{totalAmount.toLocaleString("ja-JP")}円</strong>
      </div>
    </section>
  );
}
