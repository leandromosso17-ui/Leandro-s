"""Sentiment dei titoli di news in locale, senza torch: FinBERT e un modello multilingue in ONNX.

Extra opzionale (uv sync --extra sentiment). I modelli int8 (~110 MB e ~136 MB) si
scaricano al primo uso in models/sentiment/. Zero token.
"""
from __future__ import annotations

import json
from pathlib import Path

from intel import http

MODELS = {
    "en": "Xenova/finbert",
    "it": "Xenova/distilbert-base-multilingual-cased-sentiments-student",
}
FILES = ("config.json", "tokenizer.json", "onnx/model_int8.onnx")
HF = "https://huggingface.co/{repo}/resolve/main/{file}"


def available() -> str | None:
    """None se l'extra è installato, altrimenti il motivo."""
    try:
        import numpy  # noqa: F401
        import onnxruntime  # noqa: F401
        import tokenizers  # noqa: F401
    except ImportError:
        return "extra non installato (uv sync --extra sentiment)"
    return None


def _download(repo: str, root: Path) -> Path:
    d = root / repo.replace("/", "__")
    for f in FILES:
        dest = d / f
        if dest.exists():
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        r = http.get(HF.format(repo=repo, file=f), timeout=600)
        r.raise_for_status()
        tmp = dest.with_suffix(dest.suffix + ".part")
        tmp.write_bytes(r.content)
        tmp.replace(dest)
    return d


class Classifier:
    def __init__(self, repo: str, root: Path):
        import onnxruntime as ort
        from tokenizers import Tokenizer

        d = _download(repo, root)
        self.labels = {int(k): v.lower() for k, v in json.loads((d / "config.json").read_text())["id2label"].items()}
        self.tok = Tokenizer.from_file(str(d / "tokenizer.json"))
        self.tok.enable_truncation(128)  # i titoli sono brevi
        self.tok.enable_padding()
        self.sess = ort.InferenceSession(str(d / "onnx/model_int8.onnx"), providers=["CPUExecutionProvider"])
        self.inputs = {i.name for i in self.sess.get_inputs()}

    def __call__(self, texts: list[str]) -> list[tuple[str, float]]:
        import numpy as np

        enc = self.tok.encode_batch(texts)
        feed = {"input_ids": np.array([e.ids for e in enc], dtype=np.int64),
                "attention_mask": np.array([e.attention_mask for e in enc], dtype=np.int64)}
        if "token_type_ids" in self.inputs:
            feed["token_type_ids"] = np.array([e.type_ids for e in enc], dtype=np.int64)
        logits = self.sess.run(None, {k: v for k, v in feed.items() if k in self.inputs})[0]
        p = np.exp(logits - logits.max(axis=1, keepdims=True))
        p /= p.sum(axis=1, keepdims=True)
        return [(self.labels[int(i)], float(row[i])) for row, i in zip(p, p.argmax(axis=1))]


_cache: dict[str, Classifier] = {}


def classify(cfg, items: list[dict]) -> str | None:
    """Aggiunge sentiment ('positive'|'negative'|'neutral') e sent_score a ogni item. Ritorna l'errore o None."""
    why = available()
    if why:
        return why
    try:
        for lang, repo in MODELS.items():
            batch = [it for it in items if it["lang"] == lang]
            if not batch:
                continue
            if repo not in _cache:
                _cache[repo] = Classifier(repo, cfg.root / "models" / "sentiment")
            for it, (label, score) in zip(batch, _cache[repo]([it["title"] for it in batch])):
                it["sentiment"], it["sent_score"] = label, score
    except Exception as e:  # noqa: BLE001
        return f"modello di sentiment non utilizzabile: {e}"
    return None
