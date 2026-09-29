import { TripRepository } from "@/server/repositories/TripRepository";
import {
  analyzeItineraryGeo,
  geoInputFromStoredDay,
} from "@/lib/geo-optimization";
import { logger } from "@/lib/observability";

/**
 * Tiene allineato `TripVersion.geoScore` al contenuto reale dei giorni: dopo
 * la sostituzione di uno slot (o l'applicazione di un'alternativa votata) le
 * coordinate cambiano e il punteggio calcolato alla generazione non è più
 * vero. Best-effort: un errore qui non deve mai far fallire l'operazione che
 * lo ha innescato, che è già stata applicata.
 */
export class GeoScoreService {
  constructor(
    private readonly tripRepository: TripRepository = new TripRepository(),
  ) {}

  /** Ricalcola e salva il punteggio; ritorna il nuovo valore, o null se le coordinate non bastano (punteggio precedente invariato). */
  async refreshForVersion(tripVersionId: string): Promise<number | null> {
    try {
      const days = await this.tripRepository.findVersionDaySlots(tripVersionId);
      const analysis = analyzeItineraryGeo(days.map(geoInputFromStoredDay));
      if (analysis.score == null) return null;

      await this.tripRepository.updateVersionGeoScore(
        tripVersionId,
        analysis.score,
      );
      return analysis.score;
    } catch (error) {
      logger.warn("Aggiornamento GeoScore fallito", {
        tripVersionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
