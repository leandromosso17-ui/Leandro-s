"""Digest: HTML locale (stile terminale, sfondo nero) e Markdown per Notion, dagli stessi dati.

Ordine: puntate (la più recente prima: tesi, sintesi, opportunità) · i tuoi asset | bolla AI ·
portfolio · watchlist · Polymarket collegato ai titoli. A destra: calendario utili e mercato.
"""
from __future__ import annotations

import calendar
import html
from datetime import date, timedelta

RATING_SHORT = {"overweight": "OW", "underweight": "UW", "equal-weight": "EW", "equal weight": "EW",
                "outperform": "OP", "underperform": "UP", "market perform": "MP", "sector perform": "SP",
                "sector outperform": "SO", "market outperform": "MO", "strong buy": "Strong Buy",
                "neutral": "Neutral", "buy": "Buy", "hold": "Hold", "sell": "Sell", "peer perform": "PP"}
CUR = {"USD": "$", "EUR": "€", "GBP": "£", "GBp": "p"}
DIR = {"più rialzista": "▲", "più ribassista": "▼", "stabile": "▬"}
SLOT = {"sera": "SERA", "mattina": "MATTINA"}
MESI = ["", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto",
        "Settembre", "Ottobre", "Novembre", "Dicembre"]


def esc(s) -> str:
    return html.escape(str(s if s is not None else ""), quote=True)


# --- dati già pronti per entrambe le uscite -------------------------------------

def price(n: dict) -> dict | None:
    p = n.get("price") or {}
    return p["data"] if p.get("status") == "ok" else None


def fmt_px(d: dict) -> str:
    v, c = d["last"], CUR.get(d.get("currency", ""), d.get("currency", ""))
    return f"{v:,.2f} {c}" if v < 10000 else f"{v:,.0f} {c}"


def fmt_chg(v) -> tuple[str, str]:
    if v is None:
        return "n.d.", "flat"
    return f"{v:+.1f}%", "up" if v > 0 else "down" if v < 0 else "flat"


def news_counts(n: dict) -> tuple[int, int, int] | None:
    nw = n.get("news") or {}
    if nw.get("status") != "ok" or n.get("sentiment_error"):
        return None
    items = nw["data"] or []
    return (sum(1 for i in items if i.get("sentiment") == "positive"),
            sum(1 for i in items if i.get("sentiment") == "negative"), len(items))


def banks(n: dict, short: dict, cur: str) -> list[dict]:
    """Le banche principali con rating, target e direzione nel tempo."""
    b = n.get("banks") or {}
    if b.get("status") != "ok":
        return []
    out = []
    rs = lambda r: RATING_SHORT.get((r or "").strip().lower(), (r or "").strip())
    for t in b.get("top") or []:
        from analysis.banks import grade_score
        tl = t.get("timeline") or [t["current"]]
        now, prev = tl[-1], (tl[-2] if len(tl) > 1 else None)
        if prev and prev.get("pt") == now.get("pt") and grade_score(prev.get("rating")) == grade_score(now.get("rating")):
            prev = None  # stesso giudizio scritto diverso (Hold/Neutral): non è un cambio
        item = {"bank": short.get(t["bank"], t["bank"]), "rating": rs(now.get("rating")),
                "pt": f"{now['pt']:,.0f}{cur}" if now.get("pt") else "", "dir": DIR.get(t["direction"], ""),
                # data in cui la banca ha fissato questo target/rating (non l'ultima conferma)
                "date": now["date"], "link": t["current"].get("link"), "prev": None}
        if prev:
            chg = (now["pt"] / prev["pt"] - 1) * 100 if now.get("pt") and prev.get("pt") else None
            item["prev"] = {"pt": f"{prev['pt']:,.0f}{cur}" if prev.get("pt") else "", "date": prev["date"],
                            "rating": rs(prev.get("rating")) if rs(prev.get("rating")) != item["rating"] else "",
                            "chg": chg}
        out.append(item)
    return out


