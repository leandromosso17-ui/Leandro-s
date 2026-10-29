"""Test offline della logica pura (nessuna rete, nessun token)."""
from types import SimpleNamespace

from analysis.podcast import fix_names, link_tickers
from analysis.transcript import clean_any
from collectors.podcast import slot_of
from intel.llm import parse_json

VTT = """WEBVTT
Kind: captions
Language: it

00:00:00.160 --> 00:00:02.869 align:start position:0%
 
buongiorno<00:00:00.560><c> e</c><00:00:00.800><c> benvenuti</c>

00:00:02.869 --> 00:00:05.150 align:start position:0%
buongiorno e benvenuti
a<00:00:03.200><c> Black</c><00:00:03.500><c> Box</c>

00:01:05.150 --> 00:01:07.000 align:start position:0%
a Black Box
oggi parliamo di rame e di Prysmian [Musica]
"""


def test_clean_rolling_captions():
    out = clean_any(VTT, "vtt")
    assert out == "[00:00] buongiorno e benvenuti a Black Box\n[01:05] oggi parliamo di rame e di Prysmian"


def test_slot():
    assert slot_of("Il rame torna a correre | Morning Finance", "| Morning Finance") == "mattina"
    assert slot_of("La grande rotazione", "| Morning Finance") == "sera"


def test_link_tickers():
    cfg = SimpleNamespace(
        raw={"themes": {"rame": ["rame"], "cavi_energia": ["cavi"]}},
        positions=[SimpleNamespace(ticker="PRY.MI", alias=["prysmian"], temi=["cavi_energia"]),
                   SimpleNamespace(ticker="COPA.L", alias=[], temi=["rame"]),
                   SimpleNamespace(ticker="RGTI", alias=["rigetti"], temi=[])],
    )
    links = {l["ticker"]: l for l in link_tickers(cfg, clean_any(VTT, "vtt"))}
    assert links["PRY.MI"]["tipo"] == "citato direttamente"
    assert links["COPA.L"]["tipo"] == "toccato da tema" and links["COPA.L"]["timestamp"] == ["01:05"]
    assert "RGTI" not in links


def test_fix_names():
    cfg = SimpleNamespace(section=lambda name: {"correzioni": {"high trade": "AI trade", "cora media": "Chora Media"}})
    assert fix_names(cfg, "[00:10] l'High trade riparte, lo dice Cora Media; highlights") == \
        "[00:10] l'AI trade riparte, lo dice Chora Media; highlights"


BANKS = [{"nome": "Goldman Sachs", "alias": ["goldman"]}, {"nome": "Citi", "alias": ["citigroup"]},
         {"nome": "Bank of America", "alias": ["b of a securities"]}]


def test_bank_headline():
    from datetime import datetime, timezone
    from analysis.banks import from_headline
    it = {"title": "Prysmian, Citigroup alza il target price da 120 a 136 euro, Buy", "source": "X",
          "link": "u", "published": datetime(2026, 10, 26, tzinfo=timezone.utc)}
    names = ["Prysmian"]
    a = from_headline(it, BANKS, names)
    assert (a["firm"], a["rating"], a["pt"]) == ("Citi", "Buy", 136.0)
    assert from_headline({**it, "title": "Prysmian sale in Borsa"}, BANKS, names) is None
    # casi reali visti in Google News
    def pt(title, n):
        r = from_headline({**it, "title": title}, BANKS, [n])
        return r and (r["firm"], r["pt"])
    assert pt("Besi stock: Goldman cuts target for Besi stock from EUR 342.00 to EUR 275.00", "Besi") == ("Goldman Sachs", 275.0)
    assert pt("Bank Of America Raises ServiceNow Price Target Ahead Of Q3 Earnings", "ServiceNow") is None
    assert pt("Synopsys targets well ahead, B of A Securities Says - Firm Lifts Target By $100", "Synopsys") is None
    assert pt("Adobe Falls 4% as Citi Cuts to Underweight With $225 Target; ServiceNow Climbs 3%", "ServiceNow") is None
    assert pt("Citigroup Adjusts Price Target on ServiceNow to $157 From $170", "ServiceNow") == ("Citi", 157.0)
    assert pt("Saipem, Citi incrementa target price e conferma Buy", "Prysmian") is None


def test_top_banks_priority_and_timeline():
    from datetime import date
    from analysis.banks import top_banks
    rows = [
        {"date": date(2026, 1, 5), "firm": "Needham", "rating": "Buy", "pt": 90},
        {"date": date(2026, 2, 1), "firm": "B of A Securities", "rating": "Neutral", "pt": 80},
        {"date": date(2026, 6, 1), "firm": "B of A Securities", "rating": "Buy", "pt": None},
        {"date": date(2026, 6, 1), "firm": "B of A Securities", "rating": "", "pt": 95},
        {"date": date(2026, 9, 1), "firm": "B of A Securities", "rating": "Buy", "pt": 95},
        {"date": date(2026, 3, 1), "firm": "Goldman Sachs", "rating": "Buy", "pt": 100},
    ]
    top = top_banks(rows, BANKS)
    assert [t["bank"] for t in top] == ["Goldman Sachs", "Bank of America", "Needham"]
    bofa = top[1]
    assert [(x["rating"], x["pt"]) for x in bofa["timeline"]] == [("Neutral", 80), ("Buy", 95)]
    assert bofa["direction"] == "più rialzista" and bofa["current"]["date"] == date(2026, 9, 1)


def test_match_posts():
    from analysis.retail import match_posts
    cfg = SimpleNamespace(raw={"themes": {"rame": ["rame", "copper"]},
                               "tickers": {"COPA.L": {"sottostanti": ["HG=F"]}}})
    now_ = SimpleNamespace(ticker="NOW", nome="ServiceNow", alias=["servicenow"], temi=[])
    uber = SimpleNamespace(ticker="UBER", nome="Uber", alias=["uber"], temi=[])
    copa = SimpleNamespace(ticker="COPA.L", nome="WisdomTree Copper", alias=[], temi=["rame"])
    posts = [{"title": t} for t in ("Buy NOW or wait?", "$NOW earnings crash", "ServiceNow down 25%",
                                    "UBER robotaxi plans", "Copper hits record", "Rame: che ne pensate?")]
    titles = lambda p: [x["title"] for x in match_posts(cfg, p, posts)]
    assert titles(now_) == ["$NOW earnings crash", "ServiceNow down 25%"]
    assert titles(uber) == ["UBER robotaxi plans"]
    assert titles(copa) == ["Copper hits record", "Rame: che ne pensate?"]


def test_parse_json_fenced():
    assert parse_json('```json\n{"sintesi": ["a"]}\n```') == {"sintesi": ["a"]}
