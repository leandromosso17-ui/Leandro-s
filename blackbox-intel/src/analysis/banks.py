"""Sentiment delle banche per titolo, tutto in Python (zero token).

- USA: storico Yahoo per casa d'analisi (rating e target nel tempo).
- Europa: Yahoo ha solo il consenso aggregato; rating e target per banca si
  ricavano dai titoli di Google News e si accumulano in SQLite run dopo run.
- Consenso: trend Yahoo degli ultimi 4 mesi più le nostre istantanee giornaliere.
"""
from __future__ import annotations

import re
from datetime import date, timedelta

# rating -> punteggio: >0 rialzista, 0 neutro, <0 ribassista
GRADES = [
    (2, ["strong buy", "conviction buy", "top pick"]),
    (1, ["buy", "outperform", "overweight", "sector outperform", "market outperform", "positive",
         "accumulate", "add", "moderate buy", "speculative buy"]),
    (0, ["hold", "neutral", "equal-weight", "equal weight", "market perform", "sector perform",
         "in-line", "in line", "peer perform", "sector weight", "mixed", "perform"]),
    (-1, ["sell", "underperform", "underweight", "reduce", "negative", "sector underperform",
          "market underperform", "moderate sell"]),
    (-2, ["strong sell"]),
]


def grade_score(g: str) -> int | None:
    g = (g or "").strip().lower()
    for score, names in GRADES:
        if g in names:
            return score
    return None


def bank_of(firm: str, banks: list[dict]) -> str | None:
    """Nome canonico della banca se `firm` è nella lista di config.yaml, altrimenti None."""
    f = firm.lower()
    for b in banks:
        if any(re.search(r"\b" + re.escape(a.lower()) + r"\b", f) for a in [b["nome"], *b.get("alias", [])]):
            return b["nome"]
    return None


def _priority(banks: list[dict]) -> dict[str, int]:
    return {b["nome"]: i for i, b in enumerate(banks)}


def _timeline(rows: list[dict]) -> list[dict]:
    """Un punto per giorno (i titoli dello stesso giorno si uniscono), rating e target mancanti
    ereditati dal punto precedente, conferme identiche consecutive tolte."""
    by_day: dict[date, dict] = {}
    for r in sorted(rows, key=lambda x: x["date"]):
        d = by_day.setdefault(r["date"], dict(r))
        d["rating"] = d.get("rating") or r.get("rating") or ""
        d["pt"] = d.get("pt") or r.get("pt")
    out: list[dict] = []
    for r in by_day.values():
        if out:
            r["rating"] = r["rating"] or out[-1]["rating"]
            r["pt"] = r["pt"] or out[-1]["pt"]
            if out[-1]["rating"] == r["rating"] and out[-1]["pt"] == r["pt"]:
                continue
        out.append(r)
    return out


def direction(first: dict, last: dict) -> str:
    s0, s1 = grade_score(first["rating"]), grade_score(last["rating"])
    if s0 is not None and s1 is not None and s1 != s0:
        return "più rialzista" if s1 > s0 else "più ribassista"
    if first.get("pt") and last.get("pt"):
        ch = (last["pt"] / first["pt"] - 1) * 100
        if abs(ch) >= 2:
            return "più rialzista" if ch > 0 else "più ribassista"
    return "stabile"


def top_banks(rows: list[dict], banks: list[dict], n: int = 3) -> list[dict]:
    """rows: [{date, firm, rating, pt, source, link?}]. Prima le grandi banche di config.yaml
    (in ordine di lista), poi si completa con le case più recenti."""
    prio = _priority(banks)
    by_firm: dict[str, list[dict]] = {}
    for r in rows:
        name = bank_of(r["firm"], banks) or r["firm"]
        by_firm.setdefault(name, []).append(r)
    big = sorted((f for f in by_firm if f in prio), key=prio.get)
    others = sorted((f for f in by_firm if f not in prio), key=lambda f: max(x["date"] for x in by_firm[f]),
                    reverse=True)
    out = []
    for f in (big + others)[:n]:
        tl = _timeline(by_firm[f])
        # stato attuale = ultimo cambio, con la data dell'ultima conferma
        current = {**tl[-1], "date": max(x["date"] for x in by_firm[f])}
        out.append({"bank": f, "big": f in prio, "timeline": tl, "current": current,
                    "direction": direction(tl[0], tl[-1]) if len(tl) > 1 else "un solo dato nel periodo"})
    return out


def from_yahoo(history: list[dict], months: int = 12) -> list[dict]:
    since = date.today() - timedelta(days=30 * months)
    return [{"date": h["date"], "firm": h["firm"], "rating": h["to"], "pt": h["pt"], "source": "Yahoo"}
            for h in history if h["date"] >= since and (h["to"] or h["pt"])]


# --- titoli di news ---------------------------------------------------------

