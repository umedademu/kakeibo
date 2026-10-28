from __future__ import annotations

import argparse
import json
import logging
from logging.handlers import RotatingFileHandler
import math
import os
from pathlib import Path
import re
import sys
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import MetaTrader5 as mt5


HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info"
# 現物のUSDCの額が、含み損益を含む口座全体の額になる口座の種類
HYPERLIQUID_UNIFIED_KINDS = {"unifiedAccount", "portfolioMargin"}
# 現物のUSDCと、無期限先物の口座の額が別々になっている口座の種類
HYPERLIQUID_SEPARATE_KINDS = {"default", "disabled"}
HYPERLIQUID_ADDRESS = re.compile(r"0x[0-9a-fA-F]{40}")


class SyncSkipped(RuntimeError):
    """本番口座を確認できない場合や、ハイリキの問い合わせが混み合っている場合は、保存済みの残高を維持する。"""


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
        if getattr(account, "trade_mode", None) != mt5.ACCOUNT_TRADE_MODE_REAL:
            raise SyncSkipped("本番口座ではないため、残高の更新を見送りました。")
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


def post_hyperliquid_info(body: dict[str, str]) -> object:
    request = Request(
        HYPERLIQUID_INFO_URL,
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={"Content-Type": "application/json", "User-Agent": "kakeibo-mt5-sync/1.0"},
    )
    try:
        with urlopen(request, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        if error.code == 429:
            # 同じパソコンのBOTと問い合わせの上限を分け合っているため、やり直さずに次の回を待つ。
            raise SyncSkipped("ハイリキの問い合わせの上限に達したため、残高の更新を見送りました。") from error
        raise RuntimeError(f"ハイリキからエラーが返されました: {error.code}") from error
    except (URLError, TimeoutError) as error:
        raise RuntimeError("ハイリキへ接続できません。") from error
    except ValueError as error:
        raise RuntimeError("ハイリキの応答を読み取れません。") from error


def read_dollar_amount(value: object) -> float:
    try:
        amount = float(value)
    except (TypeError, ValueError) as error:
        raise RuntimeError("ハイリキの残高を読み取れません。") from error
    if not math.isfinite(amount):
        raise RuntimeError("ハイリキの残高を読み取れません。")
    return amount


def read_hyperliquid_equity(address: str) -> float:
    kind = post_hyperliquid_info({"type": "userAbstraction", "user": address})
    if not isinstance(kind, str) or (
        kind not in HYPERLIQUID_UNIFIED_KINDS and kind not in HYPERLIQUID_SEPARATE_KINDS
    ):
        raise RuntimeError(f"ハイリキの口座の種類に対応していません: {str(kind)[:40]}")

    spot = post_hyperliquid_info({"type": "spotClearinghouseState", "user": address})
    balances = spot.get("balances") if isinstance(spot, dict) else None
    if not isinstance(balances, list):
        raise RuntimeError("ハイリキの現物残高を読み取れません。")
    equity_usd = 0.0
    has_other_coins = False
    for balance in balances:
        if not isinstance(balance, dict):
            raise RuntimeError("ハイリキの現物残高を読み取れません。")
        if balance.get("coin") == "USDC":
            equity_usd += read_dollar_amount(balance.get("total"))
        elif read_dollar_amount(balance.get("total")) != 0:
            has_other_coins = True
    if has_other_coins:
        logging.info("ハイリキのUSDC以外の現物は数えていません。")

    if kind in HYPERLIQUID_SEPARATE_KINDS:
        # 統合口座の先物の額は現物のUSDCから割り当てた分なので、別々の口座の時だけ足す。
        perp = post_hyperliquid_info({"type": "clearinghouseState", "user": address})
        try:
            account_value = perp["marginSummary"]["accountValue"]
        except (KeyError, TypeError) as error:
            raise RuntimeError("ハイリキの先物の残高を読み取れません。") from error
        equity_usd += read_dollar_amount(account_value)

    if equity_usd < 0:
        raise RuntimeError("ハイリキの残高が正しくありません。")
    return equity_usd


def send_equity(
    worker_url: str,
    secret: str,
    equity_usd: float,
    hyperliquid_equity_usd: float | None,
    usd_jpy_rate: float,
    rate_symbol: str,
    rate_time: datetime,
) -> None:
    recorded_at = datetime.now(timezone.utc)
    body = json.dumps(
        {
            "equityUsd": equity_usd,
            "hyperliquidEquityUsd": hyperliquid_equity_usd,
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
        hyperliquid_address = environment.get("HYPERLIQUID_ACCOUNT_ADDRESS", "").strip()
        if hyperliquid_address and not HYPERLIQUID_ADDRESS.fullmatch(hyperliquid_address):
            raise RuntimeError("ハイリキの口座のアドレスが正しくありません。")

        equity_usd, usd_jpy_rate, rate_symbol, rate_time = read_mt5_values(
            Path(args.terminal)
        )
        # ハイリキを読めない回は、合計が急に減らないよう送信ごと見送る。
        hyperliquid_equity_usd = (
            read_hyperliquid_equity(hyperliquid_address) if hyperliquid_address else None
        )
        if not args.dry_run:
            send_equity(
                worker_url,
                secret,
                equity_usd,
                hyperliquid_equity_usd,
                usd_jpy_rate,
                rate_symbol,
                rate_time,
            )

        logging.info(
            "MT5%sの有効証拠金の取得%sに成功しました。",
            "とハイリキ" if hyperliquid_equity_usd is not None else "",
            "と送信" if not args.dry_run else "確認",
        )
        print(
            json.dumps(
                {
                    "ok": True,
                    "sent": not args.dry_run,
                    "currency": "USD",
                    "hyperliquid": hyperliquid_equity_usd is not None,
                    "rateSymbol": rate_symbol,
                },
                ensure_ascii=False,
            )
        )
        return 0
    except SyncSkipped as reason:
        logging.info("%s", reason)
        print(
            json.dumps(
                {"ok": True, "sent": False, "skipped": True, "reason": str(reason)},
                ensure_ascii=False,
            )
        )
        return 0
    except Exception as error:
        logging.exception("FX口座の残高の同期に失敗しました: %s", error)
        print(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
