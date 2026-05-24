import { useSyncExternalStore } from "react";

/**
 * Restituisce `false` durante SSR e durante il primo render lato client (la
 * fase di hydration), poi `true` dopo il mount.
 *
 * Serve per evitare hydration mismatch quando un componente dipendente dal
 * runtime browser deve essere reso differentemente da come lo sarebbe sul
 * server. Esempio tipico: i componenti UI di Clerk (`<UserButton />` ecc.)
 * inseriscono nel DOM un placeholder `data-clerk-component="…"` solo dopo
 * l'inizializzazione del Clerk SDK lato client; SSR e client-render iniziale
 * non producono lo stesso markup, generando il warning di React.
 *
 * Pattern: `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)`
 *  - `subscribe` no-op: il valore non cambia mai dopo il mount.
 *  - `getSnapshot()` → `true`  (eseguito sul client dopo l'hydration).
 *  - `getServerSnapshot()` → `false` (eseguito su server e durante il primo
 *    render client). React garantisce che server snapshot e primo client
 *    snapshot vengano confrontati: con `false` su entrambi, niente mismatch.
 *
 * Uso:
 *   const isClient = useIsClient();
 *   return isClient ? <ComponenteSensibile /> : <Placeholder />;
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
