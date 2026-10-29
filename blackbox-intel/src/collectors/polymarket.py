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
    """Temi da config.yaml più i nomi dei titoli (solo eventi che li citano nel titolo)."""
    pc = cfg.section("polymarket")
    prev = state.get("polymarket.prev", {})
    topics = [(t, t, None) for t in pc.get("temi") or []]
    topics += [(p.nome, p.nome.split(" (")[0], p.nome) for p in cfg.positions
               if not ((cfg.raw.get("tickers") or {}).get(p.ticker) or {}).get("sottostanti")]
    seen, groups, errors, now = set(), [], [], {}
    for label, q, must in topics:
        res = search(q, must, pc.get("eventi_per_tema", 3))
        if res["status"] != "ok":
            errors.append(f"{label}: {res['status']}")
            continue
        evs = []
        for e in res["data"]:
            if e["slug"] in seen or e["volume24h"] < pc.get("volume_minimo_24h", 100):
                continue
            seen.add(e["slug"])
            for m in e["markets"]:
                m["prev"] = prev.get(m["id"])
                now[m["id"]] = m["p"]
            evs.append(e)
        if evs:
            groups.append({"topic": label, "events": evs})
    state.set("polymarket.prev", {**prev, **now})
    if not groups and errors:
        return unavailable("; ".join(errors), SEARCH)
    out = ok(groups, "https://polymarket.com/")
    out["errors"] = errors
    return out
