"use client";

import { FormEvent, useEffect, useState } from "react";

type FixedCost = {
  id: number;
  name: string;
  amount: number;
  paymentDay: number;
  createdAt: string;
  updatedAt: string;
};

type Draft = {
  name: string;
  amount: string;
  paymentDay: string;
};

type ManagerKind = "fixed-costs" | "incomes";

type FixedCostManagerProps = {
  kind?: ManagerKind;
};

const managerSettings = {
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
} as const;

const emptyDraft: Draft = { name: "", amount: "", paymentDay: "" };

function sorted(items: FixedCost[]) {
  return [...items].sort((a, b) => a.paymentDay - b.paymentDay || a.id - b.id);
}

function values(draft: Draft) {
  const name = draft.name.trim();
  const amount = Number(draft.amount);
  const paymentDay = Number(draft.paymentDay);

  if (
    !name ||
    name.length > 80 ||
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    !Number.isInteger(paymentDay) ||
    paymentDay < 1 ||
    paymentDay > 31
  ) {
    return null;
  }

  return { name, amount, paymentDay };
}

export default function FixedCostManager({ kind = "fixed-costs" }: FixedCostManagerProps) {
  const settings = managerSettings[kind];
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
          setFixedCosts(sorted(items));
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
  }, [settings]);

  async function addFixedCost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = values(newDraft);
    if (!body) {
      setMessage(
        `${settings.nameInputLabel}、0円以上の金額、1～31日の${settings.dayLabel}を入力してください。`,
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
      setFixedCosts((current) => sorted([...current, saved]));
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
      paymentDay: String(item.paymentDay),
    });
    setMessage("");
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingId === null) {
      return;
    }

    const body = values(editDraft);
    if (!body) {
      setMessage(
        `${settings.nameInputLabel}、0円以上の金額、1～31日の${settings.dayLabel}を入力してください。`,
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
        sorted(current.map((item) => (item.id === saved.id ? saved : item))),
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
        className="fixed-cost-form"
        onSubmit={addFixedCost}
      >
        <input
          aria-label={settings.dayLabel}
          inputMode="numeric"
          max="31"
          min="1"
          onChange={(event) =>
            setNewDraft((current) => ({
              ...current,
              paymentDay: event.target.value,
            }))
          }
          placeholder={settings.dayLabel}
          required
          step="1"
          type="number"
          value={newDraft.paymentDay}
        />
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

      <div className="fixed-cost-column-headings">
        <span>{settings.dayLabel}</span>
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
                <form className="fixed-cost-edit-form" onSubmit={saveEdit}>
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
                <div className="fixed-cost-row">
                  <p>{item.paymentDay}日</p>
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
