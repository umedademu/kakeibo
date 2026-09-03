const accountNames = {
  wallet: "財布",
  paypay: "PayPay",
  paypay_bank: "PayPay銀行",
  pachinko: "貯玉",
  fx: "FX口座",
};

const manuallyEditableAccountIds = new Set(["wallet", "paypay", "paypay_bank"]);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function authorized(request, env) {
  const authorization = request.headers.get("Authorization");
  return Boolean(env.KAKEIBO_API_SECRET) && authorization === `Bearer ${env.KAKEIBO_API_SECRET}`;
}

async function getBalance(env, accountId) {
  const row = await env.DB.prepare(
    "SELECT amount, updated_at AS updatedAt FROM current_balances WHERE account_id = ?",
  )
    .bind(accountId)
    .first();

  return {
    amount: row?.amount ?? 0,
    updatedAt: row?.updatedAt ?? null,
  };
}

async function updateBalance(request, env, accountId) {
  const body = await request.json().catch(() => null);
  const amount = body?.amount;

  if (!Number.isSafeInteger(amount) || amount < 0) {
    return json({ error: "残高が正しくありません。" }, 400);
  }

  const updatedAt = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE current_balances SET amount = ?, updated_at = ? WHERE account_id = ?",
    ).bind(amount, updatedAt, accountId),
    env.DB.prepare(
      "INSERT INTO balance_events (account_id, amount, recorded_at) VALUES (?, ?, ?)",
    ).bind(accountId, amount, updatedAt),
  ]);

  return json({ amount, updatedAt });
}

async function syncSavedBallBalance(env, recordedAt) {
  if (!env.SHUSHI_SERVICE || !env.SHUSHI_READ_SECRET) {
    throw new Error("貯玉の接続設定がありません。");
  }

  const response = await env.SHUSHI_SERVICE.fetch("https://shushi/saved-total", {
    headers: { Authorization: `Bearer ${env.SHUSHI_READ_SECRET}` },
  });

  if (!response.ok) {
    throw new Error(`貯玉の取得に失敗しました: ${response.status}`);
  }

  const data = await response.json();
  const amount = data?.amount;
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error("取得した貯玉残高が正しくありません。");
  }

  const current = await env.DB.prepare(
    "SELECT amount FROM current_balances WHERE account_id = ?",
  )
    .bind("pachinko")
    .first();
  const statements = [
    env.DB.prepare(
      "UPDATE current_balances SET amount = ?, updated_at = ? WHERE account_id = ?",
    ).bind(amount, recordedAt, "pachinko"),
  ];

  if (current?.amount !== amount) {
    statements.push(
      env.DB.prepare(
        "INSERT INTO balance_events (account_id, amount, recorded_at) VALUES (?, ?, ?)",
      ).bind("pachinko", amount, recordedAt),
    );
  }

  await env.DB.batch(statements);
  return { amount, sourceUpdatedAt: data.sourceUpdatedAt ?? null, updatedAt: recordedAt };
}

