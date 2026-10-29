"""Run completo di uno slot: tutti i moduli, al massimo 2 chiamate LLM, digest in Markdown/HTML/Notion."""
from __future__ import annotations

import csv
import time
from datetime import datetime
from zoneinfo import ZoneInfo

from intel import llm


def _cached_episode(cfg, state, ep) -> dict | None:
    """Puntata dell'altro slot: solo se già in cache (mai una terza chiamata LLM)."""
    c = state.get_episode(ep.guid)
    if not c:
        return None
    return {"title": ep.title, "slot": ep.slot, "published": ep.published, "link": ep.link or ep.audio_url, "method": "",
            "tried": [], "transcript_status": "ok", "summary": {**c["summary"], "_cached": True},
            "names": {p.ticker: p.nome for p in cfg.positions}}


def episodes_for(cfg, state, slot: str, tz, wait: bool) -> tuple[list[dict], str]:
    from collectors.podcast import discover_feed, fetch_episodes
    from intel.cli import _wait_for_episode, process_episode

    note = ""
    ep = _wait_for_episode(cfg, state, slot, tz) if wait else None
    f = discover_feed(cfg, state)
    feed = fetch_episodes(cfg, f["data"], limit=6)["data"] if f["status"] == "ok" else []
    today = datetime.now(tz).date()
    if not ep:
        ep = next((e for e in feed or [] if e.slot == slot and e.published.astimezone(tz).date() == today), None)
    out = []
    if ep:
        out.append(process_episode(cfg, state, ep))
    else:
        note = f"_Puntata {slot} di oggi non ancora disponibile" + \
               (f" dopo {cfg.section('podcast').get('max_wait_minutes', 120)} minuti di attesa._" if wait else "._")
    other = "mattina" if slot == "sera" else "sera"
    prev = next((e for e in feed or [] if e.slot == other), None)
    if prev:
        c = _cached_episode(cfg, state, prev)
        if c:
            out.append(c)
        else:
            note += f"\n_Puntata {other} «{prev.title}» non ancora sintetizzata: esce nel suo run._"
    # se manca la puntata di oggi, mostra l'ultima dello stesso slot già in cache
    if not ep:
        last_same = next((e for e in feed or [] if e.slot == slot), None)
        c = _cached_episode(cfg, state, last_same) if last_same else None
        if c:
            out.append(c)
            note += f"\n_Mostro l'ultima puntata {slot} già elaborata ({last_same.published:%d/%m})._"
    return out, note.strip()


def _tokens_since(path, since: datetime) -> tuple[int, int, int]:
    if not path.exists():
        return 0, 0, 0
    calls = tin = tout = 0
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if datetime.fromisoformat(row["timestamp"]) >= since:
                calls += 1
                tin += int(row["tokens_in"])
                tout += int(row["tokens_out"])
    return calls, tin, tout


def _sources_md(ctx: dict, run_calls: tuple[int, int, int], week: dict, elapsed: float) -> list[str]:
    bad = []

    def chk(name, res):
        if res and res.get("status") not in (None, "ok") and "ETF" not in res.get("status", ""):
            bad.append(f"{name}: {res['status']}")

    for t, n in ctx["news"].items():
        chk(f"prezzo {t}", n.get("price"))
        chk(f"news {t}", n.get("news"))
    for t, x in ctx["positioning"].items():
        for k in ("insiders", "short_interest", "holders", "eu_shorts", "cot"):
            chk(f"{k} {t}", x.get(k))
    for k, v in ctx["market"].items():
        chk(k, v)
    chk("Polymarket", ctx["polymarket"])
    for s, f in (ctx.get("reddit_feeds") or {}).items():
        chk(f"Reddit r/{s}", f)
    calls, tin, tout = run_calls
    L = ["- **Fonti usate** Black Box (feed Megaphone, sottotitoli YouTube) · Yahoo Finance (prezzi, analisti, "
         "utili) · Google News RSS · ApeWisdom · StockTwits · Reddit RSS · ariva.de · CNN Fear & Greed · CBOE · "
         "xoomar (Form 4, FINRA, 13D/13G) · Consob, BaFin, AFM · CFTC · Polymarket. Ogni dato ha il suo link nel testo.",
         f"- **Token di questo run** {calls} chiamate LLM, {tin:,} in / {tout:,} out",
         f"- **Token ultimi 7 giorni** {week['calls']} chiamate, {week['tokens_in']:,} in, {week['tokens_out']:,} out "
         f"(equivalente API ${week['cost_usd_equiv']:.3f})",
         f"- **Durata del run** {elapsed / 60:.0f} minuti"]
    if bad:
        L += ["- **Non disponibili in questo run**"] + [f"  - {b}" for b in bad[:40]]
    return L


def build(cfg, state, slot: str, wait: bool = True) -> tuple[str, dict]:
    from analysis import earnings as E
    from analysis import final as F
    from analysis import portfolio as PF
    from analysis import positioning as PO
    from analysis import retail as R
    from analysis.tickers import analyze_all
    from collectors import polymarket as PM
    from report import digest as D

    t0, started = time.monotonic(), datetime.now()
    tz = ZoneInfo(cfg.raw.get("timezone", "Europe/Rome"))
    eps, note = episodes_for(cfg, state, slot, tz, wait)            # chiamata LLM 1 (se non in cache)
    news = {r["ticker"]: r for r in analyze_all(cfg, state)}        # Modulo 2
    ret = R.collect(cfg, state)                                     # Modulo 3
    pos = PO.collect(cfg, state)                                    # Modulo 4
    print("… Polymarket", flush=True)
    pm = PM.collect(cfg, state)                                     # Modulo 5
    earn = E.collect(cfg)                                           # Modulo 6
    port = PF.collect(cfg, news, earn["profiles"], eps)             # Modulo 7
    print("… chiamata finale", flush=True)
    retail_rows = {r["ticker"]: r for r in ret["rows"]}
    final = F.call(cfg, F.build(cfg, news, retail_rows, pos, earn["rows"], eps, port))  # chiamata LLM 2

    ctx = {"date": datetime.now(tz).date(), "slot": slot, "state": state, "episodes": eps, "podcast_note": note,
           "news": news, "retail": retail_rows, "reddit_feeds": ret["feeds"], "market": ret["market"],
           "positioning": pos, "polymarket": pm, "earnings": earn["rows"], "portfolio": port, "final": final}
    snap = D.snapshot(ctx)
    ctx["snapshot"] = snap
    ctx["morning"] = state.get(f"snapshot.{ctx['date']}.mattina") if slot == "sera" else None
    state.set(f"snapshot.{ctx['date']}.{slot}", snap)
    ctx["sources_md"] = _sources_md(ctx, _tokens_since(cfg.logs_dir / "tokens.csv", started),
                                    llm.weekly_totals(cfg.logs_dir / "tokens.csv"), time.monotonic() - t0)
    return D.render(cfg, ctx), ctx
