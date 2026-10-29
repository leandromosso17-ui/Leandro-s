"""Digest Markdown -> HTML locale (sottoinsieme di Markdown usato dal digest, niente dipendenze)."""
from __future__ import annotations

import html
import re

CSS = """
:root { --bg:#fafaf7; --fg:#1d1d1b; --muted:#6b6b66; --line:#e3e1da; --card:#fff; --accent:#1f5fae;
        --up:#1a7f37; --down:#c0392b; }
@media (prefers-color-scheme: dark) {
  :root { --bg:#151513; --fg:#ecebe6; --muted:#a3a29c; --line:#2f2e2a; --card:#1d1d1a; --accent:#7fb0ff;
          --up:#4cc26a; --down:#ff6b5b; } }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--fg); font:15px/1.55 -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 1100px; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 26px; margin: 0 0 4px; } h2 { font-size: 20px; margin: 36px 0 10px; padding-top: 12px;
  border-top: 1px solid var(--line); } h3 { font-size: 16px; margin: 22px 0 8px; } h4 { font-size: 15px; margin: 18px 0 6px; }
a { color: var(--accent); text-decoration: none; } a:hover { text-decoration: underline; }
em { color: var(--muted); } ul { padding-left: 20px; margin: 6px 0; } li { margin: 3px 0; }
blockquote { margin: 14px 0; padding: 10px 14px; background: var(--card); border-left: 4px solid #e0a100; border-radius: 6px; }
.tw { overflow-x: auto; margin: 10px 0; border: 1px solid var(--line); border-radius: 8px; background: var(--card); }
table { border-collapse: collapse; width: 100%; font-size: 13.5px; }
th, td { padding: 7px 10px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; white-space: nowrap; }
th { font-weight: 600; background: var(--bg); position: sticky; top: 0; }
tr:last-child td { border-bottom: 0; }
.up { color: var(--up); } .down { color: var(--down); }
"""


def _inline(s: str) -> str:
    s = html.escape(s, quote=False)
    s = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", lambda m: f'<a href="{html.escape(m.group(2))}">{m.group(1)}</a>', s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<![\w/])_(.+?)_(?![\w])", r"<em>\1</em>", s)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"(▲[^|<]*?)(?=\s·|\s\(|$|<)", r'<span class="up">\1</span>', s)
    s = re.sub(r"(▼[^|<]*?)(?=\s·|\s\(|$|<)", r'<span class="down">\1</span>', s)
    return s


def to_html(md: str, title: str) -> str:
    out, lines, i = [], md.splitlines(), 0
    list_depth = 0

    def close_lists(to=0):
        nonlocal list_depth
        while list_depth > to:
            out.append("</ul>")
            list_depth -= 1

    while i < len(lines):
        line = lines[i]
        if line.startswith("|") and i + 1 < len(lines) and re.match(r"^\|[-|: ]+\|?$", lines[i + 1]):
            close_lists()
            head = [c.strip() for c in line.strip("|").split("|")]
            out.append('<div class="tw"><table><thead><tr>' + "".join(f"<th>{_inline(c)}</th>" for c in head) + "</tr></thead><tbody>")
            i += 2
            while i < len(lines) and lines[i].startswith("|"):
                cells = [c.strip() for c in lines[i].strip("|").split("|")]
                out.append("<tr>" + "".join(f"<td>{_inline(c)}</td>" for c in cells) + "</tr>")
                i += 1
            out.append("</tbody></table></div>")
            continue
        m = re.match(r"^(#{1,4}) (.*)", line)
        lm = re.match(r"^(\s*)- (.*)", line)
        if m:
            close_lists()
            n = len(m.group(1))
            out.append(f"<h{n}>{_inline(m.group(2))}</h{n}>")
        elif lm:
            depth = len(lm.group(1)) // 2 + 1
            while list_depth < depth:
                out.append("<ul>")
                list_depth += 1
            close_lists(depth)
            out.append(f"<li>{_inline(lm.group(2))}</li>")
        elif line.startswith(">"):
            close_lists()
            quote = []
            while i < len(lines) and lines[i].startswith(">"):
                quote.append(_inline(lines[i].lstrip("> ").rstrip()))
                i += 1
            out.append("<blockquote>" + "<br>".join(quote) + "</blockquote>")
            continue
        elif line.strip():
            close_lists()
            out.append(f"<p>{_inline(line)}</p>")
        else:
            close_lists()
        i += 1
    close_lists()
    return (f'<!doctype html><html lang="it"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width, initial-scale=1">'
            f"<title>{html.escape(title)}</title><style>{CSS}</style></head><body><main>{''.join(out)}</main></body></html>")
