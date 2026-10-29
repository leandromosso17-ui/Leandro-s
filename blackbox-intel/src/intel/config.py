"""Caricamento di config.yaml, .env e portfolio.csv."""
from __future__ import annotations

import csv
import os
from dataclasses import dataclass, field
from pathlib import Path

import yaml
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]


@dataclass
class Position:
    ticker: str
    nome: str
    investito_k: float | None
    tipo: str
    tesi: str
    isin: str
    alias: list[str] = field(default_factory=list)
    temi: list[str] = field(default_factory=list)


@dataclass
class Config:
    raw: dict
    root: Path
    positions: list[Position]

    @property
    def data_dir(self) -> Path:
        return self.root / "data"

    @property
    def logs_dir(self) -> Path:
        return self.root / "logs"

    @property
    def reports_dir(self) -> Path:
        return Path(os.path.expanduser(self.raw.get("reports_dir", "~/blackbox-intel/reports")))

    @property
    def sec_user_agent(self) -> str:
        return os.environ.get("SEC_USER_AGENT", "").strip()

    def section(self, name: str) -> dict:
        return self.raw.get(name) or {}


def _to_float(v: str) -> float | None:
    v = (v or "").strip().replace(",", ".")
    return float(v) if v else None


def load(root: Path = ROOT) -> Config:
    load_dotenv(root / ".env")
    raw = yaml.safe_load((root / "config.yaml").read_text(encoding="utf-8")) or {}
    tick_cfg = raw.get("tickers") or {}
    positions = []
    with open(root / raw.get("portfolio_csv", "portfolio.csv"), encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            t = row["ticker"].strip()
            if not t:
                continue
            extra = tick_cfg.get(t) or {}
            positions.append(Position(
                ticker=t,
                nome=row.get("nome", "").strip(),
                investito_k=_to_float(row.get("investito_k", "")),
                tipo=(row.get("tipo") or "watchlist").strip().lower(),
                tesi=(row.get("tesi") or "").strip(),
                isin=(row.get("isin") or "").strip(),
                alias=[a.lower() for a in extra.get("alias", [])],
                temi=list(extra.get("temi", [])),
            ))
    cfg = Config(raw=raw, root=root, positions=positions)
    for d in (cfg.data_dir, cfg.logs_dir):
        d.mkdir(parents=True, exist_ok=True)
    return cfg
