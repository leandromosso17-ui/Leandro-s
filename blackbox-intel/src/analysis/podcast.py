"""Modulo 1: sintesi delle puntate (1 chiamata LLM economica, in cache) e
collegamenti ai titoli del CSV (Python, zero token)."""
from __future__ import annotations

import json
import re

from intel import llm

# Cambia quando cambia lo schema del JSON: le sintesi in cache con un'altra versione si rigenerano.
PROMPT_VERSION = 2

PROMPT = """Trascrizione della puntata "{title}" ({date}) del podcast Black Box{kind}.
I marcatori [mm:ss] sono i timestamp.

Titoli che l'ascoltatore ha in portafoglio o in watchlist:
{assets}

Restituisci questo JSON:
{{"sintesi": ["5-8 punti, max 30 parole ciascuno"],{tesi}
  "tuoi_asset": [{{"ticker": "ticker dall'elenco sopra", "timestamp": ["mm:ss"],
                  "concetti": ["un punto per ogni concetto detto"]}}],
  "opportunita": [{{"idea": "titolo, settore, paese o tema", "timestamp": "mm:ss",
                   "cosa_dicono": "2-3 frasi"}}],
  "bolla_ai": {{"livello_allarme": "nessuno|basso|medio|alto",
               "come_la_descrivono": "1-2 frasi: in che fase vedono il ciclo dell'IA",
               "segnali_di_scoppio": [{{"timestamp": "mm:ss", "concetto": "..."}}],
               "segnali_di_tenuta": [{{"timestamp": "mm:ss", "concetto": "..."}}]}},
  "non_chiaro": ["passaggi incomprensibili o ambigui, se ce ne sono"]}}

"tuoi_asset": solo i titoli dell'elenco di cui si parla, direttamente o tramite il loro paese, settore
o materia prima (es. Brasile per l'ETF Brasile, rame per l'ETC rame). Qui NON sintetizzare: riporta
TUTTI i concetti detti su quell'asset, con parole tue ma senza perderne nessuno (numeri, cause,
previsioni, rischi, chi lo dice). Includi solo i titoli di cui si parla davvero: lista vuota se nessuno.
"opportunita": idee e temi d'investimento nuovi, fuori dall'elenco, che gli ospiti segnalano come
interessanti, in crescita o da tenere d'occhio. Lista vuota se non ce ne sono.
"bolla_ai": cosa dicono su una possibile bolla dell'intelligenza artificiale (valutazioni, capex,
debito, ingegneria finanziaria, concentrazione, domanda reale, segnali da Cina o altri mercati).
"livello_allarme" è quanto si dicono preoccupati LORO, non una tua valutazione; "nessuno" e liste
vuote se l'argomento non viene toccato.
Regole: solo ciò che è detto nella puntata, niente conoscenze esterne. Nessun consiglio di investimento.

TRASCRIZIONE:
{text}"""

TESI = '\n  "tesi_centrale": "la tesi della puntata in 2 frasi",'


def _assets_block(cfg) -> str:
    return "\n".join(f"- {p.ticker}: {p.nome} ({p.tipo})" for p in cfg.positions)


def summarize(cfg, state, ep, transcript: str, method: str) -> dict:
    """Sintesi in cache: una puntata già elaborata non si rielabora mai."""
    cached = state.get_episode(ep.guid)
    if cached and cached["summary"].get("_v") == PROMPT_VERSION:
        return {**cached["summary"], "_tokens_in": 0, "_tokens_out": 0, "_cached": True}
    max_chars = cfg.section("podcast").get("max_transcript_chars", 60000)
    truncated = len(transcript) > max_chars
    sera = ep.slot == "sera"
    prompt = PROMPT.format(title=ep.title, date=ep.published.strftime("%d/%m/%Y"),
                           kind=" (puntata serale, Guido Brera e Raffaele Coriglione)" if sera else ", Morning Finance",
                           assets=_assets_block(cfg), tesi=TESI if sera else "", text=transcript[:max_chars])
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
        summary["_v"] = PROMPT_VERSION
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
