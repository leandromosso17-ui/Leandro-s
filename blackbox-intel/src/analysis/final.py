"""Seconda (e ultima) chiamata LLM del run, su un JSON compatto già calcolato in Python.

Produce: tesi a rischio, collegamenti podcast-titoli, domande sul portfolio, commento
agli utili appena usciti. Massimo ~8.000 token in ingresso (~4 caratteri per token).
"""
from __future__ import annotations

import json
import re

from intel import llm

MAX_CHARS = 32000

PROMPT = """Dati del digest di oggi in JSON (già calcolati: non ricalcolarli e non aggiungerne).

{data}

Restituisci questo JSON:
{{"tesi_a_rischio": [{{"ticker": "...", "news": "titolo della news dall'elenco", "perche": "1 frase"}}],
  "collegamenti_podcast": [{{"ticker": "...", "collegamento": "1-2 frasi: cosa del podcast tocca questo titolo"}}],
  "domande_portfolio": ["domanda", "..."],
  "utili": [{{"ticker": "...", "punti": ["risultati vs attese", "guidance", "reazione/contesto"]}}]}}

Regole:
- "tesi_a_rischio": solo titoli con "tesi" compilata, e solo se una delle loro news la mette in
  discussione. Lista vuota se nessuna.
- "collegamenti_podcast": solo titoli toccati da ciò che è detto nel podcast (campo "podcast");
  ometti del tutto i titoli senza collegamento.
- "domande_portfolio": massimo 5, formulate come domande, mai consigli ("vuoi rivedere...?").
- "utili": solo titoli con "utili_appena_usciti": true; 3 punti basati solo su numeri e news forniti.
  Se la guidance non è nei dati scrivi "guidance non presente nelle fonti".
- Mai "compra", "vendi" o target di prezzo. Niente dati che non sono nel JSON."""


def _short_banks(b: dict) -> str:
    if not b or b.get("status") != "ok":
        return ""
    c = b.get("consensus") or {}
    parts = [f"consenso {c.get('key') or 'n.d.'} ({c.get('direction', 'n.d.')} vs 3 mesi)"]
    for t in (b.get("top") or [])[:3]:
        cu = t["current"]
        parts.append(f"{t['bank']} {cu.get('rating') or ''} {cu.get('pt') or ''} {t['direction']}".strip())
    return "; ".join(parts)


def build(cfg, news: dict, retail_rows: dict, pos: dict, earn: dict, episodes: list[dict], port: dict) -> dict:
    w = (port.get("weights") or {}).get("w") or {}
    tickers = []
    for p in cfg.positions:
        n = news.get(p.ticker) or {}
        px = (n.get("price") or {}).get("data") or {}
        r = retail_rows.get(p.ticker) or {}
        ape = r.get("ape") or {}
        st = ((r.get("stocktwits") or {}).get("data") or {})
        e = (earn.get(p.ticker) or {})
        item = {
            "ticker": p.ticker, "nome": p.nome, "tipo": p.tipo, "tesi": p.tesi or None,
            "peso": round(w[p.ticker] * 100, 1) if p.ticker in w else None,
            "var_1g": round(px["chg_1d"], 1) if px.get("chg_1d") is not None else None,
            "var_5g": round(px["chg_5d"], 1) if px.get("chg_5d") is not None else None,
            "news": [{"titolo": x["title"][:160], "fonte": x["source"], "data": f"{x['published']:%d/%m}",
                      "sentiment": x.get("sentiment")} for x in (n.get("top_news") or [])[:3]],
            "banche": _short_banks(n.get("banks") or {}),
            "retail": (f"Reddit 24h {ape.get('mentions')} (ieri {ape.get('mentions_24h_ago')})" if ape else "")
                      + (f"; StockTwits {st.get('bullish')} bull/{st.get('bearish')} bear" if st else ""),
            "utili_appena_usciti": bool(e.get("just_reported")),
        }
        if e.get("just_reported"):
            item["eps"] = {"trimestre": e.get("last_quarter"), "effettivo": e.get("last_eps"),
                           "atteso": e.get("last_eps_est"), "sorpresa_pct": e.get("last_surprise_pct")}
        tickers.append({k: v for k, v in item.items() if v not in (None, "", [])})
    pod = []
    for ep in episodes:
        s = ep.get("summary") or {}
        pod.append({"puntata": ep.get("title", "")[:100], "slot": ep.get("slot"),
                    "sintesi": (s.get("sintesi") or [])[:8],
                    "tuoi_asset": [{"ticker": a.get("ticker"), "concetti": (a.get("concetti") or [])[:4]}
                                   for a in s.get("tuoi_asset") or [] if a.get("concetti")],
                    "bolla_ai": (s.get("bolla_ai") or {}).get("livello_allarme")})
    data = {"titoli": tickers, "podcast": pod, "temi_del_giorno": port.get("touched") or {}}
    # sotto il tetto: prima si taglia a 2 news per titolo, poi si accorcia il podcast
    for step in range(3):
        if len(json.dumps(data, ensure_ascii=False)) <= MAX_CHARS:
            break
        if step == 0:
            for t in data["titoli"]:
                t["news"] = t.get("news", [])[:2]
        else:
            for ep in data["podcast"]:
                ep["sintesi"] = ep["sintesi"][:4]
    return data


def call(cfg, data: dict) -> dict:
    text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    max_out = cfg.section("llm").get("max_output_tokens_final", 16000)
    try:
        res = llm.call(cfg, PROMPT.format(data=text), purpose="finale", cheap=False, max_out=max_out)
        out = llm.parse_json(res.text)
    except (llm.LLMError, ValueError) as e:
        return {"error": str(e), "chars_in": len(text)}
    out["_tokens_in"], out["_tokens_out"] = res.tokens_in, res.tokens_out
    tesi = {t["ticker"] for t in data["titoli"] if t.get("tesi")}
    out["tesi_a_rischio"] = [x for x in out.get("tesi_a_rischio") or [] if x.get("ticker") in tesi]
    out["collegamenti_podcast"] = [x for x in out.get("collegamenti_podcast") or []
                                   if not re.search(r"non (?:cita|tocca|parla)|nessun collegamento",
                                                    x.get("collegamento", ""), re.I)]
    return out
