# 06 — Design system e UI

| Documento | Percorso |
|-----------|----------|
| Indice | [README_00.md](../README_00.md) |
| Validazione | [05_VALIDATION_ZOD.md](05_VALIDATION_ZOD.md) |

## 1. Stack UI (verificato)

| Tecnologia | Ruolo |
|------------|--------|
| **Tailwind CSS** v4 | Utility-first; `@tailwindcss/postcss` in dev |
| **lucide-react** | Icone |
| **React 19** | Componenti |
| **Leaflet / react-leaflet** | Mappe (coordinate sui giorni) |

**Nota**: nel repository **non** è presente `components.json` né dipendenze `@radix-ui/*` tipiche di **shadcn/ui**. L’interfaccia si basa su componenti applicativi custom sotto `src/components/` (es. `src/components/home/*`) e layout Next.js.

## 2. Styling

- Configurazione Tailwind v4 “CSS-first” (file globali in `src/`; vedi progetto per `@theme` / PostCSS).
- Evitare di assumere un design system esterno oltre a Tailwind + convenzioni interne.

## 3. Struttura cartelle UI (indicativa)

| Percorso | Contenuto |
|----------|-----------|
| `src/app/` | App Router: `page.tsx`, layout, route segment |
| `src/components/` | Componenti riutilizzabili e sezioni marketing |
| `src/app/globals.css` | Stili globali (se presente) |

## 4. Accessibilità e UX

- Form e pulsanti devono rispettare contrasto e focus visibile (Tailwind `focus-visible:` dove applicato).
- Mappe: fornire contesto testuale oltre al marker (coordinate anche in DTO).

## 5. Asset statici

- `public/` per file serviti così com’è (es. favicon).

## 6. Presentazione statica

- `presentation.html` (root pacchetto) è un documento HTML standalone per pitch (non parte del build React).
