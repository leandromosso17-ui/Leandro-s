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


def test_parse_json_fenced():
    assert parse_json('```json\n{"sintesi": ["a"]}\n```') == {"sintesi": ["a"]}
