"""Modulo 6: utili nei prossimi 14 giorni, confermati o stimati, e risultati appena usciti (zero token).
Il commento "risultati contro attese e guidance" lo fa la chiamata LLM finale, non una chiamata in più."""
from __future__ import annotations

from datetime import date, timedelta

from collectors import yahoo
from collectors.base import unavailable
from intel import http

XOOMAR_CAL = "https://xoomar.com/api/markets/earnings"


def _xoomar_next(ticker: str, days: int) -> dict | None:
    """Riserva per i titoli USA se Yahoo non ha la data."""
    try:
        r = http.get(XOOMAR_CAL, params={"from": date.today().isoformat(),
                                         "to": (date.today() + timedelta(days=days)).isoformat(),
                                         "ticker": ticker.upper()},
                     headers={"Accept": "application/json"}, min_interval=6.5)
        rows = (r.json().get("data") or []) if r.status_code == 200 else []
    except Exception:  # noqa: BLE001
        return None
    if not rows:
        return None
    return {"date": date.fromisoformat(rows[0]["date"]), "estimated": rows[0].get("status") != "confirmed",
            "source": "xoomar"}


def _xoomar_last_report(ticker: str) -> date | None:
    """Ultima pubblicazione dei conti (USA): Yahoo dà solo la data futura."""
    try:
        r = http.get(f"https://xoomar.com/api/markets/earnings/{ticker.lower()}",
                     headers={"Accept": "application/json"}, min_interval=6.5)
        hist = ((r.json().get("data") or {}).get("history") or []) if r.status_code == 200 else []
        return date.fromisoformat(hist[0]["date"]) if hist else None
    except Exception:  # noqa: BLE001
        return None


def collect(cfg, only: str | None = None) -> dict:
    days = cfg.section("utili").get("giorni", 14)
    today = date.today()
    tick_cfg = cfg.raw.get("tickers") or {}
    out, profiles = {}, {}
    for p in cfg.positions:
        if only and p.ticker != only:
            continue
        print(f"… utili e profilo {p.ticker}", flush=True)
        if (tick_cfg.get(p.ticker) or {}).get("sottostanti"):
            out[p.ticker] = unavailable("ETF/ETC: niente utili")
            continue
        pr = yahoo.profile(p.ticker)
        profiles[p.ticker] = pr
        d = pr["data"] or {}
        nxt = None
        future = [x for x in d.get("earnings_dates") or [] if x >= today]
        if future:
            nxt = {"date": min(future), "estimated": d.get("earnings_estimated"), "source": "Yahoo"}
        elif "." not in p.ticker:
            nxt = _xoomar_next(p.ticker, days)
        past = [x for x in d.get("earnings_dates") or [] if x < today]
        recent = max(past) if past else None
        if not recent and "." not in p.ticker:
            recent = _xoomar_last_report(p.ticker)
        res = {"status": "ok" if pr["status"] == "ok" or nxt else pr["status"], "source_url": pr["source_url"],
               "next": nxt if nxt and nxt["date"] <= today + timedelta(days=days) else None,
               "next_any": nxt,
               # uscito negli ultimi 3 giorni: la chiamata finale lo commenta
               "just_reported": bool(recent and (today - recent).days <= 3) or
                                bool(nxt and nxt["date"] == today and not nxt.get("estimated")),
               "last_quarter": d.get("last_quarter"), "last_eps": d.get("last_eps"),
               "last_eps_est": d.get("last_eps_est"), "last_surprise_pct": d.get("last_surprise_pct"),
               "eps_estimate_next": d.get("eps_estimate_next")}
        if recent:
            res["reported_on"] = recent
        out[p.ticker] = res
    return {"rows": out, "profiles": profiles}


def banner(rows: dict, names: dict) -> list[str]:
    today, tomorrow = date.today(), date.today() + timedelta(days=1)
    L = []
    for t, r in rows.items():
        n = (r.get("next") or {}) if r.get("status") == "ok" else {}
        if n.get("date") in (today, tomorrow):
            when = "OGGI" if n["date"] == today else "DOMANI"
            L.append(f"**{when}: utili {names.get(t, t)} ({t})** — data {'stimata' if n.get('estimated') else 'confermata'}"
                     + (f", EPS atteso {n_fmt(r.get('eps_estimate_next'))}" if r.get("eps_estimate_next") else ""))
    return L


def n_fmt(v) -> str:
    return f"{v:.2f}" if isinstance(v, (int, float)) else "n.d."
