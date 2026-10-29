"""Modulo 3: sentiment retail per titolo e indicatori di mercato (zero token)."""
from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

from analysis.sentiment import classify
from collectors import forums, market, retail


def _patterns(cfg, p) -> list[re.Pattern]:
    """Come riconoscere il titolo in un post: cashtag, nome, alias; ticker nudo solo se lungo
    almeno 4 lettere (NOW, NET, CLS sono parole comuni). Per ETF/ETC: le parole dei temi."""
    pats = [re.compile(r"\$" + re.escape(p.ticker.split(".")[0]) + r"\b", re.I)]
    words = [p.nome, *p.alias]
    extra = (cfg.raw.get("tickers") or {}).get(p.ticker) or {}
    if extra.get("sottostanti"):
        themes = cfg.raw.get("themes") or {}
        words = [w.strip() for t in p.temi for w in themes.get(t, [])]
    pats += [re.compile(r"\b" + re.escape(w) + r"\b", re.I) for w in words if len(w.strip()) >= 3]
    base = p.ticker.split(".")[0]
    if len(base) >= 4 and base.isalpha() and "." not in p.ticker:
        pats.append(re.compile(r"\b" + re.escape(base) + r"\b"))  # maiuscolo esatto
    return pats


def match_posts(cfg, p, posts: list[dict]) -> list[dict]:
    pats = _patterns(cfg, p)
    return [x for x in posts if any(pt.search(x["title"]) for pt in pats)]


def collect(cfg, state, only: str | None = None) -> dict:
    rc = cfg.section("retail")
    positions = [p for p in cfg.positions if not only or p.ticker == only]

    ape = retail.apewisdom()
    feeds, posts = {}, []
    it_subs = set(rc.get("subreddit_it") or [])
    for sub in rc.get("subreddit") or []:
        print(f"… Reddit r/{sub}", flush=True)
        f = retail.reddit_feed(sub)
        feeds[sub] = f
        for x in f["data"] or []:
            posts.append({**x, "lang": "it" if sub in it_subs else "en"})
    since = datetime.now(timezone.utc) - timedelta(days=7)
    posts = [x for x in posts if x["published"] >= since]

    ariva = rc.get("ariva") or {}
    forum_since = datetime.now(timezone.utc) - timedelta(days=rc.get("forum_days", 30))
    rows = []
    for p in positions:
        print(f"… retail {p.ticker}", flush=True)
        mine = match_posts(cfg, p, posts)
        err = classify(cfg, mine) if mine else None
        us = retail.is_us(p.ticker) and not ((cfg.raw.get("tickers") or {}).get(p.ticker) or {}).get("sottostanti")
        forum = None
        if p.ticker in ariva:
            forum = forums.ariva(ariva[p.ticker])
            if forum["status"] == "ok":
                every = forum["data"]
                forum["last"] = max((x["published"] for x in every), default=None)
                forum["data"] = [x for x in every if x["published"] >= forum_since]
                # nessun sentiment: il modello multilingue sbaglia sul gergo dei forum tedeschi
        rows.append({
            "forum": forum,
            "ticker": p.ticker, "nome": p.nome, "tipo": p.tipo,
            "ape": (ape["data"] or {}).get(p.ticker) if ape["status"] == "ok" else None,
            "ape_status": ape["status"] if us else "non disponibile: ApeWisdom copre solo titoli USA",
            "stocktwits": retail.stocktwits(p.ticker) if us else
            {"status": "non disponibile: StockTwits solo per titoli USA", "data": None},
            "posts": mine, "sentiment_error": err,
        })
    return {"rows": rows, "ape": ape, "feeds": feeds, "n_posts": len(posts), "forum_days": rc.get("forum_days", 30),
            "market": {"fg": market.fear_greed(), "vix": market.vix(), "putcall": market.putcall()}}
