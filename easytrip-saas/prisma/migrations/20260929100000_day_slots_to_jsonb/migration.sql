-- Day.morning / afternoon / evening / restaurants: TEXT (JSON serializzato) -> JSONB.
--
-- ATTENZIONE: la migrazione che `prisma migrate dev` genera da sola per questo
-- cambio di tipo è DROP COLUMN + ADD COLUMN, cioè cancella il contenuto di ogni
-- itinerario. Qui la conversione avviene sul posto (USING), senza perdere dati.
--
-- Conversione riga per riga:
--   * NULL, stringa vuota/bianca o il testo 'null'  -> NULL (nessun contenuto)
--   * JSON valido (oggetto, array, ...)              -> lo stesso valore come jsonb
--   * testo non valido come JSON (o non ammesso da jsonb, es. \u0000)
--                                                    -> stringa JSON col testo originale:
--                                                       il dato non si perde e resta ispezionabile;
--                                                       l'app lo tratta come slot illeggibile.
-- Una singola riga anomala non blocca la migrazione.
--
-- Compatibilità di deploy: il codice precedente (campi String di Prisma) continua a
-- leggere e scrivere queste colonne come testo JSON anche dopo la conversione, quindi la
-- migrazione può essere applicata PRIMA del deploy del nuovo codice senza finestre di errore.

CREATE FUNCTION "_easytrip_day_text_to_jsonb"(input TEXT) RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF input IS NULL OR btrim(input) IN ('', 'null') THEN
    RETURN NULL;
  END IF;
  RETURN input::jsonb;
EXCEPTION
  WHEN data_exception OR program_limit_exceeded THEN
    RETURN to_jsonb(input);
END;
$$;

-- Un solo ALTER: la tabella viene riscritta una volta sola.
ALTER TABLE "Day"
  ALTER COLUMN "morning" TYPE JSONB USING "_easytrip_day_text_to_jsonb"("morning"),
  ALTER COLUMN "afternoon" TYPE JSONB USING "_easytrip_day_text_to_jsonb"("afternoon"),
  ALTER COLUMN "evening" TYPE JSONB USING "_easytrip_day_text_to_jsonb"("evening"),
  ALTER COLUMN "restaurants" TYPE JSONB USING "_easytrip_day_text_to_jsonb"("restaurants");

DROP FUNCTION "_easytrip_day_text_to_jsonb"(TEXT);