def bank_text(b: dict) -> str:
    """«JPM OW 160$ (29.10) ← 150$ (23.07) +6.7%»"""
    s = f"{b['bank']} {b['rating']} {b['pt']}".replace("  ", " ").strip() + f" ({b['date']:%d.%m.%y})"
    p = b.get("prev")
    if p:
        old = " ".join(x for x in (p["rating"], p["pt"]) if x) or "–"
        s += f" ← {old} ({p['date']:%d.%m.%y})" + (f" {p['chg']:+.1f}%" if p["chg"] is not None else "")
    return s


def earnings_cell(e: dict) -> tuple[str, str]:
    if not e or e.get("status") != "ok":
        return "–", ""
    n = e.get("next_any")
    today = date.today()
    if e.get("reported_on") and 0 <= (today - e["reported_on"]).days <= 3:
        return f"uscito {e['reported_on']:%d.%m}", "past"
    if n and n["date"] >= today:
        return f"{n['date']:%d.%m}", "est" if n.get("estimated") else "conf"
    return "–", ""


def calendar_events(cfg, earnings: dict) -> dict[date, list[tuple[str, str]]]:
    ev: dict[date, list[tuple[str, str]]] = {}
    for p in cfg.positions:
        e = earnings.get(p.ticker) or {}
        if e.get("status") != "ok":
            continue
        if e.get("reported_on"):
            ev.setdefault(e["reported_on"], []).append((p.ticker, "past"))
        n = e.get("next_any")
        if n and n["date"] != e.get("reported_on"):
            ev.setdefault(n["date"], []).append((p.ticker, "est" if n.get("estimated") else "conf"))
    return ev


def months_to_show(today: date) -> list[tuple[int, int]]:
    """Il mese corrente; dalla seconda metà del mese anche il successivo (gli utili in arrivo sono lì)."""
    out = [(today.year, today.month)]
    if today.day >= 15:
        nxt = (today.replace(day=28) + timedelta(days=4))
        out.append((nxt.year, nxt.month))
    return out


def assets_mentions(eps: list[dict]) -> list[tuple[str, list[tuple[str, list[str]]]]]:
    """{ticker: [(slot, concetti)]} dalle puntate mostrate, in ordine di prima citazione."""
    out: dict[str, list[tuple[str, list[str]]]] = {}
    for ep in eps:
        for a in (ep.get("summary") or {}).get("tuoi_asset") or []:
            if a.get("concetti"):
                out.setdefault(a.get("ticker", ""), []).append((ep["slot"], a["concetti"]))
    return list(out.items())


def bubble(ep: dict) -> dict | None:
    b = (ep.get("summary") or {}).get("bolla_ai") or {}
    if not b:
        return None
    strip = lambda xs: [x.get("concetto", "") if isinstance(x, dict) else str(x) for x in xs or []][:2]
    return {"level": b.get("livello_allarme", "n.d."), "text": b.get("sintesi") or b.get("come_la_descrivono", ""),
            "burst": strip(b.get("segnali_di_scoppio")), "hold": strip(b.get("segnali_di_tenuta"))}


def bubble_trend(state, n: int = 8) -> list[tuple[str, str]]:
    out = []
    for e in state.recent_episodes(n):
        lv = (e["summary"].get("bolla_ai") or {}).get("livello_allarme")
        if lv:
            out.append((f"{e['published'][8:10]}.{e['published'][5:7]} {'S' if e['slot'] == 'sera' else 'M'}", lv))
    return out


def poly_rows(pm: dict) -> list[dict]:
    if pm.get("status") != "ok":
        return []
    rows = []
    for e in pm["data"]:
        outcomes = []
        for m in e["markets"]:
            d = None if m.get("prev") is None else round((m["p"] - m["prev"]) * 100)
            outcomes.append({"label": m["label"] or "Sì", "p": round(m["p"] * 100), "d": d})
        rows.append({"title": e["title"], "url": e["url"], "end": e["end"], "tickers": e["tickers"],
                     "why": e.get("why", ""), "outcomes": outcomes})
    return rows


