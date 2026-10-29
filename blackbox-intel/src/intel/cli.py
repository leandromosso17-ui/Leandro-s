"""CLI: uv run intel test-sources | podcast | run --slot mattina|sera | tokens"""
from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from intel import config, llm
from intel.state import State


def _utf8_stdout():
    # La console Windows non è UTF-8 di default.
    for s in (sys.stdout, sys.stderr):
        if hasattr(s, "reconfigure"):
            s.reconfigure(encoding="utf-8", errors="replace")


def cmd_test_sources(cfg, state, args):
    from collectors.sources_test import run_all
    print("Test delle fonti (chiamate reali):\n")
    rows = run_all(cfg, state, args.only)
    print("\n| Gruppo | Fonte | Funziona | Motivo |\n|---|---|---|---|")
    for g, n, ok, why in rows:
        print(f"| {g} | {n} | {'sì' if ok else 'no'} | {why.replace('|', '/')} |")
    print(f"\n{sum(r[2] for r in rows)}/{len(rows)} fonti funzionanti.")


def process_episode(cfg, state, ep) -> dict:
    from analysis.podcast import fix_names, link_tickers, summarize
    from collectors.podcast import get_transcript

    cached = state.get_episode(ep.guid)
    tr, method, tried = get_transcript(cfg, ep)
    out = {"title": ep.title, "slot": ep.slot, "published": ep.published, "link": ep.link,
           "method": method, "tried": tried, "transcript_status": tr["status"],
           "transcript_url": tr["source_url"], "names": {p.ticker: p.nome for p in cfg.positions}}
    if tr["status"] != "ok":
        if cached:  # trascrizione non più scaricabile ma sintesi già in cache
            out["summary"] = {**cached["summary"], "_cached": True, "_tokens_in": 0, "_tokens_out": 0}
        return out
    text = fix_names(cfg, tr["data"])
    out["transcript_chars"] = len(text)
    out["links"] = link_tickers(cfg, text)
    try:
        out["summary"] = summarize(cfg, state, ep, text, method)
    except llm.LLMError as e:
        out["summary_error"] = str(e)
    return out


def render_episode_md(r: dict) -> str:
    L = [f"### {'🌙 Sera' if r['slot'] == 'sera' else '☀️ Mattina'} — {r['title']}",
         f"_{r['published']:%d/%m/%Y %H:%M} · [puntata]({r['link']})_", ""]
    if r["transcript_status"] != "ok" and "summary" not in r:
        L.append(f"**Trascrizione non disponibile.** Tentativi: {'; '.join(r['tried'])}")
        return "\n".join(L)
    if r.get("method"):
        L.append(f"Trascrizione: **{r['method']}** ({r.get('transcript_chars', 0):,} caratteri dopo la pulizia)"
                 + (f" · scartati: {'; '.join(r['tried'])}" if r["tried"] else ""))
    s = r.get("summary") or {}
    if r.get("summary_error"):
        L.append(f"**Sintesi non disponibile:** {r['summary_error']}")
    if s.get("tesi_centrale"):
        L += ["", f"**Tesi centrale:** {s['tesi_centrale']}"]
    if s.get("sintesi"):
        L += ["", "**Sintesi**"] + [f"- {x}" for x in s["sintesi"]]
    names = r.get("names", {})
    assets = [a for a in s.get("tuoi_asset") or [] if a.get("concetti")]
    if assets:
        L += ["", "**🎯 I tuoi asset**"]
        for a in assets:
            t = a.get("ticker", "")
            ts = ", ".join(a.get("timestamp") or [])
            L += ["", f"**{names.get(t, t)} ({t})**" + (f" · {ts}" if ts else "")]
            L += [f"- {c}" for c in a.get("concetti") or []]
    elif s.get("_v"):
        L += ["", "**🎯 I tuoi asset:** non se ne parla in questa puntata."]
    if s.get("opportunita"):
        L += ["", "**💡 Opportunità / keep an eye on**"]
        for o in s["opportunita"]:
            ts = f" ({o['timestamp']})" if o.get("timestamp") else ""
            L.append(f"- **{o.get('idea', '')}**{ts}: {o.get('cosa_dicono', '')}")
    b = s.get("bolla_ai") or {}
    if b:
        L += ["", f"**🫧 Bolla AI — allarme degli ospiti: {b.get('livello_allarme', '?')}**"]
        if b.get("come_la_descrivono"):
            L.append(b["come_la_descrivono"])
        for label, key in (("Segnali di scoppio", "segnali_di_scoppio"), ("Segnali di tenuta", "segnali_di_tenuta")):
            if b.get(key):
                L += ["", f"_{label}_"] + [f"- ({x.get('timestamp', '')}) {x.get('concetto', '')}" for x in b[key]]
    # controllo incrociato senza token: nomi trovati nel testo dal Python
    direct = [k for k in r.get("links") or [] if k["tipo"] == "citato direttamente"]
    if direct:
        L += ["", "_Citati per nome nella trascrizione: " + "; ".join(
            f"{names.get(k['ticker'], k['ticker'])} a {', '.join(k['timestamp'])}" for k in direct) + "_"]
    if s.get("nomi_corretti"):
        L += ["", "_Nomi corretti rispetto ai sottotitoli: " + "; ".join(
            f"«{n.get('trascritto', '')}» → **{n.get('corretto', '')}** ({n.get('perche', '')})"
            for n in s["nomi_corretti"]) + "_"]
    if s.get("non_chiaro"):
        L += ["", "**Non chiaro / limiti:** " + "; ".join(s["non_chiaro"])]
    if s:
        L.append("")
        L.append("_Token: da cache, 0_" if s.get("_cached")
                 else f"_Token: {s.get('_tokens_in', 0):,} in / {s.get('_tokens_out', 0):,} out_")
    return "\n".join(L)


