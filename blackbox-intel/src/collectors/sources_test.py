"""`intel test-sources`: una chiamata reale per ogni fonte, prima di costruirci sopra."""
from __future__ import annotations

import os
import time
from datetime import date, timedelta

from defusedxml import ElementTree as ET

from intel import http

XOOMAR = "https://xoomar.com/api/markets"


def _get(url, **kw):
    r = http.get(url, retries=2, **kw)
    return r


def _http_ok(url, expect: str = "", **kw):
    r = _get(url, **kw)
    if r.status_code != 200:
        return False, f"HTTP {r.status_code}"
    if expect and expect not in r.text[:200000]:
        return False, f"HTTP 200 ma contenuto inatteso (manca «{expect}»)"
    return True, f"HTTP 200, {len(r.content) // 1024} KB"


def _json_ok(url, check=None, **kw):
    r = _get(url, **kw)
    if r.status_code != 200:
        return False, f"HTTP {r.status_code}: {r.text[:80]!r}"
    try:
        d = r.json()
    except ValueError:
        return False, "HTTP 200 ma risposta non JSON (probabile pagina di blocco)"
    if check:
        return check(d)
    return True, "HTTP 200, JSON valido"


def _rss_ok(url, **kw):
    r = _get(url, **kw)
    if r.status_code != 200:
        return False, f"HTTP {r.status_code}"
    try:
        root = ET.fromstring(r.content)
    except ET.ParseError:
        return False, "HTTP 200 ma non è XML"
    n = len(list(root.iter("item"))) + len(list(root.iter("{http://www.w3.org/2005/Atom}entry")))
    return (n > 0), f"{n} elementi"


# --- singoli test -----------------------------------------------------------

def t_itunes(cfg, state):
    from collectors.podcast import discover_feed
    state.set("podcast.feed_url", None)  # forza una chiamata reale
    res = discover_feed(cfg, state)
    return res["status"] == "ok", res["data"] if res["status"] == "ok" else res["status"]


def t_feed(cfg, state):
    from collectors.podcast import discover_feed, fetch_episodes
    f = discover_feed(cfg, state)
    if f["status"] != "ok":
        return False, "feed sconosciuto"
    res = fetch_episodes(cfg, f["data"], limit=5)
    if res["status"] != "ok":
        return False, res["status"]
    eps = res["data"]
    if not eps:
        return False, "feed vuoto"
    tr = sum(1 for e in eps if e.transcripts)
    last = eps[0]
    return True, (f"ultima: «{last.title[:50]}» {last.published:%d/%m %H:%M}; "
                  f"trascrizioni nel feed: {tr}/{len(eps)}")


def t_youtube(cfg, state):
    from collectors.podcast import discover_feed, fetch_episodes, find_youtube_video
    f = discover_feed(cfg, state)
    eps = fetch_episodes(cfg, f["data"], limit=1)["data"] if f["status"] == "ok" else None
    if not eps:
        return False, "nessuna puntata da cercare"
    try:
        found = find_youtube_video(cfg, eps[0])
    except Exception as e:  # noqa: BLE001
        return False, f"yt-dlp: {str(e)[:120]}"
    return (bool(found), f"trovato: {found[0]}" if found else "video dell'ultima puntata non trovato")


def t_whisper(cfg, state):
    try:
        import faster_whisper  # noqa: F401
        return True, "installato"
    except ImportError:
        return False, "non installato: serve solo se mancano sottotitoli e trascrizione (uv sync --extra whisper)"


def t_claude(cfg, state):
    from intel.llm import find_claude
    exe = find_claude()
    return bool(exe), exe or "comando `claude` non nel PATH né in ~/.local/bin"


def t_ollama(cfg, state):
    url = cfg.section("llm").get("ollama_url", "http://localhost:11434")
    try:
        return _json_ok(f"{url}/api/tags", lambda d: (True, f"{len(d.get('models', []))} modelli locali"), timeout=3)
    except Exception:  # noqa: BLE001
        return False, "non in esecuzione (opzionale)"


def t_yahoo(cfg, state):
    return _json_ok("https://query1.finance.yahoo.com/v8/finance/chart/UBER?range=5d&interval=1d",
                    lambda d: (bool(d.get("chart", {}).get("result")), "prezzi UBER a 5 giorni"))


def t_yahoo_eu(cfg, state):
    return _json_ok("https://query1.finance.yahoo.com/v8/finance/chart/PRY.MI?range=5d&interval=1d",
                    lambda d: (bool(d.get("chart", {}).get("result")), "prezzi PRY.MI a 5 giorni"))