# --- HTML --------------------------------------------------------------------------

CSS = """
:root{--bg:#000;--panel:#0b0b0b;--line:#1f1f1f;--fg:#d6d6d6;--dim:#7c7c7c;--amber:#ffa028;
      --up:#3ddc84;--down:#ff5b4f;--conf:#ffa028;--est:#7c7c7c;--past:#3a3a3a}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--fg)}
body{font:14px/1.55 "Segoe UI",system-ui,-apple-system,sans-serif}
.mono,table,.cal,.mk{font-family:Consolas,"Cascadia Mono","SF Mono",Menlo,monospace}
a{color:inherit;text-decoration:none;border-bottom:1px dotted var(--dim)}a:hover{color:var(--amber)}
header{display:flex;align-items:baseline;gap:16px;padding:18px 24px;border-bottom:1px solid var(--amber)}
header h1{margin:0;font:600 20px/1 Consolas,monospace;letter-spacing:.18em;color:var(--amber)}
header .date{font:14px Consolas,monospace;color:var(--dim)}
.wrap{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:24px;padding:20px 24px 48px;max-width:1400px;margin:0 auto}
@media(max-width:980px){.wrap{grid-template-columns:minmax(0,1fr)}aside{order:-1}}
.k{font:600 11px Consolas,monospace;letter-spacing:.16em;color:var(--amber);text-transform:uppercase;margin:0 0 6px}
section{background:var(--panel);border:1px solid var(--line);padding:16px 18px;margin:0 0 16px}
h2{margin:0 0 10px;font-size:17px;font-weight:600;color:#fff}
.tesi{color:#fff;border-left:2px solid var(--amber);padding-left:10px;margin:0 0 12px}
ul{margin:6px 0;padding-left:18px}li{margin:3px 0}li::marker{color:var(--dim)}
.opp{margin-top:12px;padding-top:10px;border-top:1px dashed var(--line)}
.opp b{color:#fff}.note{color:var(--dim);font-size:12px;margin-top:8px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:760px){.two{grid-template-columns:1fr}}
.two section{margin:0}.tag{font:11px Consolas,monospace;color:var(--dim);margin-left:6px}
.assets{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px 20px}
.lvl{font:600 12px Consolas,monospace;padding:1px 6px;border:1px solid}
.lvl.alto{color:var(--down)}.lvl.medio{color:var(--amber)}.lvl.basso,.lvl.nessuno{color:var(--up)}
.trend{font:12px Consolas,monospace;color:var(--dim);margin:6px 0 10px}
.sig{display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px}.sig div>span{font:11px Consolas,monospace;letter-spacing:.1em}
.tw{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:13px}
th{font-weight:400;color:var(--dim);text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);font-size:11px;letter-spacing:.08em;text-transform:uppercase}
td{padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:top;white-space:nowrap}
tr:last-child td{border-bottom:0}td.n{text-align:right}td.bk{white-space:normal;min-width:260px}
.t{color:#fff;font-weight:600}.sub{display:block;color:var(--dim);font-size:11px;font-family:"Segoe UI",sans-serif}
.up{color:var(--up)}.down{color:var(--down)}.flat{color:var(--dim)}
.b{margin:0 0 3px;white-space:nowrap}.b i{font-style:normal;color:var(--dim)}.b .pt{color:#fff;font-weight:600}.dt{color:var(--dim);font-size:11px}
.conf{color:var(--conf)}.est{color:var(--est)}.past{color:#5a5a5a}
aside{min-width:0}@media(max-width:980px){aside{max-width:420px}}
.cal{width:100%;table-layout:fixed;font-size:12px;margin-bottom:14px}.cal th{text-align:center;padding:3px 0;text-transform:none;letter-spacing:0}
.cal td{height:42px;padding:2px 3px;border:1px solid var(--line);vertical-align:top;white-space:normal;overflow:hidden}
.chip{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cal .d{color:var(--dim);font-size:10px}.cal .today{outline:1px solid var(--amber)}.cal .off{background:#050505}
.chip{display:block;font-size:10px;line-height:1.3}.chip.conf{color:#000;background:var(--conf);padding:0 2px}
.chip.est{border:1px dashed var(--est);padding:0 2px}.chip.past{color:#666;text-decoration:line-through}
.legend{font-size:11px;color:var(--dim);margin-top:-6px}
.mk{font-size:12px}.mk div{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--line)}
.poly td{white-space:normal}.pct{font:600 13px Consolas,monospace;color:#fff}
footer{color:var(--dim);font:11px Consolas,monospace;margin-top:8px}footer details{margin-top:4px}
"""


