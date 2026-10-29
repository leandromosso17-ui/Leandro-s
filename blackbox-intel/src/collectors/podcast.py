"""Black Box (Chora Media): feed RSS, puntate e trascrizioni.

Ordine delle trascrizioni, tutte senza token:
1. sottotitoli automatici YouTube in italiano (yt-dlp);
2. trascrizione pubblicata nel feed (tag podcast:transcript);
3. Whisper locale (faster-whisper, extra opzionale) sull'mp3 del feed.
"""
from __future__ import annotations

import difflib
import re
import tempfile
from dataclasses import dataclass
from datetime import datetime
from email.utils import parsedate_to_datetime
from pathlib import Path

from defusedxml import ElementTree as ET

from analysis.transcript import clean_any, segments_to_text
from collectors.base import ok, unavailable
from intel import http

NS = {
    "itunes": "http://www.itunes.com/dtds/podcast-1.0.dtd",
    "podcast": "https://podcastindex.org/namespace/1.0",
}
LOOKUP = "https://itunes.apple.com/lookup?id={id}"


@dataclass
class Episode:
    guid: str
    title: str
    published: datetime
    slot: str            # mattina | sera
    audio_url: str
    link: str
    duration: str
    transcripts: list[tuple[str, str]]   # (url, mime)


def discover_feed(cfg, state) -> dict:
    pc = cfg.section("podcast")
    if pc.get("feed_url"):
        return ok(pc["feed_url"], "config.yaml")
    cached = state.get("podcast.feed_url")
    if cached:
        return ok(cached, "cache")
    url = LOOKUP.format(id=pc.get("apple_id", 1648334875))
    try:
        r = http.get(url)
        r.raise_for_status()
        res = r.json().get("results") or []
    except Exception as e:  # noqa: BLE001 - qualsiasi guasto diventa "non disponibile"
        return unavailable(f"itunes lookup fallito: {e}", url)
    if not res or not res[0].get("feedUrl"):
        return unavailable("itunes lookup senza feedUrl", url)
    name = res[0].get("collectionName", "")
    if "black box" not in name.lower():
        return unavailable(f"l'id Apple corrisponde a «{name}», non a Black Box", url)
    state.set("podcast.feed_url", res[0]["feedUrl"])
    return ok(res[0]["feedUrl"], url)


def slot_of(title: str, morning_suffix: str) -> str:
    return "mattina" if title.strip().lower().endswith(morning_suffix.strip().lower()) else "sera"


def fetch_episodes(cfg, feed_url: str, limit: int = 10) -> dict:
    try:
        r = http.get(feed_url, timeout=30)
        r.raise_for_status()
        root = ET.fromstring(r.content)
    except Exception as e:  # noqa: BLE001
        return unavailable(f"feed non leggibile: {e}", feed_url)
    suffix = cfg.section("podcast").get("morning_suffix", "| Morning Finance")
    eps = []
    for it in root.iter("item"):
        title = (it.findtext("title") or "").strip()
        enc = it.find("enclosure")
        try:
            pub = parsedate_to_datetime(it.findtext("pubDate") or "")
        except (TypeError, ValueError):
            continue
        eps.append(Episode(
            guid=(it.findtext("guid") or (enc.get("url") if enc is not None else title)).strip(),
            title=title,
            published=pub,
            slot=slot_of(title, suffix),
            audio_url=enc.get("url", "") if enc is not None else "",
            link=(it.findtext("link") or "").strip(),
            duration=it.findtext("itunes:duration", default="", namespaces=NS),
            transcripts=[(t.get("url", ""), t.get("type", ""))
                         for t in it.findall("podcast:transcript", NS) if t.get("url")],
        ))
    eps.sort(key=lambda e: e.published, reverse=True)
    return ok(eps[:limit], feed_url)


# --- trascrizioni ---------------------------------------------------------

def _norm(s: str) -> str:
    s = s.lower().split("|")[0]
    return re.sub(r"[^\w\s]", " ", s).strip()


