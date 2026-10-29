"""Modulo 1: sintesi delle puntate (1 chiamata LLM economica, in cache) e
collegamenti ai titoli del CSV (Python, zero token)."""
from __future__ import annotations

import json
import re

from intel import llm

PROMPT_MATTINA = """Trascrizione della puntata "{title}" ({date}) del podcast Black Box, Morning Finance.
I marcatori [mm:ss] sono i timestamp.

Restituisci questo JSON:
{{"sintesi": ["5-8 punti, max 30 parole ciascuno"],
  "non_chiaro": ["passaggi della trascrizione incomprensibili o ambigui, se ce ne sono"]}}

Regole: solo ciò che è detto nella puntata, niente conoscenze esterne. Nessun consiglio di investimento.

TRASCRIZIONE:
{text}"""

PROMPT_SERA = """Trascrizione della puntata serale "{title}" ({date}) del podcast Black Box (Guido Brera, Raffaele Coriglione).
I marcatori [mm:ss] sono i timestamp.

Restituisci questo JSON:
{{"sintesi": ["5-8 punti, max 30 parole ciascuno"],
  "tesi_centrale": "la tesi della puntata in 2 frasi",
  "segnali": [{{"timestamp": "mm:ss", "citazione": "max 25 parole, testuale",
               "asset_o_tema": "...", "tipo": "esplicito|implicito"}}],
  "non_chiaro": ["passaggi incomprensibili o ambigui, se ce ne sono"]}}

"segnali" = ogni passaggio in cui dicono come potrebbero andare le cose, cosa fanno o scrivono
le grandi banche, dove si muove il capitale, quali rotazioni vedono. Massimo 12.
"esplicito" se lo dicono chiaramente, "implicito" se si deduce dal discorso.
Regole: solo ciò che è detto nella puntata, niente conoscenze esterne. Citazioni testuali.

TRASCRIZIONE:
{text}"""


def summarize(cfg, state, ep, transcript: str, method: str) -> dict:
    """Sintesi in cache: una puntata già elaborata non si rielabora mai."""
    cached = state.get_episode(ep.guid)
    if cached:
        return {**cached["summary"], "_tokens_in": 0, "_tokens_out": 0, "_cached": True}
    max_chars = cfg.section("podcast").get("max_transcript_chars", 60000)
    truncated = len(transcript) > max_chars
    tpl = PROMPT_SERA if ep.slot == "sera" else PROMPT_MATTINA
    prompt = tpl.format(title=ep.title, date=ep.published.strftime("%d/%m/%Y"), text=transcript[:max_chars])
    max_out = cfg.section("llm").get("max_output_tokens_podcast", 1500)
    res = llm.call(cfg, prompt, purpose=f"podcast-{ep.slot}", cheap=True, max_out=max_out)
    try:
        summary = llm.parse_json(res.text)
    except (ValueError, llm.LLMError) as e:
        # la risposta grezza resta su disco: senza non si capisce perché il JSON è rotto
        dump = cfg.data_dir / f"llm-fail-{ep.published:%Y%m%d-%H%M}-{ep.slot}.json"
        dump.write_text(json.dumps({"error": str(e), "text": res.text, "meta": res.meta},
                                   ensure_ascii=False, indent=1), encoding="utf-8")
        summary = {"sintesi": [], "non_chiaro": [f"risposta del modello non in JSON ({e}): sintesi non disponibile, "
                                                 f"risposta grezza in {dump.name}"]}
    if truncated:
        summary.setdefault("non_chiaro", []).append(
            f"trascrizione tagliata a {max_chars} caratteri su {len(transcript)}")
    if summary.get("sintesi"):
        state.save_episode(ep.guid, ep.title, ep.published.isoformat(), ep.slot, method,
                           summary, res.tokens_in, res.tokens_out)
    return {**summary, "_tokens_in": res.tokens_in, "_tokens_out": res.tokens_out, "_cached": False}


def _contains(text: str, kw: str) -> bool:
    kw = kw.lower()
    if kw.startswith(" ") or kw.endswith(" "):   # parola isolata, es. " ai "
        return f" {kw.strip()} " in f" {text} "
    return re.search(r"\b" + re.escape(kw), text) is not None


def link_tickers(cfg, transcript: str) -> list[dict]:
    """Per ogni titolo: citato direttamente o toccato da un tema. Con timestamp di esempio."""
    themes = cfg.raw.get("themes") or {}
    low = re.sub(r"[^\w\s\[\]:]", " ", transcript.lower())
    chunks = re.split(r"(?=\[\d{1,2}:\d{2}(?::\d{2})?\])", low)

    def where(kw: str) -> list[str]:
        out = []
        for c in chunks:
            m = re.match(r"\[([\d:]+)\]", c)
            if m and _contains(c, kw):
                out.append(m.group(1))
        return out

    links = []
    for p in cfg.positions:
        direct = sorted({ts for a in p.alias for ts in where(a)})
        if direct:
            links.append({"ticker": p.ticker, "tipo": "citato direttamente", "dettaglio": ", ".join(p.alias),
                          "timestamp": direct[:5]})
            continue
        hits = {}
        for t in p.temi:
            ts = sorted({x for kw in themes.get(t, []) for x in where(kw)})
            if ts:
                hits[t] = ts
        if hits:
            links.append({"ticker": p.ticker, "tipo": "toccato da tema", "dettaglio": ", ".join(hits),
                          "timestamp": sorted({x for v in hits.values() for x in v})[:5]})
    return links
