"""Pulizia delle trascrizioni in Python, prima dell'LLM (zero token).

- toglie tag e timestamp inline dei sottotitoli automatici YouTube;
- elimina le righe "a scorrimento" ripetute tra un cue e il successivo;
- tiene un marcatore [mm:ss] ogni `marker_every` secondi, utile per citare i passaggi.
"""
from __future__ import annotations

import html
import json
import re

_TS = re.compile(r"(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})")
_ARROW = re.compile(r"-->")
_INLINE = re.compile(r"<[^>]+>")
_NOISE = re.compile(r"\[(?:musica|music|applausi|risate|applause)\]", re.I)


def _secs(m: re.Match) -> float:
    h, mi, s, ms = m.groups()
    return int(h or 0) * 3600 + int(mi) * 60 + int(s) + int(ms.ljust(3, "0")) / 1000


def parse_cues(text: str) -> list[tuple[float, str]]:
    """VTT/SRT -> [(inizio_secondi, testo)]."""
    cues: list[tuple[float, str]] = []
    start: float | None = None
    buf: list[str] = []
    for line in text.splitlines():
        line = line.strip()
        if _ARROW.search(line):
            if start is not None and buf:
                cues.append((start, " ".join(buf)))
            m = _TS.search(line)
            start, buf = (_secs(m) if m else None), []
        elif not line:
            # YouTube mette una riga di soli spazi subito dopo il timestamp:
            # chiude il cue solo se ha già del testo.
            if start is not None and buf:
                cues.append((start, " ".join(buf)))
                start, buf = None, []
        elif start is not None and not line.isdigit():
            buf.append(line)
    if start is not None and buf:
        cues.append((start, " ".join(buf)))
    return cues


def _clean_text(s: str) -> str:
    s = html.unescape(_INLINE.sub("", s))
    s = _NOISE.sub(" ", s)
    return re.sub(r"\s+", " ", s).strip()


def _fmt(sec: float) -> str:
    sec = int(sec)
    return f"{sec // 3600}:{sec % 3600 // 60:02d}:{sec % 60:02d}" if sec >= 3600 else f"{sec // 60:02d}:{sec % 60:02d}"


def clean_cues(cues: list[tuple[float, str]], marker_every: int = 60) -> str:
    words: list[str] = []
    out: list[str] = []
    next_marker = 0.0
    for start, raw in cues:
        new = _clean_text(raw).split()
        if not new:
            continue
        # sovrapposizione massima tra la coda già scritta e l'inizio del nuovo cue
        overlap = 0
        for k in range(min(len(new), len(words), 40), 0, -1):
            if [w.lower() for w in words[-k:]] == [w.lower() for w in new[:k]]:
                overlap = k
                break
        added = new[overlap:]
        if not added:
            continue
        if start >= next_marker:
            out.append(f"\n[{_fmt(start)}]")
            next_marker = start - start % marker_every + marker_every
        out.extend(added)
        words.extend(added)
    return " ".join(out).replace(" \n", "\n").strip()


def clean_any(text: str, kind: str = "", marker_every: int = 60) -> str:
    """Pulisce VTT, SRT, JSON (podcast namespace) o testo semplice."""
    kind = kind.lower()
    if "json" in kind or text.lstrip().startswith("{"):
        try:
            segs = json.loads(text).get("segments", [])
            return clean_cues([(float(s.get("startTime", 0)), s.get("body", "")) for s in segs], marker_every)
        except (ValueError, AttributeError):
            pass
    if "-->" in text:
        return clean_cues(parse_cues(text), marker_every)
    return re.sub(r"\s+", " ", _clean_text(text)).strip()


def segments_to_text(segments, marker_every: int = 60) -> str:
    """Segmenti faster-whisper (start, text) -> testo con marcatori."""
    return clean_cues([(s.start, s.text) for s in segments], marker_every)
