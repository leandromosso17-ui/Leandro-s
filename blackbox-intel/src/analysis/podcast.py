"""Modulo 1: sintesi delle puntate (1 chiamata LLM economica, in cache) e
collegamenti ai titoli del CSV (Python, zero token)."""
from __future__ import annotations

import json
import re

from intel import llm

# Cambia quando cambia lo schema del JSON: le sintesi in cache con un'altra versione si rigenerano.
PROMPT_VERSION = 5

PROMPT = """Trascrizione della puntata "{title}" ({date}) del podcast Black Box{kind}.
I marcatori [mm:ss] sono i timestamp: non riportarli nel JSON.

Titoli che l'ascoltatore ha in portafoglio o in watchlist:
{assets}

Restituisci questo JSON:
{{"tesi_centrale": "la tesi della puntata in 2 frasi",
  "sintesi": ["5-8 punti, max 30 parole ciascuno"],
  "opportunita": [{{"idea": "titolo, settore, paese o tema", "cosa_dicono": "2-3 frasi"}}],
  "tuoi_asset": [{{"ticker": "ticker dall'elenco sopra", "concetti": ["un punto per ogni concetto detto"]}}],
  "bolla_ai": {{"livello_allarme": "nessuno|basso|medio|alto",
               "sintesi": "2-3 frasi: secondo gli ospiti la situazione è in allarme o no, e perché",
               "segnali_di_scoppio": ["max 3, una frase ciascuno"],
               "segnali_di_tenuta": ["max 3, una frase ciascuno"]}},
  "dubbi_importanti": ["solo se un passaggio chiave è incomprensibile e cambia il senso di un punto"]}}

La trascrizione viene da sottotitoli automatici: nomi di società, persone e prodotti sono spesso
storpiati. Quando un nome non torna, confrontalo con nomi reali simili e usa quello coerente con il
contesto della puntata (settore, prodotto, numeri, chi ne parla), in TUTTO il JSON. Questa è l'unica
eccezione alla regola "niente conoscenze esterne". Questi nomi sono sicuramente corretti: {glossario}.
"dubbi_importanti": quasi sempre vuoto. Non segnalare cifre o nomi minori poco chiari.

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

def _assets_block(cfg) -> str:
    return "\n".join(f"- {p.ticker}: {p.nome} ({p.tipo})" for p in cfg.positions)


def fix_names(cfg, text: str) -> str:
    """Errori ricorrenti dei sottotitoli da config.yaml (podcast.correzioni), zero token."""
    for wrong, right in (cfg.section("podcast").get("correzioni") or {}).items():
        text = re.sub(r"\b" + re.escape(str(wrong)) + r"\b", str(right), text, flags=re.I)
    return text


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
                           assets=_assets_block(cfg),
                           glossario=", ".join(cfg.section("podcast").get("glossario") or []),
                           text=transcript[:max_chars])
    max_out = cfg.section("llm").get("max_output_tokens_podcast", 1500)
    # la risposta grezza resta su disco: senza non si capisce perché il JSON è rotto
    dump = cfg.data_dir / f"llm-fail-{ep.published:%Y%m%d-%H%M}-{ep.slot}.json"

    def save_dump(e, r):
        dump.write_text(json.dumps({"error": str(e), "text": r.text, "meta": r.meta},
                                   ensure_ascii=False, indent=1), encoding="utf-8")

    try:
        res = llm.call(cfg, prompt, purpose=f"podcast-{ep.slot}", cheap=True, max_out=max_out)
    except llm.LLMError as e:
        if e.res:
            save_dump(e, e.res)
        raise
    try:
        summary = llm.parse_json(res.text)
    except (ValueError, llm.LLMError) as e:
        save_dump(e, res)
        summary = {"sintesi": [], "dubbi_importanti": [f"risposta del modello non in JSON ({e}): sintesi non "
                                                       f"disponibile, risposta grezza in {dump.name}"]}
    if truncated:
        summary.setdefault("dubbi_importanti", []).append(
            f"trascrizione tagliata a {max_chars} caratteri su {len(transcript)}: la fine della puntata manca")
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