def find_youtube_video(cfg, ep: Episode) -> tuple[str, str] | None:
    """Ritorna (url_video, titolo) della puntata su YouTube, o None."""
    import yt_dlp

    channel = cfg.section("podcast").get("youtube_channel_url", "").rstrip("/")
    source = f"{channel}/videos" if channel else f"ytsearch10:Black Box Chora {_norm(ep.title)}"
    opts = {"quiet": True, "no_warnings": True, "extract_flat": True, "playlistend": 20, "skip_download": True}
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(source, download=False)
    best, best_score = None, 0.0
    for e in info.get("entries") or []:
        score = difflib.SequenceMatcher(None, _norm(ep.title), _norm(e.get("title") or "")).ratio()
        if score > best_score:
            best, best_score = e, score
    # soglia prudente: meglio nessun video che i sottotitoli della puntata sbagliata
    if not best or best_score < 0.6:
        return None
    url = best.get("url") or f"https://www.youtube.com/watch?v={best.get('id')}"
    return url, best.get("title", "")


def youtube_subs(cfg, ep: Episode) -> dict:
    try:
        import yt_dlp

        found = find_youtube_video(cfg, ep)
        if not found:
            return unavailable("video della puntata non trovato su YouTube")
        url, _ = found
        with tempfile.TemporaryDirectory() as tmp:
            opts = {"quiet": True, "no_warnings": True, "skip_download": True,
                    "writesubtitles": True, "writeautomaticsub": True,
                    "subtitleslangs": ["it", "it-orig"], "subtitlesformat": "vtt",
                    "outtmpl": str(Path(tmp) / "sub.%(ext)s")}
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([url])
            files = sorted(Path(tmp).glob("sub*.vtt"))
            if not files:
                return unavailable("nessun sottotitolo italiano sul video", url)
            text = clean_any(files[0].read_text(encoding="utf-8"), "vtt")
        return ok(text, url) if text else unavailable("sottotitoli vuoti", url)
    except Exception as e:  # noqa: BLE001
        return unavailable(f"yt-dlp: {e}")


def feed_transcript(ep: Episode) -> dict:
    if not ep.transcripts:
        return unavailable("il feed non pubblica una trascrizione per questa puntata")
    order = ["text/vtt", "application/x-subrip", "application/srt", "application/json", "text/plain", "text/html"]
    ranked = sorted(ep.transcripts, key=lambda t: order.index(t[1]) if t[1] in order else len(order))
    for url, mime in ranked:
        try:
            r = http.get(url, timeout=30)
            r.raise_for_status()
            text = clean_any(r.text, mime)
            if text:
                return ok(text, url)
        except Exception:  # noqa: BLE001
            continue
    return unavailable("trascrizioni del feed non scaricabili", ranked[0][0])


def whisper_transcript(cfg, ep: Episode) -> dict:
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        return unavailable("faster-whisper non installato (uv sync --extra whisper)")
    if not ep.audio_url:
        return unavailable("nessun mp3 nel feed")
    model_name = cfg.section("podcast").get("whisper_model", "base")
    try:
        with tempfile.TemporaryDirectory() as tmp:
            mp3 = Path(tmp) / "ep.mp3"
            r = http.get(ep.audio_url, timeout=120)
            r.raise_for_status()
            mp3.write_bytes(r.content)
            model = WhisperModel(model_name, device="cpu", compute_type="int8",
                                 download_root=str(cfg.root / "models" / "whisper"))
            segments, _ = model.transcribe(str(mp3), language="it", vad_filter=True)
            text = segments_to_text(list(segments))
        return ok(text, ep.audio_url) if text else unavailable("Whisper ha prodotto testo vuoto", ep.audio_url)
    except Exception as e:  # noqa: BLE001
        return unavailable(f"Whisper: {e}", ep.audio_url)


def get_transcript(cfg, ep: Episode) -> tuple[dict, str, list[str]]:
    """Prova le tre fonti in ordine. Ritorna (risultato, metodo, motivi dei fallimenti)."""
    tried = []
    for name, fn in (("youtube", lambda: youtube_subs(cfg, ep)),
                     ("feed", lambda: feed_transcript(ep)),
                     ("whisper", lambda: whisper_transcript(cfg, ep))):
        res = fn()
        if res["status"] == "ok":
            return res, name, tried
        tried.append(f"{name}: {res['status']}")
    return unavailable("; ".join(tried)), "", tried
