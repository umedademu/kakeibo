const accountNames = {
  wallet: "財布",
  paypay: "PayPay",
  paypay_bank: "PayPay銀行",
  pachinko: "貯玉",
  fx: "FX口座",
};

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

async function getWallet(env) {
  const row = await env.DB.prepare(
    "SELECT amount, updated_at AS updatedAt FROM current_balances WHERE account_id = ?",
  )
    .bind("wallet")
    .first();

  return {
    amount: row?.amount ?? 0,
    updatedAt: row?.updatedAt ?? null,
  };
}

async function updateWallet(request, env) {
  const body = await request.json().catch(() => null);
  const amount = body?.amount;

  if (!Number.isSafeInteger(amount) || amount < 0) {
    return json({ error: "残高が正しくありません。" }, 400);
  }

  const updatedAt = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE current_balances SET amount = ?, updated_at = ? WHERE account_id = ?",
    ).bind(amount, updatedAt, "wallet"),
    env.DB.prepare(
      "INSERT INTO balance_events (account_id, amount, recorded_at) VALUES (?, ?, ?)",
    ).bind("wallet", amount, updatedAt),
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

const worker = {
  async fetch(request, env) {
    if (!authorized(request, env)) {
      return json({ error: "認証できません。" }, 401);
    }

    const url = new URL(request.url);

    if (url.pathname === "/balances/wallet" && request.method === "GET") {
      return json(await getWallet(env));
    }

    if (url.pathname === "/balances/wallet" && request.method === "PUT") {
      return updateWallet(request, env);
    }

    if (url.pathname === "/sync/pachinko" && request.method === "POST") {
      try {
        return json(await syncSavedBallBalance(env, new Date().toISOString()));
      } catch (error) {
        console.error(error);
        return json({ error: "貯玉残高を更新できませんでした。" }, 502);
      }
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
