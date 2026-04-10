# Inngest: timeout e retry (riferimento QA)

## `generate-itinerary`

- **Retry Inngest:** `retries: 3` sulla funzione (tentativi gestiti dalla piattaforma Inngest in caso di errore nello step).
- **Timeout esecuzione:** `timeouts: { finish: "15m" }` — la funzione deve completare entro 15 minuti.
- **Retry logica Anthropic (interno allo step `genera-con-claude`):** fino a 3 tentativi con temperatura diversa; in caso di JSON non valido viene invocato un prompt di “riparazione” (`buildRepairPrompt`) prima di fallire definitivamente.

I test automatici coprono la validazione JSON (`parseAndValidateModelJson` in `src/lib/itinerary-model-schema.ts`) e, lato servizio slot, il comportamento quando Anthropic non restituisce un blocco testo.
