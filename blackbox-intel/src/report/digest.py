"""Digest completo in Markdown: un solo documento da cui derivano HTML e Notion.

Ordine: banner utili · cosa è cambiato (sera) · podcast · tabella portfolio · tabella
watchlist · mercato e Polymarket · analisi (chiamata finale) · dettaglio per titolo ·
portfolio · fonti e token.
"""
from __future__ import annotations

from datetime import date

from analysis.earnings import banner
from report.retail import _ape, _forum, _st, render_market, retail_detail
from report.tickers import _chg, _num, _sent_counts, detail as news_detail

DIR_ARROW = {"più rialzista": "▲", "più ribassista": "▼", "stabile": "▬"}


# --- celle delle tabelle ---------------------------------------------------------

def _price_cells(n: dict) -> tuple[str, str]:
    p = (n.get("price") or {})
    if p.get("status") != "ok":
        return "n.d.", "n.d."
    d = p["data"]
    return f"{_chg(d['chg_1d'])} ({d['date']:%d/%m})", _chg(d["chg_5d"])


def _news_cell(n: dict) -> str:
    nw = n.get("news") or {}
    if nw.get("status") != "ok":
        return "n.d."
    items = nw["data"] or []
    pos = sum(1 for i in items if i.get("sentiment") == "positive")
    neg = sum(1 for i in items if i.get("sentiment") == "negative")
    a = "▬" if pos == neg or n.get("sentiment_error") else "▲" if pos > neg else "▼"
    return f"{a} {_sent_counts(n)}"


def _bank_cell(n: dict) -> str:
    b = n.get("banks") or {}
    if b.get("status") != "ok":
        return "n.d."
    c = b.get("consensus") or {}
    key = (c.get("key") or "").replace("_", " ").replace("none", "n.d.")
    return f"{DIR_ARROW.get(c.get('direction'), '')} {key}".strip() or "da news"


def _retail_cell(r: dict) -> str:
    if not r:
        return "n.d."
    if r.get("ape_status") == "ok":
        return f"{_st(r)} · Reddit {_ape(r).split(' ·')[0]}"
    if r.get("forum"):
        return f"forum: {_forum(r, 30)}"
    return "n.d."


def _pos_cell(x: dict) -> str:
    if not x:
        return "n.d."
    if x.get("cot"):
        c = x["cot"]
        if c["status"] != "ok":
            return "COT n.d."
        d = c["data"]
        return f"COT netto {d['net'] / 1000:+.0f}k {'▲' if d['chg_week'] > 0 else '▼'} {d['chg_week'] / 1000:+.0f}k ({d['date'][8:10]}/{d['date'][5:7]})"
    if x.get("note"):
        return "n.d. (ETF)"
    parts = []
    ins = x.get("insiders") or {}
    if ins.get("status") == "ok":
        s = ins["summary"]
        flag = f" ⚠ cluster {s['cluster']}" if s["cluster"] else ""
        a = "▲" if s["buys"] > s["sells"] else "▼" if s["sells"] > s["buys"] else "▬"
        parts.append(f"insider {a} {s['buys']}A/{s['sells']}V{flag}")
    si = x.get("short_interest") or {}
    if si.get("status") == "ok":
        d = si["data"]
        parts.append(f"SI {d['days_to_cover']:.1f}gg {'▼' if d['chg_pct'] > 0 else '▲'} ({d['date'][8:10]}/{d['date'][5:7]})")
    eu = x.get("eu_shorts") or {}
    if eu.get("status") == "ok":
        tot = sum(r["pct"] for r in eu["data"])
        parts.append(f"short {tot:.2f}% ({len(eu['data'])} fondi) {'▼' if tot else '▬'}" if eu["data"]
                     else "nessuno short ≥0,5% ▬")
    elif eu:
        parts.append("short n.d.")
    return " · ".join(parts) or "n.d."


def _earn_cell(e: dict) -> str:
    if not e or e.get("status") != "ok":
        return "n.d." if not e or "ETF" not in e.get("status", "") else "–"
    n = e.get("next")
    if n:
        return f"{n['date']:%d/%m} {'stimata' if n.get('estimated') else 'confermata'}"
    if e.get("reported_on") and (date.today() - e["reported_on"]).days <= 3:
        return f"uscito il {e['reported_on']:%d/%m}"
    return "oltre 14 giorni"


def _tesi_cell(p, final: dict) -> str:
    if not p.tesi:
        return "tesi vuota"
    hits = [x for x in final.get("tesi_a_rischio") or [] if x.get("ticker") == p.ticker]
    return "⚠ sì" if hits else "no"