def t_gnews_en(cfg, state):
    return _rss_ok("https://news.google.com/rss/search?q=Uber+stock&hl=en-US&gl=US&ceid=US:en")


def t_gnews_it(cfg, state):
    return _rss_ok("https://news.google.com/rss/search?q=Prysmian&hl=it&gl=IT&ceid=IT:it")


def t_reddit_json(cfg, state):
    ok, why = _json_ok("https://www.reddit.com/r/stocks/hot.json?limit=5")
    return ok, why + (" (atteso: chiusi da maggio 2026)" if not ok else "")


def t_reddit_rss(cfg, state):
    return _rss_ok("https://www.reddit.com/r/stocks/.rss")


def t_reddit_oauth(cfg, state):
    if not os.environ.get("REDDIT_CLIENT_ID"):
        return False, "credenziali REDDIT_* non impostate in .env (opzionale)"
    import requests
    r = requests.post("https://www.reddit.com/api/v1/access_token", timeout=20,
                      auth=(os.environ["REDDIT_CLIENT_ID"], os.environ.get("REDDIT_CLIENT_SECRET", "")),
                      data={"grant_type": "client_credentials"},
                      headers={"User-Agent": f"windows:blackbox-intel:0.1 (by /u/{os.environ.get('REDDIT_USERNAME', 'unknown')})"})
    return r.status_code == 200 and "access_token" in r.text, f"HTTP {r.status_code}"


def t_apewisdom(cfg, state):
    return _json_ok("https://apewisdom.io/api/v1.0/filter/all-stocks/page/1",
                    lambda d: (bool(d.get("results")), f"{len(d.get('results', []))} ticker con menzioni"))


def t_stocktwits(cfg, state):
    return _json_ok("https://api.stocktwits.com/api/2/streams/symbol/UBER.json",
                    lambda d: (bool(d.get("messages")), f"{len(d.get('messages', []))} messaggi"))


def t_cnn_fg(cfg, state):
    return _json_ok("https://production.dataviz.cnn.io/index/fearandgreed/graphdata",
                    lambda d: ("fear_and_greed" in d, f"score {d.get('fear_and_greed', {}).get('score', '?'):.0f}"
                               if isinstance(d.get("fear_and_greed", {}).get("score"), (int, float)) else "formato cambiato"))


def t_vix(cfg, state):
    return _http_ok("https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv", expect="DATE")


def t_putcall(cfg, state):
    d = date.today() - timedelta(days=1)
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    return _json_ok(f"https://cdn.cboe.com/data/us/options/market_statistics/daily/{d.isoformat()}_daily_options",
                    lambda j: _putcall_ratio(j, d))


def _putcall_ratio(j, d):
    r = {x.get("name"): x.get("value") for x in j.get("ratios") or []}
    if "TOTAL PUT/CALL RATIO" not in r:
        return False, "JSON senza TOTAL PUT/CALL RATIO (formato cambiato)"
    return True, f"put/call totale {r['TOTAL PUT/CALL RATIO']}, equity {r.get('EQUITY PUT/CALL RATIO', '?')} del {d:%d/%m}"


def t_polymarket(cfg, state):
    return _json_ok("https://gamma-api.polymarket.com/markets?limit=5&closed=false",
                    lambda d: (isinstance(d, list) and len(d) > 0, f"{len(d)} mercati"))


def t_sec(cfg, state):
    ua = cfg.sec_user_agent
    if not ua or "@" not in ua:
        return False, "SEC_USER_AGENT con email mancante in .env"
    return _json_ok("https://data.sec.gov/submissions/CIK0001543151.json",
                    lambda d: (d.get("name", "").upper().startswith("UBER"), d.get("name", "?")),
                    headers={"User-Agent": ua})


def t_xoomar_insiders(cfg, state):
    return _json_ok(f"{XOOMAR}/insiders/uber",
                    lambda d: (True, f"{len(d.get('data') or [])} righe Form 4"), headers={"Accept": "application/json"})


def t_xoomar_si(cfg, state):
    time.sleep(6)  # 10 richieste al minuto senza chiave
    return _json_ok(f"{XOOMAR}/short-interest?symbol=UBER",
                    lambda d: (True, "short interest FINRA UBER"), headers={"Accept": "application/json"})


def t_xoomar_13f(cfg, state):
    # xoomar non ha i holder 13F per titolo (solo per gestore, /funds/{slug}):
    # per titolo ci sono i 13D/13G sopra il 5%.
    time.sleep(6)
    return _json_ok(f"{XOOMAR}/large-holders?symbol=UBER&form=13G&days=365",
                    lambda d: (bool(d.get("data")), f"{len(d.get('data') or [])} filing 13G UBER in 365 giorni"),
                    headers={"Accept": "application/json"})


