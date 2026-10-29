"""Markdown del Modulo 2: tabelle portfolio/watchlist e dettaglio per titolo."""
from __future__ import annotations

ARROW = {"positive": "▲", "negative": "▼", "neutral": "▬"}
DIR = {"più rialzista": "▲ più rialzista", "più ribassista": "▼ più ribassista", "stabile": "▬ stabile"}


def _chg(v) -> str:
    if v is None:
        return "n.d."
    return f"{'▲' if v > 0 else '▼' if v < 0 else '▬'} {v:+.1f}%"


def _num(v, cur="") -> str:
    if v is None:
        return "n.d."
    s = f"{v:,.2f}" if v < 1000 else f"{v:,.0f}"
    return f"{s} {cur}".strip()


def _sent_counts(r) -> str:
    items = (r["news"].get("data") or []) if r["news"]["status"] == "ok" else []
    if r["news"]["status"] != "ok":
        return "n.d."
    if r.get("sentiment_error"):
        return f"{len(items)} titoli"
    c = {k: sum(1 for i in items if i.get("sentiment") == k) for k in ARROW}
    return f"{len(items)}: ▲{c['positive']} ▬{c['neutral']} ▼{c['negative']}"


def _bank_cell(r) -> str:
    b = r["banks"]
    if b["status"] != "ok":
        return "n.d."
    c = b.get("consensus") or {}
    d = c.get("direction")
    key = (c.get("key") or "").replace("_", " ").replace("none", "n.d.")
    if key or d:
        return f"{key} {DIR.get(d, '').split(' ')[0] if d else ''}".strip()
    return "da titoli news" if b.get("from_headlines") else "n.d."


def table(rows: list[dict]) -> list[str]:
    L = ["| Titolo | Prezzo | 1g | 5g | News 7g | Banche |", "|---|---|---|---|---|---|"]
    for r in rows:
        p = r["price"]
        if p["status"] == "ok":
            d = p["data"]
            L.append(f"| **{r['ticker']}** | {_num(d['last'], d['currency'])} ({d['date']:%d/%m}) | "
                     f"{_chg(d['chg_1d'])} | {_chg(d['chg_5d'])} | {_sent_counts(r)} | {_bank_cell(r)} |")
        else:
            L.append(f"| **{r['ticker']}** | n.d. | | | {_sent_counts(r)} | {_bank_cell(r)} |")
    return L


def _trend_counts(t) -> str:
    return (f"{t['strongBuy'] + t['buy']} buy / {t['hold']} hold / {t['sell'] + t['strongSell']} sell"
            if t else "n.d.")


def _timeline(tl: list[dict], cur: str) -> str:
    parts = []
    for x in tl[-5:]:
        pt = f" {_num(x['pt'], cur)}" if x.get("pt") else ""
        parts.append(f"{x['date']:%d/%m/%y} {x['rating'] or '–'}{pt}")
    return " → ".join(parts)


def detail(r: dict) -> list[str]:
    L = [f"#### {r['nome']} ({r['ticker']})"]
    p = r["price"]
    if p["status"] == "ok":
        d = p["data"]
        L.append(f"- **Prezzo** {_num(d['last'], d['currency'])} al {d['date']:%d/%m} · 1g {_chg(d['chg_1d'])} · "
                 f"5g {_chg(d['chg_5d'])} · [Yahoo]({p['source_url']})")
    else:
        L.append(f"- **Prezzo** {p['status']}")
    for t, u in r.get("underlying") or []:
        if u["status"] == "ok":
            d = u["data"]
            L.append(f"- Sottostante **{d['name']}** ({t}): {_num(d['last'], d['currency'])} al {d['date']:%d/%m} · "
                     f"1g {_chg(d['chg_1d'])} · 5g {_chg(d['chg_5d'])}")
        else:
            L.append(f"- Sottostante {t}: {u['status']}")

    nw = r["news"]
    if nw["status"] != "ok":
        L.append(f"- **News** {nw['status']}")
    else:
        head = f"- **News 7 giorni** ({_sent_counts(r)})"
        if r.get("sentiment_error"):
            head += f" · sentiment {r['sentiment_error']}"
        L.append(head)
        for it in r.get("top_news") or []:
            a = ARROW.get(it.get("sentiment"), "•")
            L.append(f"  - {a} [{it['title']}]({it['link']}) — {it['source']}, {it['published']:%d/%m}")

    b = r["banks"]
    if b["status"] != "ok":
        L.append(f"- **Banche** {b['status']}")
        return L
    c = b.get("consensus") or {}
    cur = c.get("currency") or ((p["data"] or {}).get("currency", "") if p["status"] == "ok" else "")
    if c.get("now"):
        line = (f"- **Consenso** {_trend_counts(c['now'])}"
                + (f" ({c['n']} analisti)" if c.get("n") else "")
                + (f", target medio {_num(c['target_mean'], cur)}" if c.get("target_mean") else "")
                + (f" · 3 mesi fa {_trend_counts(c['past'])} → {DIR.get(c.get('direction'), '')}" if c.get("past") else ""))
        if c.get("target_30d"):
            o = c["target_30d"]
            ch = (c["target_mean"] / o["target_mean"] - 1) * 100
            line += f" · target medio il {o['date'][8:10]}/{o['date'][5:7]}: {_num(o['target_mean'], cur)} ({ch:+.1f}%)"
        L.append(line + f" · [Yahoo]({b['source_url']})")
    if b.get("top"):
        L.append("- **Banche principali**" + (" _(dai titoli di news: rating e target come riportati, "
                                               "non dal report)_" if b.get("from_headlines")
                                              else " _(Yahoo + titoli di news; [fonte] = dato da un titolo)_"))
        for t in b["top"]:
            cu = t["current"]
            pt = f", target {_num(cu['pt'], cur)}" if cu.get("pt") else ""
            src = f" · [fonte]({cu['link']})" if cu.get("link") else ""
            L.append(f"  - **{t['bank']}**: {cu['rating'] or 'rating n.d.'}{pt} (ultimo aggiornamento {cu['date']:%d/%m/%y}) · "
                     f"{DIR.get(t['direction'], t['direction'])}{src}")
            if len(t["timeline"]) > 1:
                L.append(f"    - storico: {_timeline(t['timeline'], cur)}")
    elif not c.get("now"):
        L.append("- **Banche** nessun rating o target trovato")
    return L


def render(results: list[dict]) -> str:
    L = ["## 📰 News e banche", "",
         "_Sentiment dei titoli con FinBERT locale; banche: rating e target come pubblicati, "
         "non un consiglio. ▲ rialzista · ▼ ribassista · ▬ neutro._"]
    for tipo, label in (("portfolio", "Portfolio"), ("watchlist", "Watchlist")):
        rows = [r for r in results if r["tipo"] == tipo]
        if not rows:
            continue
        L += ["", f"### {label}", ""] + table(rows)
        for r in rows:
            L += [""] + detail(r)
    return "\n".join(L)
