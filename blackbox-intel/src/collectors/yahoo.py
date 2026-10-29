"""Yahoo Finance senza yfinance: endpoint chart (prezzi) e quoteSummary (analisti).

Massimo 1 richiesta al secondo; il backoff sui 429 è in intel.http.
quoteSummary vuole cookie + crumb: si prendono una volta per processo.
"""
from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

import requests

from collectors.base import ok, unavailable
from intel import http

CHART = "https://query1.finance.yahoo.com/v8/finance/chart/{t}"
SUMMARY = "https://query2.finance.yahoo.com/v10/finance/quoteSummary/{t}"
# quoteSummary rifiuta lo User-Agent generico: serve quello di un browser.
BROWSER_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/130.0 Safari/537.36")
RATE = 1.0

_session: requests.Session | None = None
_crumb: str | None = None


def _pct(a: float, b: float) -> float | None:
    return (a / b - 1) * 100 if a and b else None


def prices(ticker: str) -> dict:
    """Ultima chiusura, variazione 1 e 5 sedute, valuta e tipo di strumento."""
    url = CHART.format(t=ticker)
    try:
        r = http.get(url, params={"range": "1mo", "interval": "1d"}, min_interval=RATE)
        res = (r.json().get("chart", {}).get("result") or [None])[0]
    except Exception as e:  # noqa: BLE001
        return unavailable(f"Yahoo chart: {e}", url)
    if not res:
        return unavailable(f"Yahoo chart HTTP {r.status_code}: nessun dato", url)
    meta = res["meta"]
    tz = ZoneInfo(meta.get("exchangeTimezoneName") or "UTC")
    rows = [(ts, c) for ts, c in zip(res.get("timestamp") or [], res["indicators"]["quote"][0].get("close") or [])
            if c is not None]
    if len(rows) < 2:
        return unavailable("Yahoo chart: meno di 2 chiusure", url)
    last_ts, last = rows[-1]
    return ok({
        "last": last,
        "date": datetime.fromtimestamp(last_ts, tz).date(),
        "chg_1d": _pct(last, rows[-2][1]),
        "chg_5d": _pct(last, rows[-6][1]) if len(rows) >= 6 else None,
        "currency": meta.get("currency", ""),
        "name": meta.get("longName") or meta.get("shortName") or ticker,
        "instrument": meta.get("instrumentType", ""),
    }, f"https://finance.yahoo.com/quote/{ticker}")


def _auth() -> tuple[requests.Session, str]:
    global _session, _crumb
    if _session is None or not _crumb:
        s = requests.Session()
        s.headers["User-Agent"] = BROWSER_UA
        s.get("https://fc.yahoo.com", timeout=20)  # risponde 404 ma imposta il cookie
        c = http.get("https://query1.finance.yahoo.com/v1/test/getcrumb", session=s,
                     headers={"User-Agent": BROWSER_UA}, min_interval=RATE)
        if c.status_code != 200 or not c.text.strip() or "<" in c.text:
            raise RuntimeError(f"crumb Yahoo non ottenuto (HTTP {c.status_code})")
        _session, _crumb = s, c.text.strip()
    return _session, _crumb


def analysts(ticker: str) -> dict:
    """Storico rating/target per casa d'analisi, trend delle raccomandazioni, consenso."""
    url = SUMMARY.format(t=ticker)
    try:
        s, crumb = _auth()
        r = http.get(url, session=s, headers={"User-Agent": BROWSER_UA}, min_interval=RATE,
                     params={"modules": "upgradeDowngradeHistory,recommendationTrend,financialData",
                             "crumb": crumb})
        if r.status_code == 404:
            return unavailable("Yahoo non ha dati analisti per questo strumento", url)
        r.raise_for_status()
        res = (r.json().get("quoteSummary", {}).get("result") or [{}])[0]
    except Exception as e:  # noqa: BLE001
        return unavailable(f"Yahoo quoteSummary: {e}", url)

    def raw(d, k):
        v = (d or {}).get(k)
        return v.get("raw") if isinstance(v, dict) else v

    history = [{
        "date": datetime.fromtimestamp(x["epochGradeDate"], ZoneInfo("UTC")).date(),
        "firm": x.get("firm", ""), "action": x.get("action", ""),
        "from": x.get("fromGrade", ""), "to": x.get("toGrade", ""),
        "pt_prior": x.get("priorPriceTarget") or None, "pt": x.get("currentPriceTarget") or None,
    } for x in (res.get("upgradeDowngradeHistory") or {}).get("history") or [] if x.get("epochGradeDate")]
    fd = res.get("financialData") or {}
    return ok({
        "history": history,
        "trend": [{k: t.get(k, 0) for k in ("period", "strongBuy", "buy", "hold", "sell", "strongSell")}
                  for t in (res.get("recommendationTrend") or {}).get("trend") or []],
        "consensus": {"key": fd.get("recommendationKey"), "target_mean": raw(fd, "targetMeanPrice"),
                      "target_low": raw(fd, "targetLowPrice"), "target_high": raw(fd, "targetHighPrice"),
                      "n": raw(fd, "numberOfAnalystOpinions"), "currency": fd.get("financialCurrency", "")},
    }, f"https://finance.yahoo.com/quote/{ticker}/analysis")
