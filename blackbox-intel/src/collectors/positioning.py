"""Posizionamento: insider (Form 4), short interest FINRA, grandi azionisti 13D/13G,
posizioni corte nette dei regolatori europei, COT CFTC sul rame.

Fonti verificate il 29/10/2026. xoomar: 10 richieste al minuto senza chiave.
"""
from __future__ import annotations

import csv
import io
import re
import zipfile
from datetime import date, datetime, timedelta

from collectors.base import ok, unavailable
from intel import http

XOOMAR = "https://xoomar.com/api/markets"
JSON = {"Accept": "application/json"}
XOOMAR_GAP = 6.5  # secondi tra due richieste: 10 al minuto
SEC_SUBMISSIONS = "https://data.sec.gov/submissions/CIK{cik:010d}.json"
CONSOB_PAGE = "https://www.consob.it/web/area-pubblica/pnc"
BAFIN_PAGE = "https://www.bundesanzeiger.de/pub/de/nlp"
BAFIN_CSV = "https://www.bundesanzeiger.de/pub/de/nlp?0--top~csv~form~panel-form-csv~resource~link"
AFM_CSV = "https://www.afm.nl/export.aspx?type=8a46a4ef-f196-4467-a7ab-1ae1cb58f0e7&format=csv"
AFM_PAGE = "https://www.afm.nl/en/sector/registers/meldingenregisters/netto-shortposities-actueel"
CFTC = "https://publicreporting.cftc.gov/resource/6dca-aqww.json"


def _xoomar(path: str, params=None):
    return http.get(f"{XOOMAR}{path}", params=params, headers=JSON, min_interval=XOOMAR_GAP)


def _f(v) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


# --- USA -------------------------------------------------------------------------

def insiders(ticker: str, days: int = 90) -> dict:
    """Acquisti (P) e vendite (S) sul mercato aperto degli ultimi `days` giorni."""
    since = (date.today() - timedelta(days=days)).isoformat()
    url = f"{XOOMAR}/insiders/{ticker.lower()}"
    try:
        r = _xoomar(f"/insiders/{ticker.lower()}", {"from": since})
        r.raise_for_status()
        tx = (r.json().get("data") or {}).get("transactions") or []
    except Exception as e:  # noqa: BLE001
        return unavailable(f"xoomar Form 4: {e}", url)
    rows = [{"name": t.get("insiderName", ""), "title": t.get("insiderTitle", ""), "date": t.get("txDate", ""),
             "side": "acquisto" if t.get("txCode") == "P" else "vendita",
             "shares": _f(t.get("shares")), "value": _f(t.get("valueUsd"))}
            for t in tx if t.get("isOpenMarket") and t.get("txCode") in ("P", "S") and t.get("txDate", "") >= since]
    return ok(rows, f"https://xoomar.com/markets/stocks/{ticker.lower()}")


def sec_form4_count(cik: int, ua: str, days: int = 90) -> dict:
    """Riserva se xoomar non risponde: quanti Form 4 depositati (senza direzione)."""
    url = SEC_SUBMISSIONS.format(cik=cik)
    try:
        r = http.get(url, headers={"User-Agent": ua}, min_interval=0.2)
        r.raise_for_status()
        rec = r.json()["filings"]["recent"]
    except Exception as e:  # noqa: BLE001
        return unavailable(f"SEC EDGAR: {e}", url)
    since = (date.today() - timedelta(days=days)).isoformat()
    n = sum(1 for f, d in zip(rec["form"], rec["filingDate"]) if f == "4" and d >= since)
    return ok({"form4": n}, url)