async function syncFxEquity(request, env) {
  const body = await request.json().catch(() => null);
  const equityUsd = body?.equityUsd;
  const usdJpyRate = body?.usdJpyRate;
  const rateSymbol = body?.rateSymbol;
  const sourceRecordedAt = body?.sourceRecordedAt;
  const rateRecordedAt = body?.rateRecordedAt;

  if (
    !Number.isFinite(equityUsd) ||
    equityUsd < 0 ||
    !Number.isFinite(usdJpyRate) ||
    usdJpyRate <= 0 ||
    typeof rateSymbol !== "string" ||
    rateSymbol.length < 1 ||
    rateSymbol.length > 40 ||
    typeof sourceRecordedAt !== "string" ||
    Number.isNaN(Date.parse(sourceRecordedAt)) ||
    typeof rateRecordedAt !== "string" ||
    Number.isNaN(Date.parse(rateRecordedAt))
  ) {
    return json({ error: "FX口座の情報が正しくありません。" }, 400);
  }

  const amount = Math.round(equityUsd * usdJpyRate);
  if (!Number.isSafeInteger(amount) || amount < 0) {
    return json({ error: "円換算後の残高が正しくありません。" }, 400);
  }

  const receivedAt = new Date().toISOString();
  const current = await env.DB.prepare(
    "SELECT amount FROM current_balances WHERE account_id = ?",
  )
    .bind("fx")
    .first();
  const statements = [
    env.DB.prepare(
      "UPDATE current_balances SET amount = ?, updated_at = ? WHERE account_id = ?",
    ).bind(amount, receivedAt, "fx"),
    env.DB.prepare(
      `INSERT INTO fx_equity_sync_records
       (equity_usd, usd_jpy_rate, equity_jpy, rate_symbol, source_recorded_at, rate_recorded_at, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      equityUsd,
      usdJpyRate,
      amount,
      rateSymbol,
      sourceRecordedAt,
      rateRecordedAt,
      receivedAt,
    ),
  ];

  if (current?.amount !== amount) {
    statements.push(
      env.DB.prepare(
        "INSERT INTO balance_events (account_id, amount, recorded_at) VALUES (?, ?, ?)",
      ).bind("fx", amount, receivedAt),
    );
  }

  await env.DB.batch(statements);
  return json({ amount, updatedAt: receivedAt });
}

function readFixedCost(body) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const amount = body?.amount;
  const paymentDay = body?.paymentDay;

  if (
    name.length < 1 ||
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

async function listFixedCosts(env) {
  const result = await env.DB.prepare(
    `SELECT id, name, amount, payment_day AS paymentDay,
            created_at AS createdAt, updated_at AS updatedAt
     FROM fixed_costs
     ORDER BY payment_day, id`,
  ).all();

  return result.results;
}

async function createFixedCost(request, env) {
  const fixedCost = readFixedCost(await request.json().catch(() => null));
  if (!fixedCost) {
    return json({ error: "固定費の内容が正しくありません。" }, 400);
  }

  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `INSERT INTO fixed_costs (name, amount, payment_day, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(fixedCost.name, fixedCost.amount, fixedCost.paymentDay, now, now)
    .run();

  return json(
    {
      id: result.meta.last_row_id,
      ...fixedCost,
      createdAt: now,
      updatedAt: now,
    },
    201,
  );
}

async function updateFixedCost(request, env, id) {
  const fixedCost = readFixedCost(await request.json().catch(() => null));
  if (!fixedCost) {
    return json({ error: "固定費の内容が正しくありません。" }, 400);
  }

  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `UPDATE fixed_costs
     SET name = ?, amount = ?, payment_day = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(fixedCost.name, fixedCost.amount, fixedCost.paymentDay, now, id)
    .run();

  if (result.meta.changes !== 1) {
    return json({ error: "固定費が見つかりません。" }, 404);
  }

  const saved = await env.DB.prepare(
    `SELECT id, name, amount, payment_day AS paymentDay,
            created_at AS createdAt, updated_at AS updatedAt
     FROM fixed_costs
     WHERE id = ?`,
  )
    .bind(id)
    .first();

  return json(saved);
}

async function listIncomes(env) {
  const result = await env.DB.prepare(
    `SELECT id, name, amount, payment_day AS paymentDay,
            created_at AS createdAt, updated_at AS updatedAt
     FROM incomes
     ORDER BY payment_day, id`,
  ).all();

  return result.results;
}

async function createIncome(request, env) {
  const income = readFixedCost(await request.json().catch(() => null));
  if (!income) {
    return json({ error: "収入の内容が正しくありません。" }, 400);
  }

  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `INSERT INTO incomes (name, amount, payment_day, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(income.name, income.amount, income.paymentDay, now, now)
    .run();

  return json(
    {
      id: result.meta.last_row_id,
      ...income,
      createdAt: now,
      updatedAt: now,
    },
    201,
  );
}

async function updateIncome(request, env, id) {
  const income = readFixedCost(await request.json().catch(() => null));
  if (!income) {
    return json({ error: "収入の内容が正しくありません。" }, 400);
  }

  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `UPDATE incomes
     SET name = ?, amount = ?, payment_day = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(income.name, income.amount, income.paymentDay, now, id)
    .run();

  if (result.meta.changes !== 1) {
    return json({ error: "収入が見つかりません。" }, 404);
  }

  const saved = await env.DB.prepare(
    `SELECT id, name, amount, payment_day AS paymentDay,
            created_at AS createdAt, updated_at AS updatedAt
     FROM incomes
     WHERE id = ?`,
  )
    .bind(id)
    .first();

  return json(saved);
}

function previousDateInJapan(scheduledTime) {
  const japanTime = new Date(scheduledTime + 9 * 60 * 60 * 1000);
  japanTime.setUTCDate(japanTime.getUTCDate() - 1);
  return japanTime.toISOString().slice(0, 10);
}

async function saveDailySnapshot(env, scheduledTime) {
  const balanceDate = previousDateInJapan(scheduledTime);
  const recordedAt = new Date(scheduledTime).toISOString();

  await env.DB.prepare(
    `INSERT INTO daily_balance_snapshots (balance_date, account_id, amount, recorded_at)
     SELECT ?, account_id, amount, ? FROM current_balances WHERE 1 = 1
     ON CONFLICT(balance_date, account_id) DO UPDATE SET
       amount = excluded.amount,
       recorded_at = excluded.recorded_at`,
  )
    .bind(balanceDate, recordedAt)
    .run();
}

function dateInJapanDaysAgo(daysAgo) {
  const japanTime = new Date(Date.now() + 9 * 60 * 60 * 1000);
  japanTime.setUTCDate(japanTime.getUTCDate() - daysAgo);
  return japanTime.toISOString().slice(0, 10);
}

async function listAssetHistory(env, days) {
  const firstDate = dateInJapanDaysAgo(days - 1);
  const result = await env.DB.prepare(
    `SELECT balance_date AS date, SUM(amount) AS total
     FROM daily_balance_snapshots
     WHERE balance_date >= ?
       AND account_id IN ('wallet', 'paypay', 'paypay_bank', 'pachinko', 'fx')
     GROUP BY balance_date
     ORDER BY balance_date`,
  )
    .bind(firstDate)
    .all();

  return result.results;
}

const worker = {
  async fetch(request, env) {
    if (!authorized(request, env)) {
      return json({ error: "認証できません。" }, 401);
    }

    const url = new URL(request.url);
    const balancePath = url.pathname.match(/^\/balances\/([^/]+)$/);
    const accountId = balancePath?.[1];

    if (accountId && manuallyEditableAccountIds.has(accountId) && request.method === "GET") {
      return json(await getBalance(env, accountId));
    }

    if (accountId && manuallyEditableAccountIds.has(accountId) && request.method === "PUT") {
      return updateBalance(request, env, accountId);
    }

    if (url.pathname === "/sync/pachinko" && request.method === "POST") {
      try {
        return json(await syncSavedBallBalance(env, new Date().toISOString()));
      } catch (error) {
        console.error(error);
        return json({ error: "貯玉残高を更新できませんでした。" }, 502);
      }
    }

    if (url.pathname === "/sync/fx" && request.method === "POST") {
      return syncFxEquity(request, env);
    }

    if (url.pathname === "/fixed-costs" && request.method === "GET") {
      return json(await listFixedCosts(env));
    }

    if (url.pathname === "/fixed-costs" && request.method === "POST") {
      return createFixedCost(request, env);
    }

    const fixedCostPath = url.pathname.match(/^\/fixed-costs\/(\d+)$/);
    if (fixedCostPath && request.method === "PUT") {
      const id = Number(fixedCostPath[1]);
      if (!Number.isSafeInteger(id) || id < 1) {
        return json({ error: "固定費が見つかりません。" }, 404);
      }
      return updateFixedCost(request, env, id);
    }

    if (url.pathname === "/incomes" && request.method === "GET") {
      return json(await listIncomes(env));
    }

    if (url.pathname === "/incomes" && request.method === "POST") {
      return createIncome(request, env);
    }

    const incomePath = url.pathname.match(/^\/incomes\/(\d+)$/);
    if (incomePath && request.method === "PUT") {
      const id = Number(incomePath[1]);
      if (!Number.isSafeInteger(id) || id < 1) {
        return json({ error: "収入が見つかりません。" }, 404);
      }
      return updateIncome(request, env, id);
    }

    if (url.pathname === "/asset-history" && request.method === "GET") {
      const requestedDays = Number(url.searchParams.get("days"));
      const days =
        Number.isInteger(requestedDays) && requestedDays >= 1 && requestedDays <= 90
          ? requestedDays
          : 30;
      return json(await listAssetHistory(env, days));
    }

    if (url.pathname === "/balances" && request.method === "GET") {
      const result = await env.DB.prepare(
        "SELECT account_id AS accountId, amount, updated_at AS updatedAt FROM current_balances ORDER BY sort_order",
      ).all();
      return json(
        result.results.map((row) => ({
          ...row,
          name: accountNames[row.accountId],
        })),
      );
    }

    return json({ error: "対象が見つかりません。" }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        try {
          await syncSavedBallBalance(env, new Date(event.scheduledTime).toISOString());
        } catch (error) {
          console.error(error);
        }

        await saveDailySnapshot(env, event.scheduledTime);
      })(),
    );
  },
};

export default worker;
