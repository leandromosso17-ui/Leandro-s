"""Modulo 5: Polymarket, API Gamma pubblica (ricerca). Probabilità attuale e variazione
rispetto al run precedente (salvata in SQLite). Zero token."""
from __future__ import annotations

import json
import re
from datetime import date, timedelta

from collectors.base import ok, unavailable
from intel import http

SEARCH = "https://gamma-api.polymarket.com/public-search"
_NOISE = re.compile(r"\bcombo\b|up or down|\bhit (?:in|week of)\b|candidate [a-z]\b", re.I)


def _yes(m: dict) -> float | None:
    try:
        return float(json.loads(m.get("outcomePrices") or "[]")[0])
    except (ValueError, IndexError, TypeError):
        return None


def search(query: str, must_contain: str | None = None, max_events: int = 3) -> dict:
    try:
        r = http.get(SEARCH, params={"q": query, "limit_per_type": 10, "events_status": "active"})
        r.raise_for_status()
        events = r.json().get("events") or []
    except Exception as e:  # noqa: BLE001
        return unavailable(f"Polymarket: {e}", SEARCH)
    out = []
    soon = (date.today() + timedelta(days=2)).isoformat()
    for e in events:
        title = e.get("title") or ""
        if e.get("closed") or (must_contain and not re.search(r"\b" + re.escape(must_contain) + r"\b", title, re.I)):
            continue
        # rumore: combo di più eventi, scommesse giornaliere, eventi che scadono entro 2 giorni
        if _NOISE.search(title) or (e.get("endDate") or "9999")[:10] < soon:
            continue
        markets = []
        for m in e.get("markets") or []:
            p = _yes(m)
            # sotto il 2% o sopra il 98%: già deciso, o esito con data passata non ancora chiuso
            if m.get("closed") or p is None or not 0.02 <= p <= 0.98:
                continue
            markets.append({"id": str(m.get("id")), "question": m.get("question", ""),
                            "label": m.get("groupItemTitle") or "", "p": p})
        if not markets:
            continue
        # eventi con molte opzioni: le 3 più probabili
        markets.sort(key=lambda m: m["p"], reverse=True)
        out.append({"title": title, "slug": e.get("slug", ""), "end": (e.get("endDate") or "")[:10],
                    "volume24h": e.get("volume24hr") or 0, "markets": markets[:3],
                    "url": f"https://polymarket.com/event/{e.get('slug', '')}"})
    out.sort(key=lambda e: e["volume24h"], reverse=True)
    return ok(out[:max_events], SEARCH)


def collect(cfg, state) -> dict:
    """Solo mercati che toccano portfolio o watchlist: i collegamenti di config.yaml più i nomi
    dei titoli (eventi che li citano nel titolo). Ogni evento sa a quali titoli si collega e perché."""
    pc = cfg.section("polymarket")
    prev = state.get("polymarket.prev", {})
    tick_cfg = cfg.raw.get("tickers") or {}
    topics = [(c["q"], c.get("deve"), c.get("titoli") or [], c.get("perche", "")) for c in pc.get("collegamenti") or []]
    topics += [(p.nome.split(" (")[0], p.nome.split(" (")[0], [p.ticker], "citato per nome")
               for p in cfg.positions if not (tick_cfg.get(p.ticker) or {}).get("sottostanti")]
    by_slug, errors, now = {}, [], {}
    for q, must, tickers, why in topics:
        res = search(q, must, pc.get("eventi_per_tema", 2))
        if res["status"] != "ok":
            errors.append(f"{q}: {res['status']}")
            continue
        for e in res["data"]:
            if e["volume24h"] < pc.get("volume_minimo_24h", 100):
                continue
            if e["slug"] in by_slug:  # stesso evento trovato da due ricerche: unisce i titoli
                by_slug[e["slug"]]["tickers"] = sorted(set(by_slug[e["slug"]]["tickers"]) | set(tickers))
                continue
            for m in e["markets"]:
                m["prev"] = prev.get(m["id"])
                now[m["id"]] = m["p"]
            by_slug[e["slug"]] = {**e, "tickers": tickers, "why": why}
    state.set("polymarket.prev", {**prev, **now})
    if not by_slug and errors:
        return unavailable("; ".join(errors), SEARCH)
    events = sorted(by_slug.values(), key=lambda e: (e["tickers"] == ["tutti"], -e["volume24h"]))
    out = ok(events, "https://polymarket.com/")
    out["errors"] = errors
    return out
