# blackbox-intel

Market intelligence locale e gratuita: due run al giorno dopo le puntate di Black Box, digest su Notion e in HTML. Non è un sistema di trading: ogni segnale ha direzione, data e fonte, la decisione è tua.

Stato: **tutti i moduli (1-7), digest HTML, Notion, notifica e scheduling pronti.**

## Setup su Windows

```powershell
winget install Python.Python.3.12 astral-sh.uv Gyan.FFmpeg
git clone https://github.com/leandromosso17-ui/Leandro-s.git
cd Leandro-s
git checkout Market-Intel
cd blackbox-intel
copy .env.example .env      # poi compila .env (Notion: vedi sotto)
uv sync --extra sentiment
uv run intel test-sources
uv run intel run --slot mattina --force --no-wait   # run di prova
powershell -ExecutionPolicy Bypass -File .\setup_tasks.ps1   # attività 08:00 e 21:00
```

- `uv sync` da solo disinstalla gli extra: usa sempre `uv sync --extra sentiment` (aggiungi `--extra whisper` se serve).
- Se `uv sync` dà «Accesso negato» su `.venv`, è OneDrive che sincronizza la cartella: rilancia il comando.
- `claude` (Claude Code) deve avere il login fatto: `claude auth status`. Se non è nel PATH viene cercato in `%USERPROFILE%\.local\bin`.

## Notion

1. Crea un'integrazione interna su https://www.notion.so/my-integrations e copia il token.
2. Crea una pagina «Market Intel», menu `…` → Connessioni → aggiungi l'integrazione.
3. In `.env`: `NOTION_TOKEN=...` e `NOTION_PAGE_ID=` (l'ID a 32 caratteri in fondo all'URL della pagina).

A ogni run la pagina viene riscritta col digest più recente e sotto nasce una sottopagina datata d'archivio (le sottopagine non vengono mai cancellate). Se Notion non è configurato o non risponde, il run va avanti e lo scrive nel digest.

## Comandi

| Comando | Cosa fa |
|---|---|
| `uv run intel run --slot mattina` / `--slot sera` | Run completo: aspetta la puntata (max 2 ore), tutti i moduli, digest HTML + Notion + notifica |
| `uv run intel test-sources` (`--only gruppo`) | Una chiamata reale per ogni fonte, tabella sì/no con motivo |
| `uv run intel podcast --last 2` | Modulo 1 sulle ultime N puntate |
| `uv run intel news` (`--only UBER`) | Modulo 2: prezzi, news con sentiment, banche |
| `uv run intel retail` (`--only UBER`) | Modulo 3: retail e indicatori di mercato |
| `uv run intel tokens` | Token degli ultimi 7 giorni (da `logs/tokens.csv`) |

`run` accetta `--force` (ignora il limite di 2 run al giorno) e `--no-wait` (non aspetta la puntata): solo per le prove.

## Moduli

1. **Podcast** — feed Megaphone, sottotitoli YouTube (canale Chora Media), sintesi Haiku in cache, i tuoi asset, opportunità, termometro bolla AI, nomi corretti.
2. **News e banche** — prezzi Yahoo (endpoint chart), Google News EN/IT con FinBERT locale, top 3 banche con storico rating/target e direzione, consenso.
3. **Retail** — ApeWisdom, StockTwits, Reddit RSS, forum ariva.de (titoli EU), Fear & Greed, VIX, put/call.
4. **Posizionamento** — USA: insider Form 4 (cluster ≥3), short interest FINRA, 13D/13G (xoomar). EU: posizioni corte nette ≥0,5% da Consob, BaFin, AFM. Rame: COT CFTC.
5. **Polymarket** — temi macro da `config.yaml` e nomi dei titoli, variazione rispetto al run precedente.
6. **Utili** — prossimi 14 giorni (confermati/stimati), banner oggi/domani, commento ai risultati nella chiamata finale.
7. **Portfolio** — pesi da `investito_k`, concentrazione (top 3, Herfindahl), esposizioni, correlazioni a 90 giorni, domande (mai consigli).

## Token

Al massimo 2 chiamate LLM per run, entrambe `claude -p --model haiku` a contesto minimo (`--tools ""`, `--system-prompt`, `--strict-mcp-config`, `--setting-sources ""`: ~1,3k token di overhead invece di ~37k):
1. sintesi della puntata (una sola volta per puntata, poi cache in `data/state.sqlite`);
2. chiamata finale su un JSON compatto (≤ ~8k token): tesi a rischio, collegamenti podcast-titoli, domande, utili.

Il thinking di Haiku non si spegne da `claude -p` e conta nel tetto di output: per questo i tetti in `config.yaml` sono larghi (16k). Per Ollama: `llm.engine: ollama`.

## Spazio su disco

- Base: circa 30 MB (nessun torch).
- `--extra sentiment`: onnxruntime + FinBERT e un modello multilingue in ONNX int8, ~300 MB con i modelli (scaricati al primo uso in `models/sentiment/`).
- `--extra whisper` (opzionale, solo se mancano i sottotitoli): ~100 MB + modello `base` ~145 MB.

## Scheduling

`setup_tasks.ps1` crea «blackbox-intel mattina» (08:00) e «blackbox-intel sera» (21:00) nell'ora del PC, con «Riattiva il computer» ed «Esegui il prima possibile dopo un avvio pianificato saltato». Log in `logs\run-mattina.log` / `logs\run-sera.log`. Perché il PC si risvegli davvero, nelle Opzioni risparmio energia devono essere attivi i «timer di riattivazione». Per toglierle: `setup_tasks.ps1 -Remove`.

Mai più di 2 run completi al giorno (lock file + stato in SQLite). Report HTML in `%USERPROFILE%\blackbox-intel\reports\AAAA-MM-GG-slot.html`.

## Manutenzione

- Titoli: `portfolio.csv` (`tesi` serve al flag «tesi a rischio», `investito_k` ai pesi). Alias, temi, sottostanti degli ETF: `config.yaml`, `tickers`.
- Banche «top 3»: `config.yaml`, `banche` (ordine = priorità).
- Errori ricorrenti dei sottotitoli: `podcast.correzioni`. Subreddit e forum ariva.de: `retail`. Temi Polymarket: `polymarket.temi`.
- Fonti scartate perché non leggibili senza aggirare blocchi: Investing.com, commenti Yahoo Finance, FinanzaOnline. Reddit `.json` chiuso (403).
- Se una fonte smette di funzionare, `uv run intel test-sources` dice quale e perché; nel digest la sezione esce comunque, marcata «non disponibile» col motivo.
