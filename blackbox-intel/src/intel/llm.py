"""Chiamate LLM: `claude -p` a contesto minimo oppure Ollama locale.

Un `claude -p` nudo carica system prompt, tool, MCP e CLAUDE.md (~37k token
misurati). Con i flag sotto l'overhead scende a ~1.3k token.
"""
from __future__ import annotations

import csv
import json
import os
import shutil
import subprocess
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path

import requests

SYSTEM = ("Sei un analista che sintetizza in italiano. Non inventare mai dati. "
          "Non dare mai consigli di acquisto o vendita né target di prezzo. "
          "Rispondi solo con JSON valido, senza testo prima o dopo.")


@dataclass
class LLMResult:
    text: str
    tokens_in: int
    tokens_out: int
    model: str
    cost_usd: float = 0.0


class LLMError(RuntimeError):
    pass


def find_claude() -> str | None:
    # L'installer nativo mette claude in ~/.local/bin ma non sempre lo aggiunge al PATH.
    exe = shutil.which("claude")
    if exe:
        return exe
    for name in ("claude.exe", "claude"):
        p = Path.home() / ".local" / "bin" / name
        if p.is_file():
            return str(p)
    return None


def _claude(prompt: str, model: str, max_out: int) -> LLMResult:
    exe = find_claude()
    if not exe:
        raise LLMError("comando `claude` non trovato nel PATH né in ~/.local/bin")
    cmd = [exe, "-p", "--model", model, "--output-format", "json",
           "--tools", "", "--system-prompt", SYSTEM, "--strict-mcp-config",
           "--setting-sources", "", "--disable-slash-commands", "--no-session-persistence"]
    env = dict(os.environ, CLAUDE_CODE_MAX_OUTPUT_TOKENS=str(max_out))
    # Il prompt passa da stdin: niente limiti di lunghezza della riga di comando su Windows.
    p = subprocess.run(cmd, input=prompt, capture_output=True, text=True, encoding="utf-8",
                       env=env, timeout=600)
    try:
        d = json.loads(p.stdout)
    except json.JSONDecodeError as e:
        raise LLMError(f"output non JSON da claude -p: {(p.stderr or p.stdout)[:300]}") from e
    if d.get("is_error"):
        raise LLMError(str(d.get("result"))[:300])
    u = d.get("usage", {})
    tin = u.get("input_tokens", 0) + u.get("cache_creation_input_tokens", 0) + u.get("cache_read_input_tokens", 0)
    used_model = next(iter(d.get("modelUsage", {})), model)
    return LLMResult(d.get("result", ""), tin, u.get("output_tokens", 0), used_model, d.get("total_cost_usd", 0.0))


def _ollama(prompt: str, url: str, model: str, max_out: int) -> LLMResult:
    r = requests.post(f"{url.rstrip('/')}/api/generate", timeout=900, json={
        "model": model, "system": SYSTEM, "prompt": prompt, "stream": False,
        "format": "json", "options": {"num_predict": max_out},
    })
    r.raise_for_status()
    d = r.json()
    return LLMResult(d.get("response", ""), d.get("prompt_eval_count", 0), d.get("eval_count", 0), model)


def call(cfg, prompt: str, *, purpose: str, cheap: bool, max_out: int) -> LLMResult:
    llm = cfg.section("llm")
    if llm.get("engine", "claude") == "ollama":
        res = _ollama(prompt, llm.get("ollama_url", "http://localhost:11434"), llm["ollama_model"], max_out)
    else:
        model = llm.get("claude_model_cheap" if cheap else "claude_model_final", "haiku")
        res = _claude(prompt, model, max_out)
    log_tokens(cfg.logs_dir / "tokens.csv", purpose, res)
    return res


def parse_json(text: str):
    t = text.strip()
    if t.startswith("```"):
        t = t.strip("`")
        t = t[t.find("\n") + 1:] if "\n" in t else t
    start, end = t.find("{"), t.rfind("}")
    if start < 0 or end < 0:
        raise LLMError("nessun oggetto JSON nella risposta")
    return json.loads(t[start:end + 1])


def log_tokens(path: Path, purpose: str, res: LLMResult) -> None:
    new = not path.exists()
    with open(path, "a", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        if new:
            w.writerow(["timestamp", "purpose", "model", "tokens_in", "tokens_out", "cost_usd_equiv"])
        w.writerow([datetime.now().isoformat(timespec="seconds"), purpose, res.model,
                    res.tokens_in, res.tokens_out, f"{res.cost_usd:.5f}"])


def weekly_totals(path: Path, today: date | None = None) -> dict:
    today = today or date.today()
    since = today - timedelta(days=6)
    tot = {"calls": 0, "tokens_in": 0, "tokens_out": 0, "cost_usd_equiv": 0.0}
    if not path.exists():
        return tot
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if date.fromisoformat(row["timestamp"][:10]) >= since:
                tot["calls"] += 1
                tot["tokens_in"] += int(row["tokens_in"])
                tot["tokens_out"] += int(row["tokens_out"])
                tot["cost_usd_equiv"] += float(row["cost_usd_equiv"] or 0)
    return tot
