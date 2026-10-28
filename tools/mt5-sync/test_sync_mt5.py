from __future__ import annotations

from contextlib import redirect_stdout, redirect_stderr
from datetime import datetime, timezone
import io
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import sync_mt5


TEST_ADDRESS = "0x" + "ab" * 20
REAL_ACCOUNT = SimpleNamespace(
    trade_mode=sync_mt5.mt5.ACCOUNT_TRADE_MODE_REAL, currency="USD", equity=2500,
)


class SyncAccountTests(unittest.TestCase):
    def run_sync(self, account, *, dry_run=False, environment=None, hyperliquid=None):
        args = SimpleNamespace(
            terminal="terminal64.exe", env_file=".env.local", log_file="test.log",
            dry_run=dry_run,
        )
        output = io.StringIO()
        errors = io.StringIO()
        with (
            patch.object(sync_mt5, "parse_args", return_value=args),
            patch.object(sync_mt5, "configure_logging"),
            patch.object(sync_mt5, "load_environment", return_value={
                "CLOUDFLARE_WORKER_URL": "https://test.invalid",
                "CLOUDFLARE_SHARED_SECRET": "test-only",
                **(environment or {}),
            }),
            # 作り物の答えがない時は、本物の問い合わせの関数を通す（その先の通信は各試験で差し替える）。
            patch.object(
                sync_mt5, "post_hyperliquid_info",
                side_effect=hyperliquid or sync_mt5.post_hyperliquid_info,
            ) as hyperliquid_info,
            patch.object(Path, "is_file", return_value=True),
            patch.object(sync_mt5.mt5, "initialize", return_value=True) as initialize,
            patch.object(sync_mt5.mt5, "account_info", return_value=account),
            patch.object(sync_mt5.mt5, "last_error", return_value=(0, "")),
            patch.object(sync_mt5.mt5, "shutdown") as shutdown,
            patch.object(sync_mt5, "find_usd_jpy_symbol", return_value="USDJPY") as symbol,
            patch.object(sync_mt5.mt5, "symbol_select", return_value=True),
            patch.object(sync_mt5.mt5, "symbol_info_tick", return_value=SimpleNamespace(
                bid=149, ask=151, time_msc=1_792_000_000_000,
            )),
            patch.object(sync_mt5, "send_equity") as send,
            redirect_stdout(output),
            redirect_stderr(errors),
        ):
            result = sync_mt5.main()
        self.assertEqual(shutdown.call_count, initialize.call_count)
        self.hyperliquid_info = hyperliquid_info
        return result, json.loads(output.getvalue() or errors.getvalue()), symbol, send

    def test_non_real_accounts_never_read_or_send_balance(self):
        for mode in (
            sync_mt5.mt5.ACCOUNT_TRADE_MODE_DEMO,
            sync_mt5.mt5.ACCOUNT_TRADE_MODE_CONTEST,
            None,
            999,
        ):
            with self.subTest(mode=mode):
                # 残高や通貨がなくても、口座の種類だけで送信を見送る。
                result, body, symbol, send = self.run_sync(SimpleNamespace(trade_mode=mode))
                self.assertEqual(result, 0)
                self.assertTrue(body["skipped"])
                self.assertFalse(body["sent"])
                symbol.assert_not_called()
                send.assert_not_called()

    def test_missing_account_type_is_skipped(self):
        result, body, symbol, send = self.run_sync(SimpleNamespace())
        self.assertEqual(result, 0)
        self.assertTrue(body["skipped"])
        symbol.assert_not_called()
        send.assert_not_called()

    def test_real_account_can_send_positive_or_zero_equity(self):
        for equity in (2500, 0):
            with self.subTest(equity=equity):
                account = SimpleNamespace(
                    trade_mode=sync_mt5.mt5.ACCOUNT_TRADE_MODE_REAL,
                    currency="USD", equity=equity,
                )
                result, body, symbol, send = self.run_sync(account)
                self.assertEqual(result, 0)
                self.assertTrue(body["sent"])
                symbol.assert_called_once()
                send.assert_called_once_with(
                    "https://test.invalid", "test-only", float(equity), None, 150.0,
                    "USDJPY", datetime.fromtimestamp(1_792_000_000, tz=timezone.utc),
                )
                self.hyperliquid_info.assert_not_called()

    def test_real_account_dry_run_never_sends(self):
        account = SimpleNamespace(
            trade_mode=sync_mt5.mt5.ACCOUNT_TRADE_MODE_REAL, currency="USD", equity=2500,
        )
        result, body, symbol, send = self.run_sync(account, dry_run=True)
        self.assertEqual(result, 0)
        self.assertFalse(body["sent"])
        symbol.assert_called_once()
        send.assert_not_called()

    def test_unavailable_account_does_not_send(self):
        result, body, symbol, send = self.run_sync(None)
        self.assertEqual(result, 1)
        self.assertFalse(body["ok"])
        symbol.assert_not_called()
        send.assert_not_called()


def fake_hyperliquid(kind, spot_balances, perp_value="0.0"):
    """ハイリキの問い合わせの答えを作り物で返す。"""
    answers = {
        "userAbstraction": kind,
        "spotClearinghouseState": {"balances": spot_balances},
        "clearinghouseState": {"marginSummary": {"accountValue": perp_value}},
    }

    def answer(body):
        assert body["user"] == TEST_ADDRESS
        return answers[body["type"]]

    return answer


