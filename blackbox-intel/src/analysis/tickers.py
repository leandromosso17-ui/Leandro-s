"""Modulo 2: prezzi, news con sentiment e banche per ogni titolo del CSV (zero token)."""
from __future__ import annotations

import re
from datetime import datetime, timezone

from analysis import banks as B
from analysis.sentiment import classify
from collectors import news, yahoo


def _mentions(title: str, p) -> bool:
    t = title.lower()
    # niente ticker: "NOW" e "NET" sono parole comuni nei titoli inglesi
    return any(re.search(r"\b" + re.escape(a) + r"\b", t) for a in [p.nome.lower(), *p.alias])


def top_news(items: list[dict], p, n: int = 3) -> list[dict]:
    """I più rilevanti: citano il titolo, hanno un sentiment netto, sono recenti."""
    now = datetime.now(timezone.utc)

    def score(it):
        s = 2.0 if _mentions(it["title"], p) else 0.0
        if it.get("sentiment") in ("positive", "negative"):
            s += it.get("sent_score", 0)
        return s - (now - it["published"]).total_seconds() / 86400 * 0.15

    return sorted(items, key=score, reverse=True)[:n]


def analyze(cfg, state, p) -> dict:
    extra = (cfg.raw.get("tickers") or {}).get(p.ticker) or {}
    bank_cfg = cfg.raw.get("banche") or []
    days = cfg.section("news").get("days", 7)
    out = {"ticker": p.ticker, "nome": p.nome, "tipo": p.tipo}

    out["price"] = yahoo.prices(p.ticker)
    out["underlying"] = [(t, yahoo.prices(t)) for t in extra.get("sottostanti", [])]

    nw = news.ticker_news(p, extra, days)
    out["news"] = nw
    if nw["status"] == "ok":
        out["sentiment_error"] = classify(cfg, nw["data"])
        out["top_news"] = top_news(nw["data"], p)

    # ETF/ETC: niente copertura analisti, si guarda il sottostante
    is_fund = bool(extra.get("sottostanti")) or (out["price"]["data"] or {}).get("instrument") == "ETF"
    if is_fund:
        out["banks"] = {"status": "non disponibile: ETF/ETC, nessuna copertura degli analisti"}
        return out
    an = yahoo.analysts(p.ticker)
    rows = B.from_yahoo(an["data"]["history"]) if an["status"] == "ok" else []
    bn = news.bank_news(p)
    names = [p.nome, *p.alias]
    actions = [a for it in bn["data"] or [] if (a := B.from_headline(it, bank_cfg, names))]
    stored = B.merge_news_actions(state, p.ticker, actions)
    # Yahoo ha lo storico per banca solo sugli USA ed è spesso in ritardo di settimane:
    # i titoli di news lo completano (in Europa sono l'unica fonte per banca)
    out["banks"] = {
        "status": "ok" if (an["status"] == "ok" or stored) else an["status"],
        "source_url": an["source_url"],
        "consensus": B.consensus(state, p.ticker, an["data"]) if an["status"] == "ok" else None,
        "top": B.top_banks(rows + stored, bank_cfg),
        "from_headlines": not rows and bool(stored),
    }
    return out


def analyze_all(cfg, state, only: str | None = None) -> list[dict]:
    res = []
    for p in cfg.positions:
        if only and p.ticker != only:
            continue
        print(f"… {p.ticker}", flush=True)
        res.append(analyze(cfg, state, p))
    return res