def t_xoomar_earnings(cfg, state):
    time.sleep(6)
    return _json_ok(f"{XOOMAR}/earnings/uber",
                    lambda d: (True, "calendario utili UBER"), headers={"Accept": "application/json"})


def t_xoomar_cot(cfg, state):
    time.sleep(6)
    # slug dall'elenco /api/markets/cot
    return _json_ok(f"{XOOMAR}/cot/copper-grade-1",
                    lambda d: (bool(d.get("data")), f"COT rame, ultimo report {(d.get('data') or [{}])[0].get('reportDate', '?')}"),
                    headers={"Accept": "application/json"})


def t_cftc(cfg, state):
    return _json_ok("https://publicreporting.cftc.gov/resource/6dca-aqww.json?$limit=1"
                    "&$where=commodity_name='COPPER'&$order=report_date_as_yyyy_mm_dd DESC",
                    lambda d: (bool(d), f"ultimo report {d[0].get('report_date_as_yyyy_mm_dd', '?')[:10]}" if d else "vuoto"))


def t_consob(cfg, state):
    return _http_ok("https://www.consob.it/web/area-pubblica/pnc", expect="Posizioni nette corte")


def t_bafin(cfg, state):
    return _http_ok("https://www.bundesanzeiger.de/pub/de/nlp", expect="Netto-Leerverkaufspositionen")


def t_afm(cfg, state):
    # Solo raggiungibilità della pagina registro: il formato di download va verificato a mano.
    return _http_ok("https://www.afm.nl/en/sector/registers/meldingenregisters/netto-shortposities-actueel",
                    expect="Net short positions")


def t_notion(cfg, state):
    tok = os.environ.get("NOTION_TOKEN")
    if not tok:
        return False, "NOTION_TOKEN non impostato in .env"
    return _json_ok("https://api.notion.com/v1/users/me", lambda d: (True, d.get("name", "integrazione ok")),
                    headers={"Authorization": f"Bearer {tok}", "Notion-Version": "2022-06-28"})


CHECKS = [
    ("Apple Podcasts lookup (feed Black Box)", "podcast", t_itunes),
    ("Feed RSS Black Box", "podcast", t_feed),
    ("YouTube (yt-dlp)", "podcast", t_youtube),
    ("Whisper locale", "podcast", t_whisper),
    ("claude -p", "llm", t_claude),
    ("Ollama", "llm", t_ollama),
    ("Yahoo Finance US", "news", t_yahoo),
    ("Yahoo Finance EU (.MI)", "news", t_yahoo_eu),
    ("Google News RSS EN", "news", t_gnews_en),
    ("Google News RSS IT", "news", t_gnews_it),
    ("Reddit .json", "retail", t_reddit_json),
    ("Reddit RSS/Atom", "retail", t_reddit_rss),
    ("Reddit OAuth (script)", "retail", t_reddit_oauth),
    ("ApeWisdom", "retail", t_apewisdom),
    ("StockTwits", "retail", t_stocktwits),
    ("CNN Fear & Greed", "mercato", t_cnn_fg),
    ("CBOE VIX", "mercato", t_vix),
    ("CBOE put/call", "mercato", t_putcall),
    ("Polymarket Gamma", "mercato", t_polymarket),
    ("SEC EDGAR", "posizionamento", t_sec),
    ("xoomar Form 4", "posizionamento", t_xoomar_insiders),
    ("xoomar short interest", "posizionamento", t_xoomar_si),
    ("xoomar 13D/13G", "posizionamento", t_xoomar_13f),
    ("xoomar utili", "utili", t_xoomar_earnings),
    ("xoomar COT rame", "posizionamento", t_xoomar_cot),
    ("CFTC COT diretto", "posizionamento", t_cftc),
    ("Consob short", "posizionamento", t_consob),
    ("BaFin/Bundesanzeiger short", "posizionamento", t_bafin),
    ("AFM short", "posizionamento", t_afm),
    ("Notion API", "output", t_notion),
]


def run_all(cfg, state, only: str | None = None) -> list[tuple[str, str, bool, str]]:
    rows = []
    for name, group, fn in CHECKS:
        if only and only not in group:
            continue
        try:
            ok, why = fn(cfg, state)
        except Exception as e:  # noqa: BLE001
            ok, why = False, f"{type(e).__name__}: {str(e)[:120]}"
        why = str(why).split(" (Caused by")[0][:140]
        rows.append((group, name, ok, why))
        print(f"  {'OK ' if ok else 'NO '} {name}: {why}", flush=True)
    state.set("sources.last_test", [list(r) for r in rows])
    return rows