def table(cfg, tipo: str, ctx: dict) -> list[str]:
    w = ((ctx["portfolio"].get("weights") or {}).get("w")) or {}
    head = ["Titolo"] + (["Peso"] if tipo == "portfolio" else []) + \
           ["1g", "5g", "News 7g", "Banche", "Retail", "Posizionamento", "Prossimo utile", "Tesi a rischio"]
    L = ["| " + " | ".join(head) + " |", "|" + "---|" * len(head)]
    for p in cfg.positions:
        if p.tipo != tipo:
            continue
        n = ctx["news"].get(p.ticker) or {}
        c1, c5 = _price_cells(n)
        cells = [f"**{p.ticker}**"]
        if tipo == "portfolio":
            cells.append(f"{w[p.ticker] * 100:.0f}%" if p.ticker in w else "n.d.")
        cells += [c1, c5, _news_cell(n), _bank_cell(n), _retail_cell(ctx["retail"].get(p.ticker)),
                  _pos_cell(ctx["positioning"].get(p.ticker)), _earn_cell(ctx["earnings"].get(p.ticker)),
                  _tesi_cell(p, ctx["final"])]
        L.append("| " + " | ".join(c.replace("|", "/") for c in cells) + " |")
    return L


# --- sezioni -----------------------------------------------------------------------

def positioning_detail(x: dict) -> list[str]:
    L = []
    if not x:
        return L
    if x.get("note"):
        L.append(f"- **Posizionamento** {x['note']}")
    if x.get("cot"):
        c = x["cot"]
        if c["status"] == "ok":
            d = c["data"]
            L.append(f"- **COT CFTC rame** (non commerciali, {d['market']}) netto {d['net']:+,.0f} contratti, "
                     f"variazione settimanale {d['chg_week']:+,.0f} · report del {d['date']} · [CFTC]({c['source_url']})")
        else:
            L.append(f"- **COT CFTC rame** {c['status']}")
    ins = x.get("insiders")
    if ins:
        if ins["status"] == "ok":
            s = ins["summary"]
            line = (f"- **Insider (Form 4, mercato aperto, 90 giorni)** {s['buys']} acquisti da {s['buyers']} insider "
                    f"({_num(s['buy_value'], '$')}), {s['sells']} vendite da {s['sellers']} ({_num(s['sell_value'], '$')})")
            if s["cluster"]:
                line += f" · ⚠ cluster: 3 o più insider in {s['cluster']}"
            L.append(line + f" · [xoomar]({ins['source_url']})")
            for t in s["top"]:
                L.append(f"  - {t['date']} {t['name']} ({t['title']}): {t['side']} {t['shares']:,.0f} azioni, {_num(t['value'], '$')}")
        else:
            L.append(f"- **Insider** {ins['status']}")
    si = x.get("short_interest")
    if si:
        if si["status"] == "ok":
            d = si["data"]
            L.append(f"- **Short interest FINRA** {d['shares']:,} azioni al {d['date']} ({d['chg_pct']:+.1f}% vs {d['prev_date']}), "
                     f"{d['days_to_cover']:.1f} giorni per coprire · [fonte]({si['source_url']})")
        else:
            L.append(f"- **Short interest** {si['status']}")
    h = x.get("holders")
    if h:
        if h["status"] == "ok" and h["data"]:
            top = ", ".join(f"{r['holder']} {r['pct']:.1f}% ({r['form'].replace('SCHEDULE ', '')}, {r['filed']})"
                            for r in h["data"][:3] if r["pct"])
            L.append(f"- **Grandi azionisti 13D/13G** {top or 'nessuno sopra il 5%'} _(depositi fino a 45 giorni dopo "
                     "la fine del trimestre: dati in ritardo)_")
        elif h["status"] != "ok":
            L.append(f"- **13D/13G** {h['status']}")
    eu = x.get("eu_shorts")
    if eu:
        if eu["status"] == "ok":
            if eu["data"]:
                rows = ", ".join(f"{r['holder']} {r['pct']:.2f}% ({r['date']})" for r in eu["data"][:5])
                L.append(f"- **Posizioni corte nette ≥0,5% ({eu['reg']})** totale {sum(r['pct'] for r in eu['data']):.2f}%: "
                         f"{rows} · [registro]({eu['source_url']})")
            else:
                L.append(f"- **Posizioni corte nette ({eu['reg']})** nessuna pubblicata sopra lo 0,5% · "
                         f"[registro]({eu['source_url']})")
        else:
            L.append(f"- **Posizioni corte nette** {eu['status']}")
    return L