def short_interest(ticker: str) -> dict:
    """Short interest FINRA bimensile (non lo short volume giornaliero, che non è una posizione)."""
    try:
        r = _xoomar("/short-interest", {"symbol": ticker})
        r.raise_for_status()
        rows = r.json().get("data") or []
    except Exception as e:  # noqa: BLE001
        return unavailable(f"xoomar short interest: {e}", f"{XOOMAR}/short-interest")
    if not rows:
        return unavailable("nessun dato FINRA", f"{XOOMAR}/short-interest")
    last = rows[0]
    return ok({"date": last.get("settlementDate"), "shares": last.get("shortQty"),
               "days_to_cover": _f(last.get("daysToCover")), "chg_pct": _f(last.get("changePct")),
               "prev_date": rows[1].get("settlementDate") if len(rows) > 1 else None},
              last.get("canonicalUrl") or f"{XOOMAR}/short-interest")


def large_holders(ticker: str) -> dict:
    """Schedule 13D/13G (quote oltre il 5%) dell'ultimo anno."""
    out = []
    try:
        for form in ("13G", "13D"):
            r = _xoomar("/large-holders", {"symbol": ticker, "form": form, "days": 365, "sort": "filed"})
            r.raise_for_status()
            out += r.json().get("data") or []
    except Exception as e:  # noqa: BLE001
        if not out:
            return unavailable(f"xoomar 13D/13G: {e}", f"{XOOMAR}/large-holders")
    latest: dict[str, dict] = {}
    for x in sorted(out, key=lambda x: x.get("filedAt", "")):
        latest[x.get("reportingPerson", "?")] = x   # tiene il deposito più recente per holder
    rows = sorted(({"holder": k, "pct": _f(v.get("percentOfClass")), "form": v.get("formType", ""),
                    "event": v.get("eventDate", ""), "filed": v.get("filedAt", "")} for k, v in latest.items()),
                  key=lambda x: x["pct"], reverse=True)
    return ok(rows, f"https://xoomar.com/markets/stocks/{ticker.lower()}")


# --- Europa: posizioni corte nette sopra lo 0,5% ---------------------------------

def _xlsx_rows(content: bytes, sheet: int = 1) -> list[dict[str, str]]:
    """Righe come {lettera colonna: valore}: le celle vuote non spostano le colonne."""
    # lettore xlsx minimo (zipfile + regex): basta per la tabella Consob, niente dipendenze
    z = zipfile.ZipFile(io.BytesIO(content))
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in re.findall(r"<si>(.*?)</si>", z.read("xl/sharedStrings.xml").decode("utf-8"), re.S):
            shared.append("".join(re.findall(r"<t[^>]*>([^<]*)</t>", si)))
    xml = z.read(f"xl/worksheets/sheet{sheet}.xml").decode("utf-8")
    rows = []
    for row in re.findall(r"<row[^>]*>(.*?)</row>", xml, re.S):
        cells = {}
        for ref, attrs, body in re.findall(r'<c r="([A-Z]+)\d+"([^>]*)>(.*?)</c>', row, re.S):
            v = re.search(r"<v>([^<]*)</v>", body)
            inline = re.search(r"<t[^>]*>([^<]*)</t>", body)
            val = shared[int(v.group(1))] if v and 't="s"' in attrs else (v.group(1) if v else (inline.group(1) if inline else ""))
            cells[ref] = val
        rows.append(cells)
    return rows


def _excel_date(v: str) -> str:
    try:
        return (date(1899, 12, 30) + timedelta(days=float(v))).isoformat()
    except ValueError:
        return v[:10]


def consob() -> dict:
    try:
        page = http.get(CONSOB_PAGE)
        m = re.search(r'href="([^"]+PncPubbl\.xlsx[^"]*)"', page.text)
        if not m:
            return unavailable("link al file xlsx non trovato nella pagina Consob", CONSOB_PAGE)
        r = http.get("https://www.consob.it" + m.group(1), timeout=60)
        r.raise_for_status()
        rows = _xlsx_rows(r.content, 1)
    except Exception as e:  # noqa: BLE001
        return unavailable(f"Consob: {e}", CONSOB_PAGE)
    # colonne: A detentore, C emittente, E ISIN, F % posizione netta corta, G data
    out = [{"holder": x.get("A", ""), "issuer": x.get("C", ""), "isin": x.get("E", ""),
            "pct": _f(x.get("F", "").replace(",", ".")), "date": _excel_date(x.get("G", "")), "reg": "Consob"}
           for x in rows if x.get("C") and _f(x.get("F", "").replace(",", ".")) > 0]
    return ok(out, CONSOB_PAGE)