def render_bubble_trend(state, n: int = 10) -> str:
    """Andamento dell'allarme bolla AI nelle ultime puntate in cache (zero token)."""
    eps = [e for e in state.recent_episodes(n) if (e["summary"].get("bolla_ai") or {}).get("livello_allarme")]
    if not eps:
        return ""
    cells = [f"{datetime.fromisoformat(e['published']):%d/%m} {'sera' if e['slot'] == 'sera' else 'matt.'}: "
             f"**{e['summary']['bolla_ai']['livello_allarme']}**" for e in eps]
    return ("### 🫧 Termometro bolla AI\n"
            "_Quanto si dicono preoccupati gli ospiti, puntata per puntata (non è un consiglio operativo)._\n\n"
            + " → ".join(cells))


def cmd_podcast(cfg, state, args):
    from collectors.podcast import discover_feed, fetch_episodes
    f = discover_feed(cfg, state)
    if f["status"] != "ok":
        print(f"Podcast: {f['status']}")
        return 1
    res = fetch_episodes(cfg, f["data"], limit=max(args.last, 10))
    if res["status"] != "ok":
        print(f"Podcast: {res['status']}")
        return 1
    parts = [f"## Black Box — ultime {args.last} puntate", ""]
    for ep in res["data"][:args.last]:
        print(f"… {ep.title}", flush=True)
        parts += [render_episode_md(process_episode(cfg, state, ep)), ""]
    trend = render_bubble_trend(state)
    if trend:
        parts[2:2] = [trend, ""]
    tot = llm.weekly_totals(cfg.logs_dir / "tokens.csv")
    parts.append(f"_Token ultimi 7 giorni: {tot['calls']} chiamate, {tot['tokens_in']:,} in, "
                 f"{tot['tokens_out']:,} out (equivalente API ${tot['cost_usd_equiv']:.3f})_")
    md = "\n".join(parts)
    out = cfg.data_dir / f"podcast-{datetime.now():%Y-%m-%d-%H%M}.md"
    out.write_text(md, encoding="utf-8")
    print("\n" + md + f"\n\nSalvato in {out}")
    return 0