def polymarket_md(pm: dict) -> list[str]:
    if pm["status"] != "ok":
        return [f"- **Polymarket** {pm['status']}"]
    L = ["", "### 🎲 Polymarket", "_Probabilità implicita del «sì»; variazione rispetto al run precedente._"]
    for g in pm["data"]:
        L.append(f"- **{g['topic']}**")
        for e in g["events"]:
            ms = []
            for m in e["markets"]:
                ch = ""
                if m.get("prev") is not None:
                    d = (m["p"] - m["prev"]) * 100
                    ch = f" {'▲' if d > 0 else '▼' if d < 0 else '▬'} {d:+.0f} pt"
                lab = m["label"] or "sì"
                ms.append(f"{lab} {m['p'] * 100:.0f}%{ch}")
            L.append(f"  - [{e['title']}]({e['url']}) (scade {e['end']}): {'; '.join(ms)}")
    return L


def final_md(final: dict, py_questions: list[str]) -> list[str]:
    L = ["## 🧭 Analisi del giorno"]
    if final.get("error"):
        L.append(f"_Chiamata finale non disponibile: {final['error']}_")
    for x in final.get("tesi_a_rischio") or []:
        L.append(f"- ⚠ **Tesi a rischio, {x.get('ticker')}**: «{x.get('news', '')}» — {x.get('perche', '')}")
    if final.get("collegamenti_podcast"):
        L += ["", "**Collegamenti podcast → titoli**"]
        L += [f"- **{x.get('ticker')}**: {x.get('collegamento', '')}" for x in final["collegamenti_podcast"]]
    if final.get("utili"):
        L += ["", "**Utili appena usciti**"]
        for x in final["utili"]:
            L.append(f"- **{x.get('ticker')}**")
            L += [f"  - {pt}" for pt in x.get("punti") or []]
    qs = list(dict.fromkeys(py_questions + list(final.get("domande_portfolio") or [])))
    if qs:
        L += ["", "**Domande sul portfolio**"] + [f"- {q}" for q in qs[:8]]
    if final.get("_tokens_in") is not None:
        L.append(f"\n_Chiamata finale: {final['_tokens_in']:,} token in / {final['_tokens_out']:,} out_")
    return L


def portfolio_md(cfg, port: dict) -> list[str]:
    L = ["## 📊 Portfolio"]
    wt = port["weights"]
    if wt["status"] == "ok":
        top = sorted(wt["w"].items(), key=lambda x: x[1], reverse=True)
        L.append(f"- **Pesi** " + ", ".join(f"{t} {v * 100:.0f}%" for t, v in top)
                 + f" · totale {wt['total_k']:,.0f}k€ · prime 3: {wt['top3'] * 100:.0f}% · Herfindahl {wt['hhi']:.2f}")
    else:
        L.append(f"- **Pesi** {wt['status']} (le esposizioni sotto contano le posizioni, non i soldi)")
    for dim, label in (("settore", "Settore"), ("paese", "Paese"), ("valuta", "Valuta")):
        ex = port["exposures"][dim]
        tot = sum(ex.values()) or 1
        L.append(f"- **{label}** " + ", ".join(f"{k} {v / tot * 100:.0f}%" for k, v in sorted(ex.items(), key=lambda x: -x[1])))
    pairs = sorted(port["corr"]["pairs"].items(), key=lambda x: -abs(x[1][0]))
    port_t = {p.ticker for p in cfg.positions if p.tipo == "portfolio"}
    mine = [(k, v) for k, v in pairs if k[0] in port_t and k[1] in port_t]
    if mine:
        L.append(f"- **Correlazioni a {port['corr']['days']} giorni (portfolio)** " +
                 ", ".join(f"{a}/{b} {r:+.2f}" for (a, b), (r, n) in mine))
    strong = [(k, v) for k, v in pairs if abs(v[0]) >= 0.7][:6]
    if strong:
        L.append("- **Coppie più correlate (portfolio e watchlist)** " +
                 ", ".join(f"{a}/{b} {r:+.2f}" for (a, b), (r, n) in strong))
    if port["corr"]["errors"]:
        L.append(f"- _Correlazioni non calcolate per: {'; '.join(port['corr']['errors'])}_")
    if port["touched"]:
        L.append("- **Toccati dai temi del giorno** " + "; ".join(f"{t}: {', '.join(v)}" for t, v in port["touched"].items()))
    return L


