"""Sentiment retail: ApeWisdom (menzioni Reddit), StockTwits, feed RSS dei subreddit.

- Reddit .json non autenticato: 403 da maggio 2026, non usato.
- Reddit RSS senza login: circa 1 richiesta al minuto (x-ratelimit-reset): si aspetta il reset.
- ApeWisdom e StockTwits coprono solo i titoli USA.
"""
from __future__ import annotations

import time
from datetime import datetime

from defusedxml import ElementTree as ET

from collectors.base import ok, unavailable
from intel import http

APE = "https://apewisdom.io/api/v1.0/filter/all-stocks/page/{n}"
STOCKTWITS = "https://api.stocktwits.com/api/2/streams/symbol/{s}.json"
REDDIT = "https://www.reddit.com/r/{sub}/new/.rss"
ATOM = "{http://www.w3.org/2005/Atom}"


def is_us(ticker: str) -> bool:
    return "." not in ticker and "=" not in ticker and not ticker.startswith("^")


def apewisdom(max_pages: int = 10) -> dict:
    """Tutti i ticker con menzioni su Reddit nelle ultime 24 ore, per simbolo."""
    out, pages, n = {}, 1, 1
    try:
        while n <= min(pages, max_pages):
            r = http.get(APE.format(n=n), min_interval=1.0)
            r.raise_for_status()
            d = r.json()
            pages = d.get("pages") or 1
            for x in d.get("results") or []:
                out[x["ticker"]] = {k: x.get(k) for k in ("rank", "mentions", "mentions_24h_ago",
                                                          "rank_24h_ago", "upvotes")}
            n += 1
    except Exception as e:  # noqa: BLE001
        if not out:
            return unavailable(f"ApeWisdom: {e}", APE.format(n=1))
    return ok(out, "https://apewisdom.io/")


def stocktwits(symbol: str) -> dict:
    """Ultimi 30 messaggi: quanti con tag Bullish/Bearish messo dagli utenti."""
    url = STOCKTWITS.format(s=symbol)
    try:
        r = http.get(url, min_interval=1.0)
        if r.status_code != 200:
            return unavailable(f"StockTwits HTTP {r.status_code}"
                               + (" (blocco anti-bot)" if "Just a moment" in r.text else ""), url)
        msgs = r.json().get("messages") or []
    except Exception as e:  # noqa: BLE001
        return unavailable(f"StockTwits: {e}", url)
    tags = [((m.get("entities") or {}).get("sentiment") or {}).get("basic") for m in msgs]
    times = [m.get("created_at", "") for m in msgs]
    return ok({"n": len(msgs), "bullish": tags.count("Bullish"), "bearish": tags.count("Bearish"),
               "since": min(times) if times else "", "until": max(times) if times else ""},
              f"https://stocktwits.com/symbol/{symbol}")


def _reset_seconds(r, default: int = 60) -> int:
    v = r.headers.get("x-ratelimit-reset", "")
    try:
        return int(float(v)) + 1
    except ValueError:
        return default


def reddit_feed(sub: str, max_wait: int = 75) -> dict:
    """I 100 post più recenti del subreddit. Se il limite è esaurito aspetta il reset."""
    url = REDDIT.format(sub=sub)
    for attempt in range(2):
        try:
            # niente retry interni sui 429: il tempo giusto lo dice x-ratelimit-reset
            r = http.get(url, params={"limit": 100}, retries=0)
        except Exception as e:  # noqa: BLE001
            if attempt == 0:  # DNS/hotspot: un secondo tentativo
                time.sleep(3)
                continue
            return unavailable(f"Reddit RSS: {e}", url)
        if r.status_code == 429 and attempt == 0:
            wait = _reset_seconds(r)
            if wait > max_wait:
                return unavailable(f"Reddit RSS: limite esaurito, reset tra {wait}s", url)
            time.sleep(wait)
            continue
        if r.status_code != 200:
            return unavailable(f"Reddit RSS HTTP {r.status_code}", url)
        break
    try:
        root = ET.fromstring(r.content)
    except ET.ParseError:
        return unavailable("Reddit RSS: risposta non XML", url)
    posts = []
    for e in root.iter(ATOM + "entry"):
        link = e.find(ATOM + "link")
        try:
            when = datetime.fromisoformat((e.findtext(ATOM + "updated") or "").replace("Z", "+00:00"))
        except ValueError:
            continue
        posts.append({"title": (e.findtext(ATOM + "title") or "").strip(), "published": when, "sub": sub,
                      "link": link.get("href", "") if link is not None else ""})
    # limite esaurito: aspetta qui, così la richiesta successiva non prende un 429
    if r.headers.get("x-ratelimit-remaining", "1") in ("0", "0.0"):
        wait = _reset_seconds(r, 0)
        if wait <= max_wait:
            time.sleep(wait)
    return ok(posts, f"https://www.reddit.com/r/{sub}/new/")