def bafin() -> dict:
    try:
        s = __import__("requests").Session()
        http.get(BAFIN_PAGE, session=s)  # la pagina imposta la sessione per il link CSV
        r = http.get(BAFIN_CSV, session=s, timeout=60)
        r.raise_for_status()
        rows = list(csv.DictReader(io.StringIO(r.content.decode("utf-8-sig", "replace"))))
    except Exception as e:  # noqa: BLE001
        return unavailable(f"BaFin/Bundesanzeiger: {e}", BAFIN_PAGE)
    out = [{"holder": x.get("Positionsinhaber", ""), "issuer": x.get("Emittent", ""), "isin": x.get("ISIN", ""),
            "pct": _f((x.get("Position") or "").replace(",", ".")), "date": x.get("Datum", ""), "reg": "BaFin"}
           for x in rows]
    return ok(out, BAFIN_PAGE)


def afm() -> dict:
    try:
        r = http.get(AFM_CSV, timeout=60)
        r.raise_for_status()
        rows = list(csv.DictReader(io.StringIO(r.content.decode("utf-8-sig", "replace")), delimiter=";"))
    except Exception as e:  # noqa: BLE001
        return unavailable(f"AFM: {e}", AFM_PAGE)
    out = [{"holder": x.get("Positie houder", ""), "issuer": x.get("Naam van de emittent", ""),
            "isin": x.get("ISIN", ""), "pct": _f(x.get("Netto Shortpositie")),
            "date": (x.get("Positiedatum") or "")[:10], "reg": "AFM"} for x in rows]
    return ok(out, AFM_PAGE)


REGULATOR_BY_SUFFIX = {".MI": "consob", ".DE": "bafin", ".AS": "afm"}


def eu_shorts_for(rows: list[dict], names: list[str], isin: str = "") -> list[dict]:
    """Posizioni aperte su un emittente: per ISIN se c'è, altrimenti per nome.
    I registri BaFin e AFM contengono anche le notifiche passate: per ogni detentore vale
    l'ultima, e sotto lo 0,5% vuol dire che la posizione è scesa sotto la soglia di pubblicazione."""
    def match(x):
        if isin:
            return x["isin"] == isin
        low = (x["issuer"] or "").lower()
        return any(re.search(r"\b" + re.escape(n.lower()) + r"\b", low) for n in names)
    latest: dict[str, dict] = {}
    for x in sorted(filter(match, rows), key=lambda x: x["date"] or ""):
        latest[x["holder"]] = x
    return sorted((x for x in latest.values() if x["pct"] >= 0.5), key=lambda x: x["pct"], reverse=True)


# --- Rame: CFTC COT --------------------------------------------------------------

def cot_copper() -> dict:
    try:
        r = http.get(CFTC, params={"$limit": 2, "$where": "commodity_name='COPPER'",
                                   "$order": "report_date_as_yyyy_mm_dd DESC"})
        r.raise_for_status()
        d = r.json()
    except Exception as e:  # noqa: BLE001
        return unavailable(f"CFTC: {e}", CFTC)
    if not d:
        return unavailable("CFTC: nessun report rame", CFTC)
    x = d[0]
    long_, short = _f(x.get("noncomm_positions_long_all")), _f(x.get("noncomm_positions_short_all"))
    chg = _f(x.get("change_in_noncomm_long_all")) - _f(x.get("change_in_noncomm_short_all"))
    return ok({"date": x.get("report_date_as_yyyy_mm_dd", "")[:10], "net": long_ - short, "chg_week": chg,
               "long": long_, "short": short, "oi": _f(x.get("open_interest_all")),
               "market": x.get("market_and_exchange_names", "")},
              "https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm")
