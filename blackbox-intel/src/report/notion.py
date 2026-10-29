"""Digest -> Notion via API ufficiale, senza token LLM: il Markdown diventa blocchi in Python.

A ogni run: la pagina principale (NOTION_PAGE_ID) viene svuotata e riscritta col digest
più recente, e sotto di essa si crea una sottopagina datata come archivio. Le
sottopagine d'archivio non vengono mai cancellate.
"""
from __future__ import annotations

import os
import re
import time

import requests

API = "https://api.notion.com/v1"
VERSION = "2022-06-28"
MAX_TEXT = 1900   # Notion: 2000 caratteri per oggetto di testo
BATCH = 90        # Notion: 100 blocchi per richiesta


def _rich(s: str) -> list[dict]:
    """**grassetto**, _corsivo_, [testo](url) -> rich_text di Notion."""
    out = []
    for part in re.split(r"(\*\*.+?\*\*|\[[^\]]+\]\(https?://[^)\s]+\)|(?<![\w/])_.+?_(?![\w]))", s):
        if not part:
            continue
        ann, link = {}, None
        m = re.fullmatch(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", part)
        if m:
            part, link = m.group(1), m.group(2)
        elif part.startswith("**") and part.endswith("**") and len(part) > 4:
            part, ann = part[2:-2], {"bold": True}
        elif part.startswith("_") and part.endswith("_") and len(part) > 2:
            part, ann = part[1:-1], {"italic": True}
        for i in range(0, len(part), MAX_TEXT):
            t = {"type": "text", "text": {"content": part[i:i + MAX_TEXT]}}
            if link and len(link) <= 2000:
                t["text"]["link"] = {"url": link}
            if ann:
                t["annotations"] = ann
            out.append(t)
    return out[:100]


def _block(kind: str, text: str) -> dict:
    return {"object": "block", "type": kind, kind: {"rich_text": _rich(text)}}


def to_blocks(md: str) -> list[dict]:
    blocks, lines, i = [], md.splitlines(), 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("|") and i + 1 < len(lines) and re.match(r"^\|[-|: ]+\|?$", lines[i + 1]):
            rows = [[c.strip() for c in line.strip("|").split("|")]]
            i += 2
            while i < len(lines) and lines[i].startswith("|"):
                rows.append([c.strip() for c in lines[i].strip("|").split("|")])
                i += 1
            width = len(rows[0])
            blocks.append({"object": "block", "type": "table", "table": {
                "table_width": width, "has_column_header": True, "has_row_header": False,
                "children": [{"object": "block", "type": "table_row", "table_row": {
                    "cells": [_rich(c) for c in (r + [""] * width)[:width]]}} for r in rows[:99]]}})
            continue
        m = re.match(r"^(#{1,4}) (.*)", line)
        lm = re.match(r"^(\s*)- (.*)", line)
        if m:
            level = min(len(m.group(1)), 3)
            blocks.append(_block(f"heading_{level}", m.group(2)))
        elif lm:
            item = _block("bulleted_list_item", lm.group(2))
            if lm.group(1) and blocks and blocks[-1]["type"] == "bulleted_list_item":
                blocks[-1]["bulleted_list_item"].setdefault("children", []).append(item)
            else:
                blocks.append(item)
        elif line.startswith(">"):
            blocks.append(_block("callout", line.lstrip("> ").rstrip()))
            blocks[-1]["callout"]["icon"] = {"type": "emoji", "emoji": "📅"}
        elif line.strip():
            blocks.append(_block("paragraph", line))
        i += 1
    return blocks


class Notion:
    def __init__(self, token: str):
        self.s = requests.Session()
        self.s.headers.update({"Authorization": f"Bearer {token}", "Notion-Version": VERSION,
                               "Content-Type": "application/json"})

    def req(self, method: str, path: str, **kw) -> dict:
        for attempt in range(4):
            r = self.s.request(method, f"{API}{path}", timeout=30, **kw)
            if r.status_code == 429 or r.status_code >= 500:
                time.sleep(float(r.headers.get("Retry-After", 2 ** attempt)))
                continue
            if r.status_code >= 400:
                raise RuntimeError(f"Notion {method} {path}: HTTP {r.status_code} {r.text[:200]}")
            time.sleep(0.34)  # ~3 richieste al secondo
            return r.json()
        raise RuntimeError(f"Notion {method} {path}: troppi tentativi")

    def children(self, block_id: str) -> list[dict]:
        out, cursor = [], None
        while True:
            q = {"page_size": 100, **({"start_cursor": cursor} if cursor else {})}
            d = self.req("GET", f"/blocks/{block_id}/children", params=q)
            out += d.get("results", [])
            if not d.get("has_more"):
                return out
            cursor = d.get("next_cursor")

    def append(self, block_id: str, blocks: list[dict]) -> None:
        for i in range(0, len(blocks), BATCH):
            self.req("PATCH", f"/blocks/{block_id}/children", json={"children": blocks[i:i + BATCH]})


def publish(md: str, title: str) -> str:
    """Ritorna una riga di stato per il digest. Non solleva: Notion giù non blocca il run."""
    token, page = os.environ.get("NOTION_TOKEN", "").strip(), os.environ.get("NOTION_PAGE_ID", "").strip()
    if not token or not page:
        return "Notion: non configurato (NOTION_TOKEN e NOTION_PAGE_ID in .env)"
    page = page.replace("-", "")[-32:]
    blocks = to_blocks(md)
    try:
        n = Notion(token)
        # 1. archivio: sottopagina datata
        sub = n.req("POST", "/pages", json={"parent": {"page_id": page},
                                            "properties": {"title": {"title": [{"text": {"content": title}}]}},
                                            "children": blocks[:BATCH]})
        n.append(sub["id"], blocks[BATCH:])
        # 2. pagina principale: via i blocchi vecchi (non le sottopagine), dentro il digest nuovo
        for b in n.children(page):
            if b["type"] != "child_page":
                n.req("DELETE", f"/blocks/{b['id']}")
        n.append(page, blocks)
    except Exception as e:  # noqa: BLE001
        return f"Notion: errore ({str(e)[:200]})"
    return f"Notion: pagina aggiornata e archivio «{title}» creato"