def _chg_td(v) -> str:
    s, c = fmt_chg(v)
    return f'<td class="n {c}">{s}</td>'


def h_episode(ep: dict) -> str:
    s = ep.get("summary") or {}
    out = [f'<section><p class="k">{SLOT.get(ep["slot"], ep["slot"])} · Black Box</p>',
           f'<h2>{esc(ep["title"].split(" | ")[0])}</h2>' if not ep.get("link") else
           f'<h2><a href="{esc(ep["link"])}">{esc(ep["title"].split(" | ")[0])}</a></h2>']
    if ep.get("summary_error") or not s.get("sintesi"):
        out.append(f'<p class="note">Sintesi non disponibile{": " + esc(ep.get("summary_error")) if ep.get("summary_error") else ""}</p>')
    if s.get("tesi_centrale"):
        out.append(f'<p class="tesi">{esc(s["tesi_centrale"])}</p>')
    if s.get("sintesi"):
        out.append("<ul>" + "".join(f"<li>{esc(x)}</li>" for x in s["sintesi"]) + "</ul>")
    if s.get("opportunita"):
        out.append('<div class="opp"><p class="k">Opportunità · keep an eye on</p><ul>' + "".join(
            f'<li><b>{esc(o.get("idea", ""))}</b> — {esc(o.get("cosa_dicono", ""))}</li>' for o in s["opportunita"]) + "</ul></div>")
    if s.get("dubbi_importanti"):
        out.append('<p class="note">⚠ ' + " · ".join(esc(x) for x in s["dubbi_importanti"]) + "</p>")
    return "".join(out) + "</section>"


def h_assets(eps: list[dict], names: dict) -> str:
    items = assets_mentions(eps)
    # in orizzontale: un riquadro per titolo citato, affiancati
    body = "".join(
        f'<div class="asset"><p style="margin:0 0 2px"><span class="t">{esc(names.get(t, t))}</span><span class="tag">{esc(t)} · '
        f'{" + ".join(SLOT.get(sl, sl).lower() for sl, _ in hits)}</span></p>'
        f'<ul>{"".join(f"<li>{esc(c)}</li>" for _, cs in hits for c in cs)}</ul></div>' for t, hits in items)
    return ('<section><p class="k">I tuoi asset nel podcast</p>'
            + (f'<div class="assets">{body}</div>' if body else
               '<p class="note">Nessuno dei tuoi titoli citato nelle puntate mostrate.</p>') + "</section>")


def h_bubble(eps: list[dict]) -> str:
    out = ['<section><p class="k">Bolla AI · cosa dicono gli host</p>']
    for ep in eps:
        b = bubble(ep)
        if not b:
            continue
        out.append(f'<p style="margin:8px 0 4px"><span class="tag" style="margin:0">{SLOT.get(ep["slot"], "")}</span> '
                   f'<span class="lvl {esc(b["level"])}">allarme {esc(b["level"])}</span></p><p style="margin:0 0 6px">{esc(b["text"])}</p>')
        if b["burst"] or b["hold"]:
            out.append('<div class="sig"><div><span class="down">SEGNALI DI SCOPPIO</span><ul>'
                       + "".join(f"<li>{esc(x)}</li>" for x in b["burst"]) + '</ul></div><div><span class="up">SEGNALI DI TENUTA</span><ul>'
                       + "".join(f"<li>{esc(x)}</li>" for x in b["hold"]) + "</ul></div></div>")
    return "".join(out) + "</section>"


