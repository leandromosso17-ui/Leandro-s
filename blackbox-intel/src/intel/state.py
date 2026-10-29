"""Stato in SQLite: puntate elaborate, cache sintesi, ultimi valori, run."""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

SCHEMA = """
create table if not exists episodes (
    guid text primary key,
    title text,
    published text,
    slot text,
    transcript_source text,
    summary_json text,
    tokens_in integer,
    tokens_out integer,
    processed_at text
);
create table if not exists kv (
    key text primary key,
    value text,
    updated_at text default current_timestamp
);
create table if not exists runs (
    run_date text,
    slot text,
    started_at text,
    finished_at text,
    status text,
    primary key (run_date, slot)
);
"""


class State:
    def __init__(self, path: Path):
        self.db = sqlite3.connect(path)
        self.db.row_factory = sqlite3.Row
        self.db.executescript(SCHEMA)

    # cache sintesi puntate
    def get_episode(self, guid: str) -> dict | None:
        row = self.db.execute("select * from episodes where guid=?", (guid,)).fetchone()
        if not row or not row["summary_json"]:
            return None
        d = dict(row)
        d["summary"] = json.loads(d.pop("summary_json"))
        return d

    def save_episode(self, guid, title, published, slot, source, summary, tokens_in, tokens_out):
        self.db.execute(
            "insert or replace into episodes values (?,?,?,?,?,?,?,?,datetime('now'))",
            (guid, title, published, slot, source, json.dumps(summary, ensure_ascii=False), tokens_in, tokens_out),
        )
        self.db.commit()

    # valori generici (feed url, ultimi prezzi, probabilità Polymarket...)
    def get(self, key: str, default=None):
        row = self.db.execute("select value from kv where key=?", (key,)).fetchone()
        return json.loads(row["value"]) if row else default

    def set(self, key: str, value) -> None:
        self.db.execute(
            "insert into kv(key, value, updated_at) values (?,?,datetime('now')) "
            "on conflict(key) do update set value=excluded.value, updated_at=excluded.updated_at",
            (key, json.dumps(value, ensure_ascii=False)),
        )
        self.db.commit()

    # limite dei run: uno per slot al giorno, quindi al massimo 2
    def run_done(self, run_date: str, slot: str) -> bool:
        row = self.db.execute(
            "select status from runs where run_date=? and slot=?", (run_date, slot)).fetchone()
        return bool(row and row["status"] == "ok")

    def runs_today(self, run_date: str) -> int:
        return self.db.execute(
            "select count(*) from runs where run_date=? and status='ok'", (run_date,)).fetchone()[0]

    def start_run(self, run_date: str, slot: str) -> None:
        self.db.execute(
            "insert or replace into runs values (?,?,datetime('now'),null,'running')", (run_date, slot))
        self.db.commit()

    def finish_run(self, run_date: str, slot: str, status: str) -> None:
        self.db.execute(
            "update runs set finished_at=datetime('now'), status=? where run_date=? and slot=?",
            (status, run_date, slot))
        self.db.commit()
