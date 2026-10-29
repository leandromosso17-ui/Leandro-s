"""Formato comune dei collector: {data, source_url, fetched_at, status}."""
from __future__ import annotations

from datetime import datetime, timezone


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def ok(data, source_url: str) -> dict:
    return {"data": data, "source_url": source_url, "fetched_at": now_iso(), "status": "ok"}


def unavailable(reason: str, source_url: str = "") -> dict:
    return {"data": None, "source_url": source_url, "fetched_at": now_iso(),
            "status": f"non disponibile: {reason}"}
