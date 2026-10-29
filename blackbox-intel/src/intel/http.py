"""Sessione HTTP condivisa con User-Agent e backoff sui 429/5xx."""
from __future__ import annotations

import time

import requests

DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) blackbox-intel/0.1"


def get(url: str, *, params=None, headers=None, timeout=20, retries=3, min_interval=0.0) -> requests.Response:
    h = {"User-Agent": DEFAULT_UA}
    if headers:
        h.update(headers)
    delay = 2.0
    for attempt in range(retries + 1):
        if min_interval:
            time.sleep(min_interval)
        r = requests.get(url, params=params, headers=h, timeout=timeout)
        if r.status_code in (429, 500, 502, 503, 504) and attempt < retries:
            retry_after = r.headers.get("Retry-After", "")
            time.sleep(float(retry_after) if retry_after.isdigit() else delay)
            delay *= 2
            continue
        return r
    return r
