"""Indicatori di mercato: CNN Fear & Greed, VIX (CBOE), put/call ratio (CBOE)."""
from __future__ import annotations

import csv
import io
from datetime import date, datetime, timedelta

from collectors.base import ok, unavailable
from intel import http

FG = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata"
VIX = "https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv"
PUTCALL = "https://cdn.cboe.com/data/us/options/market_statistics/daily/{d}_daily_options"
FG_IT = {"extreme fear": "paura estrema", "fear": "paura", "neutral": "neutrale",
         "greed": "avidità", "extreme greed": "avidità estrema"}


def fear_greed() -> dict:
    try:
        r = http.get(FG)
        r.raise_for_status()
        d = r.json()["fear_and_greed"]
    except Exception as e:  # noqa: BLE001
        return unavailable(f"CNN Fear & Greed: {e}", FG)
    return ok({"score": d.get("score"), "rating": FG_IT.get(d.get("rating", ""), d.get("rating", "")),
               "date": datetime.fromisoformat(d["timestamp"]).date() if d.get("timestamp") else None,
               "prev_close": d.get("previous_close"), "prev_week": d.get("previous_1_week"),
               "prev_month": d.get("previous_1_month"), "prev_year": d.get("previous_1_year")},
              "https://edition.cnn.com/markets/fear-and-greed")


def vix() -> dict:
    try:
        r = http.get(VIX)
        r.raise_for_status()
        rows = [x for x in csv.DictReader(io.StringIO(r.text)) if x.get("CLOSE")]
    except Exception as e:  # noqa: BLE001
        return unavailable(f"CBOE VIX: {e}", VIX)
    if len(rows) < 6:
        return unavailable("CBOE VIX: storico troppo corto", VIX)
    last, prev, week = (float(rows[i]["CLOSE"]) for i in (-1, -2, -6))
    return ok({"last": last, "date": datetime.strptime(rows[-1]["DATE"], "%m/%d/%Y").date(),
               "chg_1d": last - prev, "chg_5d": last - week}, "https://www.cboe.com/tradable_products/vix/")


def _trading_days(n: int) -> list[date]:
    d, out = date.today() - timedelta(days=1), []
    while len(out) < n:
        if d.weekday() < 5:
            out.append(d)
        d -= timedelta(days=1)
    return out


def putcall() -> dict:
    """Ultime due sedute disponibili (le festività USA non hanno file: si salta indietro)."""
    found = []
    for d in _trading_days(6):
        try:
            r = http.get(PUTCALL.format(d=d.isoformat()), retries=1)
            if r.status_code != 200:
                continue
            ratios = {x.get("name"): x.get("value") for x in r.json().get("ratios") or []}
        except Exception:  # noqa: BLE001
            continue
        if "TOTAL PUT/CALL RATIO" in ratios:
            found.append((d, float(ratios["TOTAL PUT/CALL RATIO"]), float(ratios.get("EQUITY PUT/CALL RATIO") or 0)))
        if len(found) == 2:
            break
    if not found:
        return unavailable("CBOE put/call: nessun file nelle ultime sedute", PUTCALL.format(d=""))
    (d, tot, eq), prev = found[0], (found[1] if len(found) > 1 else None)
    return ok({"date": d, "total": tot, "equity": eq,
               "prev_total": prev[1] if prev else None, "prev_equity": prev[2] if prev else None},
              "https://www.cboe.com/us/options/market_statistics/daily/")
