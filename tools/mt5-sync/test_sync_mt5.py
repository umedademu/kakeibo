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


class SyncAccountTests(unittest.TestCase):
    def run_sync(self, account, *, dry_run=False):
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
            }),
            patch.object(Path, "is_file", return_value=True),
            patch.object(sync_mt5.mt5, "initialize", return_value=True),
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
        shutdown.assert_called_once()
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
                    "https://test.invalid", "test-only", float(equity), 150.0,
                    "USDJPY", datetime.fromtimestamp(1_792_000_000, tz=timezone.utc),
                )

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


if __name__ == "__main__":
    unittest.main()