def _wait_for_episode(cfg, state, slot: str, tz) -> object | None:
    """Controlla il feed (zero token); se la puntata di oggi manca, riprova ogni N minuti."""
    from collectors.podcast import discover_feed, fetch_episodes
    pc = cfg.section("podcast")
    step, limit = pc.get("retry_minutes", 15) * 60, pc.get("max_wait_minutes", 120) * 60
    deadline = time.monotonic() + limit
    today = datetime.now(tz).date()
    while True:
        f = discover_feed(cfg, state)
        if f["status"] == "ok":
            res = fetch_episodes(cfg, f["data"], limit=6)
            for ep in res["data"] or []:
                if ep.slot == slot and ep.published.astimezone(tz).date() == today:
                    return ep
        if time.monotonic() + step > deadline:
            return None
        print(f"Puntata {slot} non ancora uscita, riprovo tra {step // 60} minuti…", flush=True)
        time.sleep(step)


def cmd_run(cfg, state, args):
    tz = ZoneInfo(cfg.raw.get("timezone", "Europe/Rome"))
    today = datetime.now(tz).date().isoformat()
    if not args.force and (state.run_done(today, args.slot) or state.runs_today(today) >= 2):
        print(f"Run {args.slot} di oggi già completato: esco (massimo 2 run al giorno).")
        return 0
    lock = cfg.data_dir / "run.lock"
    try:
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        age = time.time() - lock.stat().st_mtime
        if age < 4 * 3600:
            print(f"Un altro run è in corso (lock di {age / 60:.0f} minuti fa): esco.")
            return 0
        lock.unlink()  # lock orfano di un run crashato
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    os.write(fd, str(os.getpid()).encode())
    os.close(fd)
    state.start_run(today, args.slot)
    status = "error"
    try:
        ep = _wait_for_episode(cfg, state, args.slot, tz)
        if ep:
            md = render_episode_md(process_episode(cfg, state, ep))
            trend = render_bubble_trend(state)
            md = f"{trend}\n\n{md}" if trend else md
        else:
            md = f"### Puntata {args.slot}: non ancora disponibile dopo {cfg.section('podcast').get('max_wait_minutes', 120)} minuti di attesa."
        # Moduli 2-7, Notion e HTML: in arrivo, un modulo alla volta.
        out = cfg.data_dir / f"{today}-{args.slot}.md"
        out.write_text(md, encoding="utf-8")
        print(md + f"\n\nSalvato in {out}")
        status = "ok"
    finally:
        state.finish_run(today, args.slot, status)
        lock.unlink(missing_ok=True)
    return 0


def cmd_tokens(cfg, state, args):
    t = llm.weekly_totals(cfg.logs_dir / "tokens.csv")
    print(f"Ultimi 7 giorni: {t['calls']} chiamate, {t['tokens_in']:,} token in, {t['tokens_out']:,} out "
          f"(equivalente API ${t['cost_usd_equiv']:.3f}; con l'abbonamento non paghi questa cifra)")


def main(argv=None):
    _utf8_stdout()
    p = argparse.ArgumentParser(prog="intel")
    sub = p.add_subparsers(dest="cmd", required=True)
    t = sub.add_parser("test-sources", help="verifica ogni fonte con una chiamata reale")
    t.add_argument("--only", help="solo un gruppo: podcast, news, retail, mercato, posizionamento, utili, llm, output")
    pc = sub.add_parser("podcast", help="Modulo 1 sulle ultime N puntate")
    pc.add_argument("--last", type=int, default=2)
    r = sub.add_parser("run", help="run completo di uno slot")
    r.add_argument("--slot", choices=["mattina", "sera"], required=True)
    r.add_argument("--force", action="store_true", help="ignora il limite di 2 run al giorno (solo per test)")
    sub.add_parser("tokens", help="totale token degli ultimi 7 giorni")
    args = p.parse_args(argv)

    cfg = config.load()
    state = State(cfg.data_dir / "state.sqlite")
    handler = {"test-sources": cmd_test_sources, "podcast": cmd_podcast,
               "run": cmd_run, "tokens": cmd_tokens}[args.cmd]
    sys.exit(handler(cfg, state, args) or 0)


if __name__ == "__main__":
    main()
