"""Modulo 4: posizionamento per titolo (zero token)."""
from __future__ import annotations

from collectors import positioning as P
from collectors.base import unavailable
from collectors.retail import is_us

NA_FUND = "non disponibile: ETF/ETC, non deposita Form 4, 13D/13G né short interest"


def insider_summary(rows: list[dict]) -> dict:
    buys = [r for r in rows if r["side"] == "acquisto"]
    sells = [r for r in rows if r["side"] == "vendita"]
    nb, ns = len({r["name"] for r in buys}), len({r["name"] for r in sells})
    cluster = "acquisti" if nb >= 3 and nb > ns else "vendite" if ns >= 3 and ns > nb else None
    return {"buys": len(buys), "sells": len(sells), "buyers": nb, "sellers": ns,
            "buy_value": sum(r["value"] for r in buys), "sell_value": sum(r["value"] for r in sells),
            "cluster": cluster, "last": max((r["date"] for r in rows), default=None),
            "top": sorted(rows, key=lambda r: r["value"], reverse=True)[:3]}


def collect(cfg, state, only: str | None = None) -> dict:
    tick_cfg = cfg.raw.get("tickers") or {}
    eu = {}  # registri scaricati una volta per run
    cot = None
    rows = {}
    for p in cfg.positions:
        if only and p.ticker != only:
            continue
        print(f"… posizionamento {p.ticker}", flush=True)
        extra = tick_cfg.get(p.ticker) or {}
        out = {"ticker": p.ticker}
        if extra.get("sottostanti"):
            out["note"] = NA_FUND
            if "HG=F" in extra["sottostanti"]:
                cot = cot or P.cot_copper()
                out["cot"] = cot
        elif is_us(p.ticker):
            ins = P.insiders(p.ticker)
            if ins["status"] == "ok":
                out["insiders"] = {**ins, "summary": insider_summary(ins["data"])}
            else:
                out["insiders"] = ins
            out["short_interest"] = P.short_interest(p.ticker)
            out["holders"] = P.large_holders(p.ticker)
        else:
            suffix = "." + p.ticker.split(".")[-1]
            reg = P.REGULATOR_BY_SUFFIX.get(suffix)
            if not reg:
                out["eu_shorts"] = unavailable(f"nessun registro short configurato per {suffix}")
            else:
                if reg not in eu:
                    eu[reg] = getattr(P, reg)()
                src = eu[reg]
                if src["status"] == "ok":
                    out["eu_shorts"] = {"status": "ok", "source_url": src["source_url"], "reg": src["data"][0]["reg"]
                                        if src["data"] else reg, "data": P.eu_shorts_for(src["data"], [p.nome, *p.alias],
                                                                                         p.isin)}
                else:
                    out["eu_shorts"] = src
        rows[p.ticker] = out
    return rows
