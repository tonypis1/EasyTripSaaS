import { container } from "@/server/di/container";

/**
 * Portabilità dati (GDPR Art. 20): export JSON dell'utente autenticato.
 */
export async function GET() {
  return container.controllers.userController.exportData();
}
