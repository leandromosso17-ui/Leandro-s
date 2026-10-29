"""Google News RSS per ticker, in inglese e italiano, deduplicato."""
from __future__ import annotations

import difflib
import re
from email.utils import parsedate_to_datetime

from defusedxml import ElementTree as ET

from collectors.base import ok, unavailable
from intel import http

RSS = "https://news.google.com/rss/search"
LOCALES = {"en": {"hl": "en-US", "gl": "US", "ceid": "US:en"},
           "it": {"hl": "it", "gl": "IT", "ceid": "IT:it"}}


def search(query: str, lang: str, days: int = 7) -> dict:
    params = {"q": f"{query} when:{days}d", **LOCALES[lang]}
    try:
        r = http.get(RSS, params=params, min_interval=0.5)
        r.raise_for_status()
        root = ET.fromstring(r.content)
    except Exception as e:  # noqa: BLE001
        return unavailable(f"Google News: {e}", RSS)
    items = []
    for it in root.iter("item"):
        source = (it.findtext("source") or "").strip()
        title = (it.findtext("title") or "").strip()
        if source and title.endswith(f" - {source}"):
            title = title[: -len(source) - 3].strip()
        try:
            pub = parsedate_to_datetime(it.findtext("pubDate") or "")
        except (TypeError, ValueError):
            continue
        items.append({"title": title, "source": source, "published": pub,
                      "link": (it.findtext("link") or "").strip(), "lang": lang})
    return ok(items, r.url)


def _key(title: str) -> str:
    return re.sub(r"[^\w ]", "", title.lower())[:90]


def dedup(items: list[dict]) -> list[dict]:
    """Toglie i doppioni (stesso titolo ripreso da più testate), tenendo il più recente."""
    out: list[dict] = []
    for it in sorted(items, key=lambda x: x["published"], reverse=True):
        k = _key(it["title"])
        if any(difflib.SequenceMatcher(None, k, _key(o["title"])).ratio() > 0.85 for o in out):
            continue
        out.append(it)
    return out


def queries(p, extra: dict | None) -> dict[str, list[str]]:
    """Query di default per nome; per ETF/ETC si usa news_query da config.yaml (il sottostante)."""
    if extra and extra.get("news_query"):
        return {lang: [q] if isinstance(q, str) else list(q) for lang, q in extra["news_query"].items()}
    return {"en": [f'"{p.nome}" stock'], "it": [f'"{p.nome}"']}


def ticker_news(p, extra: dict | None, days: int = 7) -> dict:
    items, errors, urls = [], [], []
    for lang, qs in queries(p, extra).items():
        for q in qs:
            res = search(q, lang, days)
            if res["status"] == "ok":
                items += res["data"]
                urls.append(res["source_url"])
            else:
                errors.append(f"{lang}: {res['status']}")
    if not items and errors:
        return unavailable("; ".join(errors), RSS)
    out = ok(dedup(items), urls[0] if urls else RSS)
    out["errors"] = errors
    return out


def bank_news(p, days: int = 30) -> dict:
    """Titoli su rating e target price: per i titoli europei è l'unica fonte gratuita per banca."""
    items = []
    for lang, q in (("it", f'"{p.nome}" target price'), ("en", f'"{p.nome}" price target')):
        res = search(q, lang, days)
        if res["status"] == "ok":
            items += res["data"]
    return ok(dedup(items), RSS)
