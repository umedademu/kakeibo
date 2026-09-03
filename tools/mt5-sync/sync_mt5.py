from __future__ import annotations

import argparse
import json
import logging
from logging.handlers import RotatingFileHandler
import math
import os
from pathlib import Path
import sys
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import MetaTrader5 as mt5


def parse_args() -> argparse.Namespace:
    local_app_data = Path(os.environ.get("LOCALAPPDATA", Path.home()))
    default_log = local_app_data / "kakeibo" / "mt5-sync.log"
    parser = argparse.ArgumentParser(
        description="MT5の有効証拠金を円換算してkakeiboへ送信します。"
    )
    parser.add_argument("--terminal", required=True, help="terminal64.exeの場所")
    parser.add_argument("--env-file", required=True, help="kakeiboの.env.localの場所")
    parser.add_argument("--log-file", default=str(default_log), help="動作記録の保存先")
    parser.add_argument("--dry-run", action="store_true", help="送信せず取得確認だけを行う")
    return parser.parse_args()


def configure_logging(log_file: Path) -> None:
    log_file.parent.mkdir(parents=True, exist_ok=True)
    handler = RotatingFileHandler(
        log_file,
        maxBytes=512 * 1024,
        backupCount=2,
        encoding="utf-8",
    )
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logging.basicConfig(level=logging.INFO, handlers=[handler])


def load_environment(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        values[key.strip()] = value
    return values


def find_usd_jpy_symbol() -> str:
    symbols = mt5.symbols_get()
    if symbols is None:
        raise RuntimeError(f"ドル円の銘柄一覧を取得できません: {mt5.last_error()}")

    candidates = [
        symbol
        for symbol in symbols
        if symbol.currency_base == "USD" and symbol.currency_profit == "JPY"
    ]
    if not candidates:
        raise RuntimeError("ドル円の銘柄が見つかりません。")

    candidates.sort(
        key=lambda symbol: (
            symbol.name != "USDJPY",
            not symbol.visible,
            len(symbol.name),
            symbol.name,
        )
    )
    return candidates[0].name


def read_mt5_values(terminal_path: Path) -> tuple[float, float, str, datetime]:
    if not terminal_path.is_file():
        raise RuntimeError("指定されたMT5本体が見つかりません。")
    if not mt5.initialize(path=str(terminal_path)):
        raise RuntimeError(f"MT5へ接続できません: {mt5.last_error()}")

    try:
        account = mt5.account_info()
        if account is None:
            raise RuntimeError(f"ログイン中の口座情報を取得できません: {mt5.last_error()}")
        if account.currency != "USD":
            raise RuntimeError(f"口座通貨がUSDではありません: {account.currency}")

        equity_usd = float(account.equity)
        if not math.isfinite(equity_usd) or equity_usd < 0:
            raise RuntimeError("取得した有効証拠金が正しくありません。")

        rate_symbol = find_usd_jpy_symbol()
        if not mt5.symbol_select(rate_symbol, True):
            raise RuntimeError(f"{rate_symbol}を選択できません: {mt5.last_error()}")

        tick = mt5.symbol_info_tick(rate_symbol)
        if tick is None or tick.bid <= 0 or tick.ask <= 0:
            raise RuntimeError(f"{rate_symbol}の価格を取得できません: {mt5.last_error()}")

        usd_jpy_rate = (float(tick.bid) + float(tick.ask)) / 2
        rate_time = datetime.fromtimestamp(tick.time_msc / 1000, tz=timezone.utc)
        return equity_usd, usd_jpy_rate, rate_symbol, rate_time
    finally:
        mt5.shutdown()


def send_equity(
    worker_url: str,
    secret: str,
    equity_usd: float,
    usd_jpy_rate: float,
    rate_symbol: str,
    rate_time: datetime,
) -> None:
    recorded_at = datetime.now(timezone.utc)
    body = json.dumps(
        {
            "equityUsd": equity_usd,
            "usdJpyRate": usd_jpy_rate,
            "rateSymbol": rate_symbol,
            "sourceRecordedAt": recorded_at.isoformat(),
            "rateRecordedAt": rate_time.isoformat(),
        }
    ).encode("utf-8")
    request = Request(
        f"{worker_url.rstrip('/')}/sync/fx",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {secret}",
            "Content-Type": "application/json",
            "User-Agent": "kakeibo-mt5-sync/1.0",
        },
    )

    try:
        with urlopen(request, timeout=30) as response:
            if response.status != 200:
                raise RuntimeError(f"送信先からエラーが返されました: {response.status}")
    except HTTPError as error:
        raise RuntimeError(f"送信先からエラーが返されました: {error.code}") from error
    except URLError as error:
        raise RuntimeError("Cloudflareへ接続できません。") from error


def main() -> int:
    args = parse_args()
    configure_logging(Path(args.log_file))

    try:
        environment = load_environment(Path(args.env_file))
        worker_url = environment.get("CLOUDFLARE_WORKER_URL", "")
        secret = environment.get("CLOUDFLARE_SHARED_SECRET", "")
        if not worker_url or not secret:
            raise RuntimeError("Cloudflareへの接続設定が見つかりません。")

        equity_usd, usd_jpy_rate, rate_symbol, rate_time = read_mt5_values(
            Path(args.terminal)
        )
        if not args.dry_run:
            send_equity(
                worker_url,
                secret,
                equity_usd,
                usd_jpy_rate,
                rate_symbol,
                rate_time,
            )

        logging.info(
            "MT5有効証拠金の取得%sに成功しました。",
            "と送信" if not args.dry_run else "確認",
        )
        print(
            json.dumps(
                {
                    "ok": True,
                    "sent": not args.dry_run,
                    "currency": "USD",
                    "rateSymbol": rate_symbol,
                },
                ensure_ascii=False,
            )
        )
        return 0
    except Exception as error:
        logging.exception("MT5有効証拠金の同期に失敗しました: %s", error)
        print(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
