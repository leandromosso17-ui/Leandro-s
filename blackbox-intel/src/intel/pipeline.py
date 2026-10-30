"""Run completo di uno slot: moduli attivi in config.yaml, al massimo 2 chiamate LLM, digest HTML/Markdown/Notion."""
from __future__ import annotations

import csv
import time
from datetime import date, datetime
from zoneinfo import ZoneInfo

from intel import llm


def latest_episodes(cfg, state, slot: str, tz, wait: bool, day: date | None, budget: int) -> tuple[list[dict], str]:
    """Le ultime due puntate (una per slot), la più recente prima; con `day`, quelle di quel giorno.
    `budget` = quante sintesi nuove si possono fare (chiamate LLM)."""
    from collectors.podcast import discover_feed, fetch_episodes
    from intel.cli import _wait_for_episode, process_episode

    if wait and day is None:
        _wait_for_episode(cfg, state, slot, tz)  # aspetta la puntata di oggi (zero token)
    f = discover_feed(cfg, state)
    if f["status"] != "ok":
        return [], f"Podcast: {f['status']}"
    res = fetch_episodes(cfg, f["data"], limit=12)
    if res["status"] != "ok":
        return [], f"Podcast: {res['status']}"
    feed = res["data"]
    if day:
        chosen = [e for e in feed if e.published.astimezone(tz).date() == day][:2]
    else:
        chosen = feed[:1]
        other = next((e for e in feed[1:] if e.slot != feed[0].slot), None) if feed else None
        chosen += [other] if other else []
    out, note = [], ""
    for ep in chosen:
        if not state.get_episode(ep.guid) or (state.get_episode(ep.guid)["summary"].get("_v") or 0) < _version():
            if budget <= 0:
                note += f"Puntata «{ep.title}» non sintetizzata in questo run (limite di 2 chiamate LLM). "
                continue
            budget -= 1
        out.append(process_episode(cfg, state, ep))
    return out, note.strip()


def _version() -> int:
    from analysis.podcast import PROMPT_VERSION
    return PROMPT_VERSION


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


def _unavailable(ctx: dict) -> list[str]:
    bad = []

    def chk(name, res):
        if res and res.get("status") not in (None, "ok") and "ETF" not in res.get("status", ""):
            bad.append(f"{name}: {res['status']}")

    for t, n in ctx["news"].items():
        chk(f"prezzo {t}", n.get("price"))
        chk(f"news {t}", n.get("news"))
    for k, v in ctx["market"].items():
        chk(k, v)
    chk("Polymarket", ctx["polymarket"])
    return bad


def build(cfg, state, slot: str, wait: bool = True, day: date | None = None) -> dict:
    from analysis import earnings as E
    from analysis.tickers import analyze_all
    from collectors import market as MK
    from collectors import polymarket as PM

    mods = cfg.section("moduli")
    t0, started = time.monotonic(), datetime.now()
    tz = ZoneInfo(cfg.raw.get("timezone", "Europe/Rome"))
    budget = 2 - (1 if mods.get("chiamata_finale") else 0)
    eps, note = latest_episodes(cfg, state, slot, tz, wait, day, budget)    # chiamate LLM 1-2
    news = {r["ticker"]: r for r in analyze_all(cfg, state)}                 # Modulo 2
    print("… mercato e Polymarket", flush=True)
    market = {"fg": MK.fear_greed(), "vix": MK.vix(), "putcall": MK.putcall()}
    pm = PM.collect(cfg, state)                                              # Modulo 5
    earn = E.collect(cfg)                                                    # Modulo 6
    ctx = {"date": datetime.now(tz).date(), "slot": slot, "state": state, "episodes": eps, "podcast_note": note,
           "news": news, "market": market, "polymarket": pm, "earnings": earn["rows"]}
    # moduli spenti di default (config.yaml, moduli): restano disponibili
    if mods.get("retail"):
        from analysis import retail as R
        ret = R.collect(cfg, state)
        ctx["retail"] = {r["ticker"]: r for r in ret["rows"]}
    if mods.get("posizionamento"):
        from analysis import positioning as PO
        ctx["positioning"] = PO.collect(cfg, state)
    if mods.get("portfolio"):
        from analysis import portfolio as PF
        ctx["portfolio"] = PF.collect(cfg, news, earn["profiles"], eps)
    calls, tin, tout = _tokens_since(cfg.logs_dir / "tokens.csv", started)
    ctx["footer"] = {"calls": calls, "tin": tin, "tout": tout, "week": llm.weekly_totals(cfg.logs_dir / "tokens.csv"),
                     "minutes": (time.monotonic() - t0) / 60, "unavailable": _unavailable(ctx)}
    return ctx
