# 03 — Modello dati (Prisma)

| Documento | Percorso |
|-----------|----------|
| Indice | [README_00.md](../README_00.md) |
| Architettura | [02_ARCHITECTURE.md](02_ARCHITECTURE.md) |
| API | [04_API_SPECIFICATION.md](04_API_SPECIFICATION.md) |

## 1. Fonte di verità

Schema: [`prisma/schema.prisma`](../prisma/schema.prisma).  
Datasource: PostgreSQL via `DATABASE_URL`.

## 2. Diagramma entità-relazione (logico)

```mermaid
erDiagram
  User ||--o{ Trip : organizes
  User ||--o{ TripMember : member
  User ||--o{ Payment : pays
  User ||--o{ Credit : owns
  User ||--o{ SupportTicket : opens
  User ||--o{ Referral : referrer
  User ||--o{ Referral : referred

  Trip ||--o{ TripVersion : versions
  Trip ||--o{ TripMember : members
  Trip ||--o{ Expense : expenses
  Trip ||--o{ Payment : payments
  Trip ||--o{ Credit : creditOrigin
  Trip ||--o{ Credit : creditUsed
  Trip ||--o{ SupportTicket : tickets

  TripVersion ||--o{ Day : days

  TripMember ||--o{ Expense : paidBy

  Credit ||--o{ Referral : rewardCredit

  User {
    string id PK
    string clerkUserId UK
    string email
    decimal creditBalance
    string referralCode UK
    string planType
    datetime subExpiresAt
    string stripeCustomerId
  }

  Trip {
    string id PK
    string organizerId FK
    string destination
    date startDate
    date endDate
    date accessExpiresAt
    enum tripType
    string status
    int regenCount
    int currentVersion
    int localPassCityCount
    string inviteToken UK
    datetime deletedAt
  }

  TripVersion {
    string id PK
    string tripId FK
    int versionNum
    boolean isActive
    decimal geoScore
    int userRating
  }

  Day {
    string id PK
    string tripVersionId FK
    int dayNumber
    date unlockDate
    decimal mapCenterLat
    decimal mapCenterLng
    string zoneFocus
  }
```

## 3. Enumerazioni principali

| Enum | Valori | Impiego |
|------|--------|---------|
| `TripStatus` | pending, active, expired, cancelled | Ciclo di vita trip |
| `TripType` | solo, coppia, gruppo | Pricing e prompt AI |
| `PaymentType` | purchase, regen, reactivate | Stripe + record `Payment` |
| `ExpenseCategory` | cibo, trasporti, attivita, alloggio, altro | Spese |
| `TicketStatus` / `TicketChannel` | — | Supporto |
| `ReferralStatus` | pending, signed_up, converted | Referral |

## 4. Note su itinerari e JSON

- I campi `morning`, `afternoon`, `evening`, `restaurants` su `Day` sono persistiti come stringhe (serializzazione JSON lato applicazione).
- `zoneFocus` alimenta `usedZones` sul `Trip` per variare le rigenerazioni.

## 5. Indici e vincoli rilevanti

- `TripMember`: `@@unique([tripId, userId])`
- `Referral`: `@@unique([referrerId, referredEmail])`
- `User.referralCode`: univoco dove valorizzato

## 6. Retention (config)

Valori da env (`unifiedConfig.ts`):

- `RETENTION_INACTIVE_TRIP_VERSION_DAYS` (default 365)
- `RETENTION_SOFT_DELETED_TRIP_DAYS` (default 90)

Implementazione job: `dataRetentionPurge` (Inngest).