def changes_md(cur: dict, morning: dict | None) -> list[str]:
    """Sera: cosa è cambiato rispetto al run della mattina."""
    if not morning:
        return ["_Nessun run della mattina oggi: niente confronto._"]
    L = []
    for t, x in cur["tickers"].items():
        m = morning["tickers"].get(t) or {}
        if x.get("price") and m.get("price"):
            ch = (x["price"] / m["price"] - 1) * 100
            if abs(ch) >= 1:
                L.append(f"- **{t}** {'▲' if ch > 0 else '▼'} {ch:+.1f}% dalla mattina")
        if x.get("news") is not None and m.get("news") is not None and x["news"] - m["news"] >= 5:
            L.append(f"- **{t}** {x['news'] - m['news']} news in più dalla mattina")
        if x.get("banks_dir") and m.get("banks_dir") and x["banks_dir"] != m["banks_dir"]:
            L.append(f"- **{t}** consenso banche: da «{m['banks_dir']}» a «{x['banks_dir']}»")
    if cur.get("fg") is not None and morning.get("fg") is not None and abs(cur["fg"] - morning["fg"]) >= 2:
        L.append(f"- **Fear & Greed** da {morning['fg']:.0f} a {cur['fg']:.0f}")
    for mid, p in (cur.get("poly") or {}).items():
        q = (morning.get("poly") or {}).get(mid)
        if q is not None and abs(p["p"] - q) >= 0.03:
            L.append(f"- **Polymarket** {p['title']}: da {q * 100:.0f}% a {p['p'] * 100:.0f}%")
    return L or ["_Nessun cambiamento rilevante rispetto alla mattina._"]


def snapshot(ctx: dict) -> dict:
    out = {"tickers": {}, "fg": None, "poly": {}}
    for t, n in ctx["news"].items():
        d = ((n.get("price") or {}).get("data")) or {}
        items = (n.get("news") or {}).get("data")
        out["tickers"][t] = {"price": d.get("last"), "news": len(items) if items is not None else None,
                             "banks_dir": ((n.get("banks") or {}).get("consensus") or {}).get("direction")}
    fg = ctx["market"]["fg"]
    if fg["status"] == "ok":
        out["fg"] = fg["data"]["score"]
    if ctx["polymarket"]["status"] == "ok":
        for g in ctx["polymarket"]["data"]:
            for e in g["events"]:
                for m in e["markets"]:
                    out["poly"][m["id"]] = {"p": m["p"], "title": f"{e['title']} {m['label']}".strip()}
    return out


def render(cfg, ctx: dict) -> str:
    from intel.cli import render_bubble_trend, render_episode_md

    names = {p.ticker: p.nome for p in cfg.positions}
    L = [f"# Market Intel — {ctx['date']:%d/%m/%Y}, {ctx['slot']}",
         "_Non è un sistema di trading: segnali con direzione, data e fonte; la decisione è tua._"]
    b = banner(ctx["earnings"], names)
    if b:
        L += ["", "> 📅 " + "  \n> 📅 ".join(b)]
    if ctx["slot"] == "sera":
        L += ["", "## 🔄 Cosa è cambiato rispetto alla mattina"] + changes_md(ctx["snapshot"], ctx.get("morning"))

    L += ["", "## 🎙️ Podcast Black Box"]
    trend = render_bubble_trend(ctx["state"])
    if trend:
        L += ["", trend]
    for ep in sorted(ctx["episodes"], key=lambda e: e["slot"] != "sera"):  # la sera in evidenza, prima
        L += ["", render_episode_md(ep)]
    if not ctx["episodes"]:
        L.append(ctx.get("podcast_note") or "_Nessuna puntata disponibile._")
    elif ctx.get("podcast_note"):
        L += ["", ctx["podcast_note"]]

    for tipo, label in (("portfolio", "📁 Portfolio"), ("watchlist", "👀 Watchlist")):
        L += ["", f"## {label}", "_▲ rialzista · ▼ ribassista · ▬ neutro. Dettagli e fonti più sotto._", ""]
        L += table(cfg, tipo, ctx)

    L += ["", "## 🌡️ Mercato", ""] + render_market(ctx["market"]) + polymarket_md(ctx["polymarket"])
    L += ["", *final_md(ctx["final"], ctx["portfolio"]["questions"])]

    L += ["", "## 🔎 Dettaglio per titolo"]
    for p in cfg.positions:
        n = ctx["news"].get(p.ticker)
        if not n:
            continue
        L += [""] + news_detail(n)
        r = ctx["retail"].get(p.ticker)
        if r:
            rd = retail_detail(r)
            if rd:
                L += ["- **Retail**"] + rd
        L += positioning_detail(ctx["positioning"].get(p.ticker))
        e = ctx["earnings"].get(p.ticker) or {}
        if e.get("status") == "ok" and e.get("next_any"):
            n_ = e["next_any"]
            L.append(f"- **Prossimi utili** {n_['date']:%d/%m/%Y} ({'stimata' if n_.get('estimated') else 'confermata'}, "
                     f"{n_['source']})" + (f" · ultimo trimestre {e['last_quarter']}: EPS {e['last_eps']} vs atteso "
                                           f"{e['last_eps_est']}" if e.get("last_eps") is not None else ""))

    L += ["", *portfolio_md(cfg, ctx["portfolio"])]
    L += ["", "## 📚 Fonti e costi", *ctx["sources_md"]]
    return "\n".join(L)
