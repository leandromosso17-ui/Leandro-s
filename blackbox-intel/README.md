# blackbox-intel

Market intelligence locale e gratuita: due run al giorno dopo le puntate di Black Box, digest su Notion e in HTML. Non è un sistema di trading.

Stato: **Moduli 1 (podcast), 2 (news e banche), 3 (retail e mercato) e `test-sources` pronti.** Moduli 4-7, Notion, HTML e scheduling arrivano uno alla volta.

## Setup su Windows

```powershell
winget install Python.Python.3.12 astral-sh.uv Gyan.FFmpeg
git clone https://github.com/leandromosso17-ui/Leandro-s.git
cd Leandro-s
git checkout Market-Intel
cd blackbox-intel
copy .env.example .env      # poi compila .env
uv sync --extra sentiment
uv run intel test-sources
uv run intel podcast --last 2
uv run intel news
```

`uv sync` da solo disinstalla gli extra: usa sempre `uv sync --extra sentiment` (aggiungi `--extra whisper` se serve).
Se `uv sync` dà «Accesso negato» su `.venv`, è OneDrive che sincronizza la cartella: rilancia il comando.

`yt-dlp` è già una dipendenza Python: non serve installarlo con winget. Claude Code deve essere installato e con il login fatto (`claude` nel PATH).

## Comandi

| Comando | Cosa fa |
|---|---|
| `uv run intel test-sources` | Una chiamata reale per ogni fonte, tabella sì/no con motivo |
| `uv run intel podcast --last 2` | Modulo 1 sulle ultime N puntate |
| `uv run intel news` (`--only UBER`) | Modulo 2: prezzi, news con sentiment, banche (zero token) |
| `uv run intel retail` (`--only UBER`) | Modulo 3: ApeWisdom, StockTwits, Reddit RSS, Fear & Greed, VIX, put/call (zero token) |
| `uv run intel run --slot mattina` / `--slot sera` | Run di uno slot (podcast + Moduli 2-3) |
| `uv run intel tokens` | Token degli ultimi 7 giorni (da `logs/tokens.csv`) |

## Spazio su disco

- Base: circa 30 MB (nessun torch).
- Sentiment delle news (`--extra sentiment`): onnxruntime + FinBERT e un modello multilingue in ONNX int8, circa 300 MB in tutto, scaricati al primo uso in `models/sentiment/`. Niente torch.
- Whisper è opzionale e serve solo se mancano sia i sottotitoli YouTube sia la trascrizione del feed: `uv sync --extra whisper`, circa 100 MB di librerie più il modello `base` (~145 MB, scaricato al primo uso in `models/`).

## Token

`claude -p` viene lanciato con il contesto minimo (`--tools ""`, `--system-prompt`, `--strict-mcp-config`, `--setting-sources ""`). L'overhead scende da circa 37k a circa 1,3k token per chiamata. Ogni puntata viene sintetizzata una sola volta: la sintesi resta in cache in `data/state.sqlite`. Per usare Ollama, imposta `llm.engine: ollama` in `config.yaml`.

## Manutenzione

- Temi e alias per i collegamenti podcast → titoli: `config.yaml`, sezioni `themes` e `tickers`.
- Banche «top 3» per titolo: `config.yaml`, sezione `banche` (ordine = priorità). Storico da Yahoo (solo USA) più i titoli di Google News, accumulati in `data/state.sqlite` a ogni run.
- Errori ricorrenti dei sottotitoli: `config.yaml`, `podcast.correzioni`.
- Subreddit seguiti: `config.yaml`, `retail.subreddit`. Senza login Reddit concede ~1 richiesta al minuto: ogni subreddit aggiunge ~1 minuto al run.
- Se una fonte smette di funzionare, `uv run intel test-sources` dice quale e perché.
