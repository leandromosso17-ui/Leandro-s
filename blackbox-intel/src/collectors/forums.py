"""Forum per i titoli europei: ariva.de, un feed RSS pubblico per titolo.

Verificate il 29/10/2026 e scartate: Investing.com (HTTP 403 anti-scraping),
commenti Yahoo Finance (widget OpenWeb senza API pubblica), FinanzaOnline
(verifica anti-bot di Cloudflare). Non si aggirano protezioni.
"""
from __future__ import annotations

import html
import re
from email.utils import parsedate_to_datetime

from defusedxml import ElementTree as ET

from collectors.base import ok, unavailable
from intel import http

ARIVA_RSS = "https://www.ariva.de/aktien/{slug}/forum/rss"
ARIVA_PAGE = "https://www.ariva.de/forum/{slug}/"
# post automatici della redazione, non commenti di utenti
_AUTO = re.compile(r"automatisiert generierter Hinweis|ARIVA\.DE Redaktion", re.I)


def _text(s: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s or ""))).strip()


def ariva(slug: str) -> dict:
    url = ARIVA_RSS.format(slug=slug)
    try:
        r = http.get(url, min_interval=1.0)
        r.raise_for_status()
        root = ET.fromstring(r.content)
    except Exception as e:  # noqa: BLE001
        return unavailable(f"ariva.de: {e}", url)
    posts = []
    for it in root.iter("item"):
        body = _text(it.findtext("description") or "")
        if _AUTO.search(body):
            continue
        try:
            when = parsedate_to_datetime(it.findtext("pubDate") or "")
        except (TypeError, ValueError):
            continue
        title = _text(it.findtext("title") or "")
        posts.append({"title": title, "body": body[:400], "published": when, "lang": "de",
                      "link": (it.findtext("link") or "").strip() or ARIVA_PAGE.format(slug=slug),
                      # testo per il sentiment: titolo + inizio del messaggio
                      "text": f"{title}. {body[:300]}"})
    return ok(posts, ARIVA_PAGE.format(slug=slug))