def h_table(cfg, tipo: str, ctx: dict, short: dict) -> str:
    rows = []
    for p in cfg.positions:
        if p.tipo != tipo:
            continue
        n = ctx["news"].get(p.ticker) or {}
        d = price(n) or {}
        cur = CUR.get(d.get("currency", ""), "")
        e_txt, e_cls = earnings_cell(ctx["earnings"].get(p.ticker))
        lines = []
        for b in banks(n, short, cur):
            cls = "up" if b["dir"] == "▲" else "down" if b["dir"] == "▼" else "flat"
            head = (f'<span class="t">{esc(b["bank"])}</span> <i>{esc(b["rating"])}</i>'
                    + (f' <b class="pt">{esc(b["pt"])}</b>' if b["pt"] else "") + f' <span class="dt">{b["date"]:%d.%m.%y}</span>')
            p_ = b.get("prev")
            tail = ""
            if p_:
                old = " ".join(x for x in (p_["rating"], p_["pt"]) if x) or "–"
                tail = (f' <span class="dt">← {esc(old)} {p_["date"]:%d.%m.%y}</span>'
                        + (f' <span class="{cls}">{p_["chg"]:+.1f}%</span>' if p_["chg"] is not None else f' <span class="{cls}">{b["dir"]}</span>'))
            lines.append(f'<div class="b">{head}{tail}</div>')
        bank_html = "".join(lines) or '<span class="flat">–</span>'
        chgs = "".join(_chg_td(d.get(k)) for k in ("chg_1d", "chg_5d", "chg_1m", "chg_6m", "chg_1y"))
        rows.append(f'<tr><td><span class="t">{esc(p.ticker)}</span><span class="sub">{esc(p.nome)}</span></td>'
                    f'<td class="n">{esc(fmt_px(d)) if d else "n.d."}</td>{chgs}'
                    f'<td class="{e_cls}">{esc(e_txt)}</td><td class="bk">{bank_html}</td></tr>')
    label = "Portfolio" if tipo == "portfolio" else "Watchlist"
    return (f'<section><p class="k">{label}</p><div class="tw"><table><thead><tr><th>Titolo</th><th>Prezzo</th><th>1g</th>'
            f'<th>5g</th><th>1m</th><th>6m</th><th>1a</th><th>Utili</th>'
            f'<th>Banche · rating · target (data) ← precedente</th></tr></thead><tbody>'
            + "".join(rows) + "</tbody></table></div></section>")


def h_poly(ctx: dict) -> str:
    rows = poly_rows(ctx["polymarket"])
    if not rows:
        return ('<section><p class="k">Polymarket</p><p class="note">'
                + ("Nessun mercato collegato ai tuoi titoli oggi." if ctx["polymarket"].get("status") == "ok"
                   else esc(ctx["polymarket"].get("status"))) + "</p></section>")
    body = []
    for r in rows:
        outs = " &nbsp; ".join(
            f'{esc(o["label"])} <span class="pct">{o["p"]}%</span>'
            + ("" if not o["d"] else f' <span class="{"up" if o["d"] > 0 else "down"}">{o["d"]:+d}</span>') for o in r["outcomes"])
        who = "tutti" if r["tickers"] == ["tutti"] else ", ".join(r["tickers"])
        body.append(f'<tr><td><a href="{esc(r["url"])}">{esc(r["title"])}</a><span class="sub">scade {esc(r["end"])}</span></td>'
                    f'<td>{outs}</td><td><span class="t">{esc(who)}</span><span class="sub">{esc(r["why"])}</span></td></tr>')
    return ('<section class="poly"><p class="k">Polymarket · solo mercati che toccano i tuoi titoli</p><div class="tw"><table>'
            '<thead><tr><th>Mercato</th><th>Probabilità · Δ dal run prima (punti)</th><th>Tocca</th></tr></thead><tbody>'
            + "".join(body) + "</tbody></table></div></section>")