# parole troppo comuni nei titoli per valere come rating
_NOT_IN_HEADLINES = {"add", "positive", "negative", "mixed", "perform", "in line", "in-line"}
_RATING_RE = re.compile(r"\b(" + "|".join(sorted({n for _, ns in GRADES for n in ns} - _NOT_IN_HEADLINES,
                                                 key=len, reverse=True)) + r")\b", re.I)
_NUM = r"(\d{1,5}(?:[.,]\d{1,2})?)"
_CUR = r"(?:euro|eur|€|\$|usd|us\$|dollari)"
_PT_FROM_TO = re.compile(r"\b(?:da|from)\s*" + _CUR + r"?\s*" + _NUM + r"\s*" + _CUR + r"?\s*(?:a|to)\s*"
                         + _CUR + r"?\s*" + _NUM, re.I)
# il numero del target deve avere una valuta o "a/to/at" davanti: così "Q3" o "target 2028" non passano
_PT = re.compile(r"(?:target(?:\s*price)?|price\s*target|prezzo\s*obiettivo)[^\d$€]{0,30}?"
                 r"(?:(?<![a-z])(?:a|to|at|di|of)\s+" + _CUR + r"?|" + _CUR + r")\s*" + _NUM, re.I)


def _num(s: str) -> float:
    return float(s.replace(",", "."))


def _target(t: str) -> float | None:
    ft = _PT_FROM_TO.search(t)
    if ft:
        return _num(ft.group(2))
    for m in _PT.finditer(t):
        if not re.search(r"\bby\s*\S*$", t[:m.start(1)], re.I):  # "lifts target by $100" è una variazione
            return _num(m.group(1))
    return None


def from_headline(item: dict, banks: list[dict], names: list[str]) -> dict | None:
    """Banca, rating e target da un titolo tipo «Citi alza il target di Prysmian a 136 euro».
    Il nome del titolo deve stare nella stessa frase della banca: i titoli che elencano più
    società («Adobe cala dopo il taglio di Wells Fargo; ServiceNow sale») non contano."""
    for part in re.split(r";|\s[-–—]\s", item["title"]):
        bank = bank_of(part, banks)
        low = part.lower()
        if not bank or not any(re.search(r"\b" + re.escape(n.lower()) + r"\b", low) for n in names):
            continue
        m = _RATING_RE.search(part)
        rating = m.group(1).title() if m else ""
        pt = _target(part)
        if not rating and pt is None:
            continue
        return {"date": item["published"].date(), "firm": bank, "rating": rating, "pt": pt,
                "source": item["source"], "link": item["link"], "title": item["title"]}
    return None


def merge_news_actions(state, ticker: str, new: list[dict]) -> list[dict]:
    """Accumula in SQLite le azioni delle banche lette dai titoli: lo storico cresce a ogni run."""
    key = f"banks.news.{ticker}"
    old = state.get(key, [])
    seen = {o["link"] for o in old}
    for a in new:
        if a["link"] not in seen:
            old.append({**a, "date": a["date"].isoformat()})
            seen.add(a["link"])
    old = [o for o in old if date.fromisoformat(o["date"]) >= date.today() - timedelta(days=400)]
    state.set(key, old)
    return [{**o, "date": date.fromisoformat(o["date"])} for o in old]


# --- consenso -----------------------------------------------------------------

def trend_score(t: dict) -> float | None:
    n = sum(t.get(k, 0) for k in ("strongBuy", "buy", "hold", "sell", "strongSell"))
    if not n:
        return None
    return (2 * t["strongBuy"] + t["buy"] - t["sell"] - 2 * t["strongSell"]) / n


def consensus(state, ticker: str, data: dict) -> dict:
    """Consenso attuale, confronto con 3 mesi fa (Yahoo) e con le nostre istantanee."""
    trend = {t["period"]: t for t in data.get("trend") or []}
    now, past = trend.get("0m"), trend.get("-3m") or trend.get("-2m") or trend.get("-1m")
    c = data.get("consensus") or {}
    out = {**c, "now": now, "past": past, "score_now": trend_score(now) if now else None,
           "score_past": trend_score(past) if past else None}
    if out["score_now"] is not None and out["score_past"] is not None:
        d = out["score_now"] - out["score_past"]
        out["direction"] = "più rialzista" if d > 0.05 else "più ribassista" if d < -0.05 else "stabile"
    # istantanee nostre (una al giorno) per vedere il target medio nel tempo
    key = f"banks.consensus.{ticker}"
    snaps = [s for s in state.get(key, []) if s["date"] != date.today().isoformat()]
    if c.get("target_mean"):
        snaps.append({"date": date.today().isoformat(), "target_mean": c["target_mean"], "n": c.get("n")})
        state.set(key, snaps[-400:])
    old = [s for s in snaps if date.fromisoformat(s["date"]) <= date.today() - timedelta(days=28)]
    if old and c.get("target_mean"):
        out["target_30d"] = old[-1]
    return out
