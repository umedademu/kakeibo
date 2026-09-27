import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, test } from "node:test";
import worker from "../cloudflare/worker.js";

let database;
let env;
const validCost = { name: "確認用の固定費", amount: 30000, paymentDay: 31, accrualMethod: "lump_sum" };

beforeEach(() => {
  database = new DatabaseSync(":memory:");
  const migrations = new URL("../cloudflare/migrations/", import.meta.url);
  for (const name of readdirSync(migrations).filter((name) => name.endsWith(".sql")).sort()) {
    if (name === "0009_fixed_cost_accrual_method.sql") {
      database.exec("INSERT INTO fixed_costs (name, amount, payment_day, created_at, updated_at) VALUES ('登録済みの固定費', 31000, 20, '2026-09-01', '2026-09-01')");
    }
    database.exec(readFileSync(new URL(name, migrations), "utf8"));
  }
  env = {
    KAKEIBO_API_SECRET: "test-only",
    DB: {
      prepare(sql) {
        const statement = database.prepare(sql);
        let parameters = [];
        return {
          bind(...values) { parameters = values; return this; },
          async all() { return { results: statement.all(...parameters) }; },
          async first() { return statement.get(...parameters) ?? null; },
          async run() {
            const result = statement.run(...parameters);
            return { meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
          },
        };
      },
    },
  };
});

afterEach(() => database.close());

function request(path, method = "GET", body) {
  return worker.fetch(new Request(`https://test.invalid${path}`, {
    method,
    headers: { Authorization: "Bearer test-only", "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), env);
}

test("保存先の更新は既存の金額・支払日・更新日時を維持し、日割りを付ける", async () => {
  const [saved] = await (await request("/fixed-costs")).json();
  assert.equal(saved.amount, 31000);
  assert.equal(saved.paymentDay, 20);
  assert.equal(saved.updatedAt, "2026-09-01");
  assert.equal(saved.accrualMethod, "daily");
});

test("一括・日割りを登録、再取得、編集できる", async () => {
  for (const method of ["lump_sum", "daily"]) {
    const response = await request("/fixed-costs", "POST", { ...validCost, accrualMethod: method });
    assert.equal(response.status, 201);
    const created = await response.json();
    assert.equal(created.accrualMethod, method);
    const otherMethod = method === "daily" ? "lump_sum" : "daily";
    const updated = await request(`/fixed-costs/${created.id}`, "PUT", { ...validCost, accrualMethod: otherMethod });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).accrualMethod, otherMethod);
    const saved = (await (await request("/fixed-costs")).json()).find((item) => item.id === created.id);
    assert.equal(saved.accrualMethod, otherMethod);
  }
});

test("更新前の画面からの追加は日割り、編集は選択済みの反映方法を維持する", async () => {
  const legacy = { name: "以前の画面", amount: 1000, paymentDay: 15 };
  const created = await (await request("/fixed-costs", "POST", legacy)).json();
  assert.equal(created.accrualMethod, "daily");
  await request(`/fixed-costs/${created.id}`, "PUT", { ...legacy, accrualMethod: "lump_sum" });
  const updated = await (await request(`/fixed-costs/${created.id}`, "PUT", { ...legacy, amount: 2000 })).json();
  assert.equal(updated.accrualMethod, "lump_sum");
  assert.equal(updated.amount, 2000);
});

test("不正な反映方法・金額・日付は保存せず、既存の内容を維持する", async () => {
  for (const invalid of [{ accrualMethod: "invalid" }, { accrualMethod: null }, { accrualMethod: 0 }, { amount: -1 }, { amount: 1.5 }, { paymentDay: 32 }, { paymentDay: 0 }]) {
    assert.equal((await request("/fixed-costs", "POST", { ...validCost, ...invalid })).status, 400);
    assert.equal((await request("/fixed-costs/1", "PUT", { ...validCost, ...invalid })).status, 400);
  }
  const saved = await (await request("/fixed-costs")).json();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].amount, 31000);
  assert.equal(saved[0].accrualMethod, "daily");
  assert.equal((await request("/fixed-costs/999", "PUT", validCost)).status, 404);
});

test("収入の反映方法と借金の登録を維持する", async () => {
  assert.equal((await request("/incomes", "POST", validCost)).status, 201);
  assert.equal((await request("/incomes", "POST", { name: "収入", amount: 1000, paymentDay: 15 })).status, 400);
  const debt = await request("/debts", "POST", { name: "確認用の借金", amount: 1000 });
  assert.equal(debt.status, 201);
});

test("認証なしでは固定費を読み書きできない", async () => {
  for (const method of ["GET", "POST", "PUT"]) {
    const url = `https://test.invalid/fixed-costs${method === "PUT" ? "/1" : ""}`;
    const response = await worker.fetch(new Request(url, {
      method,
      body: method === "GET" ? undefined : JSON.stringify(validCost),
    }), env);
    assert.equal(response.status, 401);
  }
});