def h_calendar(cfg, ctx: dict) -> str:
    ev = calendar_events(cfg, ctx["earnings"])
    today = ctx["date"]
    out = []
    for y, m in months_to_show(today):
        weeks = calendar.Calendar(firstweekday=0).monthdatescalendar(y, m)
        cells = []
        for w in weeks:
            tds = []
            for d in w:
                cls = "off" if d.month != m else ("today" if d == today else "")
                chips = "".join(f'<span class="chip {c}">{esc(t)}</span>' for t, c in ev.get(d, []) if d.month == m)
                tds.append(f'<td class="{cls}"><span class="d">{d.day if d.month == m else ""}</span>{chips}</td>')
            cells.append("<tr>" + "".join(tds) + "</tr>")
        out.append(f'<p class="k">Utili · {MESI[m]} {y}</p><table class="cal"><thead><tr>'
                   + "".join(f"<th>{x}</th>" for x in "LMMGVSD") + "</tr></thead><tbody>" + "".join(cells) + "</tbody></table>")
    out.append('<p class="legend"><span class="chip conf" style="display:inline">conf.</span> confermata · '
               '<span class="chip est" style="display:inline">stim.</span> stimata · <span class="past">uscita</span></p>')
    return "".join(out)


def h_market(ctx: dict) -> str:
    m = ctx["market"]
    rows = []
    fg = m.get("fg") or {}
    if fg.get("status") == "ok":
        d = fg["data"]
        rows.append(("Fear &amp; Greed", f'{d["score"]:.0f} · {esc(d["rating"])}', d["score"] - (d.get("prev_week") or d["score"])))
    v = m.get("vix") or {}
    if v.get("status") == "ok":
        rows.append(("VIX", f'{v["data"]["last"]:.2f}', -v["data"]["chg_1d"]))
    pc = m.get("putcall") or {}
    if pc.get("status") == "ok":
        d = pc["data"]
        rows.append(("Put/call", f'{d["total"]:.2f}', (d.get("prev_total") or d["total"]) - d["total"]))
    body = "".join(f'<div><span>{k}</span><span class="{"up" if x > 0 else "down" if x < 0 else "flat"}">{val}</span></div>'
                   for k, val, x in rows)
    return f'<p class="k">Mercato</p><div class="mk">{body or "n.d."}</div>'


def render_html(cfg, ctx: dict) -> str:
    names = {p.ticker: p.nome for p in cfg.positions}
    short = {b["nome"]: b.get("breve", b["nome"]) for b in cfg.raw.get("banche") or []}
    eps = ctx["episodes"]
    f = ctx["footer"]
    main = "".join(h_episode(e) for e in eps)
    if ctx.get("podcast_note"):
        main += f'<p class="note">{esc(ctx["podcast_note"])}</p>'
    main += h_assets(eps, names) + h_bubble(eps)
    main += h_table(cfg, "portfolio", ctx, short) + h_table(cfg, "watchlist", ctx, short) + h_poly(ctx)
    unav = f["unavailable"]
    main += (f'<footer>{f["calls"]} chiamate LLM · {f["tin"]:,} in / {f["tout"]:,} out · settimana {f["week"]["tokens_in"]:,} in / '
             f'{f["week"]["tokens_out"]:,} out · {f["minutes"]:.0f} min · non è un sistema di trading'
             + (f'<details><summary>{len(unav)} dati non disponibili</summary>{"<br>".join(esc(x) for x in unav)}</details>' if unav else "")
             + "</footer>")
    aside = h_calendar(cfg, ctx) + h_market(ctx)
    return (f'<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
            f'<title>Market Intel {ctx["date"]:%d.%m.%Y}</title><style>{CSS}</style></head><body>'
            f'<header><h1>MARKET INTEL</h1><span class="date">{ctx["date"]:%d.%m.%Y}</span></header>'
            f'<div class="wrap"><main>{main}</main><aside>{aside}</aside></div></body></html>')


# --- Markdown (Notion e archivio) -----------------------------------------------------

