"""Markdown del Modulo 3: retail per titolo e indicatori di mercato."""
from __future__ import annotations

from datetime import datetime

ARROW = {"positive": "▲", "negative": "▼", "neutral": "▬"}


def _arrow(up: bool | None) -> str:
    return "▬" if up is None else "▲" if up else "▼"


def _ape(r) -> str:
    a = r["ape"]
    if r["ape_status"] != "ok":
        return "n.d."
    if not a:
        return "nessuna menzione 24h"
    prev = a.get("mentions_24h_ago") or 0
    d = a["mentions"] - prev
    return f"{a['mentions']} (ieri {prev}) {_arrow(None if d == 0 else d > 0)} · #{a['rank']}"


def _st(r) -> str:
    s = r["stocktwits"]
    if s["status"] != "ok":
        return "n.d."
    d = s["data"]
    up = None if d["bullish"] == d["bearish"] else d["bullish"] > d["bearish"]
    return f"{_arrow(up)} {d['bullish']} bull / {d['bearish']} bear su {d['n']}"


def _posts(r) -> str:
    ps = r["posts"]
    if not ps:
        return "0"
    if r.get("sentiment_error"):
        return str(len(ps))
    c = {k: sum(1 for x in ps if x.get("sentiment") == k) for k in ARROW}
    return f"{len(ps)}: ▲{c['positive']} ▬{c['neutral']} ▼{c['negative']}"


def render(res: dict) -> str:
    L = ["## 🗣️ Sentiment retail", "",
         "_Menzioni Reddit: ApeWisdom, ultime 24 ore (solo USA). StockTwits: tag Bullish/Bearish messi "
         "dagli utenti sugli ultimi 30 messaggi (solo USA). Post: i più recenti nei subreddit seguiti, "
         "titoli classificati con FinBERT locale._", ""]
    feeds = res["feeds"]
    bad = [f"r/{s}: {f['status']}" for s, f in feeds.items() if f["status"] != "ok"]
    okf = [s for s, f in feeds.items() if f["status"] == "ok"]
    L.append(f"_Subreddit letti: {', '.join('r/' + s for s in okf) or 'nessuno'} ({res['n_posts']} post degli "
             f"ultimi 7 giorni)" + (f"; non disponibili: {'; '.join(bad)}" if bad else "") + "_")
    for tipo, label in (("portfolio", "Portfolio"), ("watchlist", "Watchlist")):
        rows = [r for r in res["rows"] if r["tipo"] == tipo]
        if not rows:
            continue
        L += ["", f"### {label}", "", "| Titolo | Menzioni Reddit 24h | StockTwits | Post subreddit |",
              "|---|---|---|---|"]
        L += [f"| **{r['ticker']}** | {_ape(r)} | {_st(r)} | {_posts(r)} |" for r in rows]
        for r in rows:
            top = sorted(r["posts"], key=lambda x: x["published"], reverse=True)[:3]
            if top:
                L += ["", f"_{r['ticker']}, post recenti:_"]
                L += [f"- {ARROW.get(x.get('sentiment'), '•')} [{x['title'][:140]}]({x['link']}) — "
                      f"r/{x['sub']}, {x['published']:%d/%m}" for x in top]

    m = res["market"]
    L += ["", "## 🌡️ Mercato", ""]
    fg = m["fg"]
    if fg["status"] == "ok":
        d = fg["data"]
        hist = " · ".join(f"{lab} {d[k]:.0f}" for lab, k in (("ieri", "prev_close"), ("1 settimana fa", "prev_week"),
                                                              ("1 mese fa", "prev_month")) if d.get(k) is not None)
        L.append(f"- **CNN Fear & Greed** {d['score']:.0f}/100, {d['rating']} "
                 f"({d['date']:%d/%m}) {_arrow(None if d.get('prev_close') is None else d['score'] > d['prev_close'])}"
                 f" · {hist} · [CNN]({fg['source_url']})")
    else:
        L.append(f"- **CNN Fear & Greed** {fg['status']}")
    v = m["vix"]
    if v["status"] == "ok":
        d = v["data"]
        # VIX che sale = più paura: freccia ribassista
        L.append(f"- **VIX** {d['last']:.2f} al {d['date']:%d/%m} · 1g {d['chg_1d']:+.2f} · 5g {d['chg_5d']:+.2f} "
                 f"{_arrow(None if d['chg_1d'] == 0 else d['chg_1d'] < 0)} _(VIX in salita = più paura)_ · "
                 f"[CBOE]({v['source_url']})")
    else:
        L.append(f"- **VIX** {v['status']}")
    pc = m["putcall"]
    if pc["status"] == "ok":
        d = pc["data"]
        prev = (f" (seduta prima {d['prev_total']:.2f} / {d['prev_equity']:.2f})" if d.get("prev_total") else "")
        up = None if not d.get("prev_total") or d["total"] == d["prev_total"] else d["total"] < d["prev_total"]
        L.append(f"- **Put/call CBOE** totale {d['total']:.2f}, azioni {d['equity']:.2f} del {d['date']:%d/%m}{prev} "
                 f"{_arrow(up)} _(più put = più protezione comprata)_ · [CBOE]({pc['source_url']})")
    else:
        L.append(f"- **Put/call CBOE** {pc['status']}")
    return "\n".join(L)
