"""Modulo 7: pesi, concentrazione, esposizioni, correlazioni a 90 giorni, temi del giorno.
Tutto in Python, zero token. Mai consigli: le osservazioni diventano domande."""
from __future__ import annotations

import math
from datetime import date, timedelta

from collectors import yahoo


def weights(positions) -> dict:
    port = [p for p in positions if p.tipo == "portfolio"]
    tot = sum(p.investito_k or 0 for p in port)
    if not tot:
        return {"status": "non disponibile: colonna investito_k vuota in portfolio.csv", "w": {}}
    w = {p.ticker: (p.investito_k or 0) / tot for p in port}
    top = sorted(w.items(), key=lambda x: x[1], reverse=True)
    return {"status": "ok", "w": w, "total_k": tot, "top3": sum(v for _, v in top[:3]),
            "hhi": sum(v * v for v in w.values())}


def exposures(positions, w: dict, profiles: dict, prices: dict, tick_cfg: dict) -> dict:
    """Per settore, paese e valuta. Con i pesi se ci sono, altrimenti numero di posizioni."""
    out = {"settore": {}, "paese": {}, "valuta": {}}
    for p in positions:
        if p.tipo != "portfolio":
            continue
        extra = tick_cfg.get(p.ticker) or {}
        prof = (profiles.get(p.ticker) or {}).get("data") or {}
        price = (prices.get(p.ticker) or {}).get("data") or {}
        keys = {"settore": extra.get("settore") or prof.get("sector") or "n.d.",
                "paese": extra.get("paese") or prof.get("country") or "n.d.",
                "valuta": price.get("currency") or "n.d."}
        v = w.get(p.ticker, 1.0) if w else 1.0
        for dim, k in keys.items():
            out[dim][k] = out[dim].get(k, 0) + v
    return out


def _pearson(a: list[float], b: list[float]) -> float | None:
    n = len(a)
    if n < 20:
        return None
    ma, mb = sum(a) / n, sum(b) / n
    cov = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    va, vb = sum((x - ma) ** 2 for x in a), sum((y - mb) ** 2 for y in b)
    return cov / math.sqrt(va * vb) if va and vb else None


def correlations(tickers: list[str], days: int = 90) -> dict:
    """Correlazione dei rendimenti giornalieri sugli ultimi `days` giorni di calendario.
    Titoli su borse diverse: si usano solo i giorni in cui hanno quotato entrambi."""
    since = date.today() - timedelta(days=days)
    hist, errors = {}, []
    for t in tickers:
        h = yahoo.history(t, "6mo")
        if h["status"] == "ok":
            hist[t] = {d: c for d, c in h["data"].items() if d >= since - timedelta(days=7)}
        else:
            errors.append(f"{t}: {h['status']}")
    pairs = {}
    names = list(hist)
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            common = sorted(set(hist[a]) & set(hist[b]))
            ra, rb = [], []
            for d0, d1 in zip(common, common[1:]):
                if d1 < since:
                    continue
                ra.append(hist[a][d1] / hist[a][d0] - 1)
                rb.append(hist[b][d1] / hist[b][d0] - 1)
            r = _pearson(ra, rb)
            if r is not None:
                pairs[(a, b)] = (r, len(ra))
    return {"pairs": pairs, "errors": errors, "days": days}


def touched(positions, episodes: list[dict], news: dict) -> dict[str, list[str]]:
    """Titoli toccati dai temi del giorno: citati nel podcast o con molte news e forte movimento."""
    out: dict[str, list[str]] = {}
    for ep in episodes:
        s = ep.get("summary") or {}
        for a in s.get("tuoi_asset") or []:
            if a.get("concetti"):
                out.setdefault(a.get("ticker", ""), []).append(f"podcast {ep.get('slot', '')}")
        for k in ep.get("links") or []:
            if k["tipo"] == "citato direttamente":
                out.setdefault(k["ticker"], []).append("citato per nome nel podcast")
    for p in positions:
        r = news.get(p.ticker) or {}
        d = (r.get("price") or {}).get("data") or {}
        if d.get("chg_1d") is not None and abs(d["chg_1d"]) >= 3:
            out.setdefault(p.ticker, []).append(f"movimento {d['chg_1d']:+.1f}% in una seduta")
    return {k: sorted(set(v)) for k, v in out.items() if k}


def questions(positions, wt: dict, corr: dict, hit: dict[str, list[str]]) -> list[str]:
    """Osservazioni in forma di domanda, mai consigli."""
    Q = []
    w = wt.get("w") or {}
    for p in positions:
        if p.ticker in hit and p.tipo == "portfolio":
            peso = f" pesa il {w[p.ticker] * 100:.0f}% e" if p.ticker in w else ""
            Q.append(f"{p.ticker}{peso} oggi è toccato da: {', '.join(hit[p.ticker])}. Vuoi rivedere la tesi?")
    if wt.get("status") == "ok" and wt["top3"] >= 0.6:
        Q.append(f"Le prime 3 posizioni pesano il {wt['top3'] * 100:.0f}% del portfolio: è una concentrazione voluta?")
    port = {p.ticker for p in positions if p.tipo == "portfolio"}
    for (a, b), (r, n) in sorted(corr["pairs"].items(), key=lambda x: -abs(x[1][0])):
        if a in port and b in port and abs(r) >= 0.7:
            Q.append(f"{a} e {b} hanno correlazione {r:+.2f} a {corr['days']} giorni ({n} sedute in comune): "
                     "ti aspettavi che si muovessero così insieme?")
    return Q


def collect(cfg, news: dict, profiles: dict, episodes: list[dict]) -> dict:
    positions = cfg.positions
    tick_cfg = cfg.raw.get("tickers") or {}
    wt = weights(positions)
    prices = {t: r.get("price") for t, r in news.items()}
    print("… correlazioni a 90 giorni", flush=True)
    corr = correlations([p.ticker for p in positions], cfg.section("portfolio").get("giorni_correlazione", 90))
    hit = touched(positions, episodes, news)
    return {"weights": wt, "exposures": exposures(positions, wt.get("w"), profiles, prices, tick_cfg),
            "corr": corr, "touched": hit, "questions": questions(positions, wt, corr, hit)}