def render_md(cfg, ctx: dict) -> str:
    names = {p.ticker: p.nome for p in cfg.positions}
    short = {b["nome"]: b.get("breve", b["nome"]) for b in cfg.raw.get("banche") or []}
    L = [f"# Market Intel — {ctx['date']:%d.%m.%Y}"]
    for ep in ctx["episodes"]:
        s = ep.get("summary") or {}
        L += ["", f"## {SLOT.get(ep['slot'], ep['slot'])} · {ep['title'].split(' | ')[0]}"]
        if s.get("tesi_centrale"):
            L.append(f"**{s['tesi_centrale']}**")
        L += [f"- {x}" for x in s.get("sintesi") or []]
        if s.get("opportunita"):
            L += ["", "**Opportunità · keep an eye on**"] + [f"- **{o.get('idea', '')}** — {o.get('cosa_dicono', '')}"
                                                           for o in s["opportunita"]]
        if s.get("dubbi_importanti"):
            L.append("_⚠ " + " · ".join(s["dubbi_importanti"]) + "_")
    if ctx.get("podcast_note"):
        L += ["", f"_{ctx['podcast_note']}_"]
    L += ["", "## I tuoi asset nel podcast"]
    items = assets_mentions(ctx["episodes"])
    for t, hits in items:
        L.append(f"- **{names.get(t, t)} ({t})** — {' + '.join(sl for sl, _ in hits)}")
        L += [f"  - {c}" for _, cs in hits for c in cs]
    if not items:
        L.append("_Nessuno dei tuoi titoli citato nelle puntate mostrate._")
    L += ["", "## Bolla AI"]
    for ep in ctx["episodes"]:
        b = bubble(ep)
        if b:
            L.append(f"- **{SLOT.get(ep['slot'], '')} · allarme {b['level']}** — {b['text']}")
    for tipo, label in (("portfolio", "Portfolio"), ("watchlist", "Watchlist")):
        L += ["", f"## {label}", "", "| Titolo | Prezzo | 1g | 5g | 1m | 6m | 1a | Utili | Banche |",
              "|---|---|---|---|---|---|---|---|---|"]
        for p in cfg.positions:
            if p.tipo != tipo:
                continue
            n = ctx["news"].get(p.ticker) or {}
            d = price(n) or {}
            cur = CUR.get(d.get("currency", ""), "")
            bk = " · ".join(bank_text(b) for b in banks(n, short, cur)) or "–"
            chgs = " | ".join(fmt_chg(d.get(k))[0] for k in ("chg_1d", "chg_5d", "chg_1m", "chg_6m", "chg_1y"))
            L.append(f"| **{p.ticker}** | {fmt_px(d) if d else 'n.d.'} | {chgs} | "
                     f"{earnings_cell(ctx['earnings'].get(p.ticker))[0]} | {bk} |")
    rows = poly_rows(ctx["polymarket"])
    if rows:
        L += ["", "## Polymarket", "", "| Mercato | Probabilità | Tocca |", "|---|---|---|"]
        for r in rows:
            outs = "; ".join(f"{o['label']} {o['p']}%" + (f" ({o['d']:+d})" if o["d"] else "") for o in r["outcomes"])
            L.append(f"| [{r['title']}]({r['url']}) | {outs} | {', '.join(r['tickers'])} ({r['why']}) |")
    ev = calendar_events(cfg, ctx["earnings"])
    months = months_to_show(ctx["date"])
    upcoming = sorted((d, t, c) for d, xs in ev.items() for t, c in xs if (d.year, d.month) in months)
    if upcoming:
        L += ["", "## Calendario utili"] + [
            f"- {d:%d.%m} **{t}** {'confermata' if c == 'conf' else 'stimata' if c == 'est' else 'uscita'}" for d, t, c in upcoming]
    f = ctx["footer"]
    L += ["", f"_{f['calls']} chiamate LLM · {f['tin']:,} in / {f['tout']:,} out · {f['minutes']:.0f} min · "
              f"{len(f['unavailable'])} dati non disponibili · non è un sistema di trading_"]
    return "\n".join(L)