class SyncHyperliquidTests(unittest.TestCase):
    run_sync = SyncAccountTests.run_sync

    def sync_with(self, hyperliquid, account=REAL_ACCOUNT, **options):
        return self.run_sync(
            account, environment={"HYPERLIQUID_ACCOUNT_ADDRESS": TEST_ADDRESS},
            hyperliquid=hyperliquid, **options,
        )

    def sent_hyperliquid_equity(self, send):
        send.assert_called_once()
        self.assertEqual(send.call_args.args[2], 2500.0)
        return send.call_args.args[3]

    def asked_types(self):
        return [call.args[0]["type"] for call in self.hyperliquid_info.call_args_list]

    def test_unified_account_uses_only_spot_usdc(self):
        for kind in ("unifiedAccount", "portfolioMargin"):
            with self.subTest(kind=kind):
                # 先物の側の額は現物のUSDCに含まれるので、問い合わせも足し算もしない。
                result, body, _, send = self.sync_with(fake_hyperliquid(kind, [
                    {"coin": "USDC", "total": "60.92", "hold": "3.1"},
                    {"coin": "HYPE", "total": "0.0", "hold": "0.0"},
                ], perp_value="999"))
                self.assertEqual(result, 0)
                self.assertTrue(body["sent"])
                self.assertTrue(body["hyperliquid"])
                self.assertAlmostEqual(self.sent_hyperliquid_equity(send), 60.92)
                self.assertEqual(self.asked_types(), ["userAbstraction", "spotClearinghouseState"])

    def test_separate_account_adds_perp_account_value(self):
        for kind in ("default", "disabled"):
            with self.subTest(kind=kind):
                result, _, _, send = self.sync_with(fake_hyperliquid(
                    kind, [{"coin": "USDC", "total": "10.5"}], perp_value="50.25",
                ))
                self.assertEqual(result, 0)
                self.assertAlmostEqual(self.sent_hyperliquid_equity(send), 60.75)
                self.assertEqual(self.asked_types(), [
                    "userAbstraction", "spotClearinghouseState", "clearinghouseState",
                ])

    def test_empty_account_sends_zero(self):
        result, _, _, send = self.sync_with(fake_hyperliquid("unifiedAccount", []))
        self.assertEqual(result, 0)
        self.assertEqual(self.sent_hyperliquid_equity(send), 0.0)

    def test_unknown_account_kind_never_sends(self):
        for kind in ("dexAbstraction", None, {"error": "x"}):
            with self.subTest(kind=kind):
                result, body, _, send = self.sync_with(fake_hyperliquid(kind, []))
                self.assertEqual(result, 1)
                self.assertFalse(body["ok"])
                send.assert_not_called()
                self.assertEqual(self.asked_types(), ["userAbstraction"])

    def test_broken_answers_never_send(self):
        for spot in ([{"coin": "USDC", "total": "abc"}], [{"coin": "USDC"}], ["USDC"]):
            with self.subTest(spot=spot):
                result, _, _, send = self.sync_with(fake_hyperliquid("unifiedAccount", spot))
                self.assertEqual(result, 1)
                send.assert_not_called()

    def test_rate_limit_skips_without_retry(self):
        error = sync_mt5.HTTPError(sync_mt5.HYPERLIQUID_INFO_URL, 429, "Too Many", {}, None)
        with patch.object(sync_mt5, "urlopen", side_effect=error) as opened:
            result, body, _, send = self.sync_with(None)
        self.assertEqual(result, 0)
        self.assertTrue(body["skipped"])
        send.assert_not_called()
        opened.assert_called_once()

    def test_connection_failure_never_sends(self):
        with patch.object(sync_mt5, "urlopen", side_effect=sync_mt5.URLError("down")):
            result, body, _, send = self.sync_with(None)
        self.assertEqual(result, 1)
        self.assertNotIn(TEST_ADDRESS, body["error"])
        send.assert_not_called()

    def test_demo_mt5_account_never_asks_hyperliquid(self):
        result, body, _, send = self.sync_with(
            fake_hyperliquid("unifiedAccount", []),
            account=SimpleNamespace(trade_mode=sync_mt5.mt5.ACCOUNT_TRADE_MODE_DEMO),
        )
        self.assertEqual(result, 0)
        self.assertTrue(body["skipped"])
        send.assert_not_called()
        self.hyperliquid_info.assert_not_called()

    def test_invalid_address_never_reads_or_sends(self):
        result, body, symbol, send = self.run_sync(
            REAL_ACCOUNT, environment={"HYPERLIQUID_ACCOUNT_ADDRESS": "0x1234"},
            hyperliquid=fake_hyperliquid("unifiedAccount", []),
        )
        self.assertEqual(result, 1)
        self.assertFalse(body["ok"])
        symbol.assert_not_called()
        send.assert_not_called()
        self.hyperliquid_info.assert_not_called()

    def test_dry_run_reads_hyperliquid_but_never_sends(self):
        result, body, _, send = self.sync_with(
            fake_hyperliquid("unifiedAccount", [{"coin": "USDC", "total": "1"}]), dry_run=True,
        )
        self.assertEqual(result, 0)
        self.assertFalse(body["sent"])
        self.assertTrue(body["hyperliquid"])
        send.assert_not_called()


class SendEquityTests(unittest.TestCase):
    def test_body_keeps_exness_and_hyperliquid_separate(self):
        with patch.object(sync_mt5, "urlopen") as urlopen:
            urlopen.return_value.__enter__.return_value = SimpleNamespace(status=200)
            sync_mt5.send_equity(
                "https://test.invalid/", "test-only", 2500.0, 60.92, 150.0, "USDJPYm",
                datetime(2026, 10, 28, tzinfo=timezone.utc),
            )
        request = urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "https://test.invalid/sync/fx")
        body = json.loads(request.data)
        self.assertEqual(body["equityUsd"], 2500.0)
        self.assertEqual(body["hyperliquidEquityUsd"], 60.92)
        self.assertEqual(body["usdJpyRate"], 150.0)


if __name__ == "__main__":
    unittest.main()
