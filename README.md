# Vinea · Winzerapp

Technische Projektbasis für eine mandantenfähige Winzer-App gemäß [Produktspezifikation](docs/product-specification.md). Oberfläche: **Deutsch, Englisch, Italienisch, Französisch**. Deutsch ist der Standard; Sprache per `?lang=de|en|it|fr` oder Auswahl ändern.

## Aktueller Umfang

- Startfähiges SvelteKit-/TypeScript-Monorepo mit Vercel-Adapter, Frankfurt als Funktionsregion.
- Responsives Cuvée-Studio mit synthetischen Quellen A/B, Dezimalrechnung, Bestandsprüfung, 250-ml-Versuchsplanung und JSON-Export.
- Mengen, Alkoholschätzung und reine Weinkosten; keine pH-, SO₂- oder Geschmacksprognose.
- Deutsche Produktspezifikation, SQL-Grundlage für Mandanten und dokumentierter Ausbau.

**Dies ist die erste Projektbasis, kein fertiges Produktions-MVP.** Kein produktiver Login, keine Bestandsbuchung, keine aktive Datenbankverbindung, keine Offline-Synchronisierung und keine echten ERP-/KI-Integrationen. Die Oberfläche kennzeichnet Beispieldaten ausdrücklich. Browser-Eingaben werden nicht dauerhaft gespeichert. Exportdaten sind Planungen, keine freigegebenen Produktionsrezepte.

## Lokal starten

Node.js 22+, pnpm 10.28.2:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm dev
```

Die aktuelle Planungsoberfläche benötigt keine Secrets und keine Datenbank. Für spätere Servermodule `.env.example` verwenden; Zugangsdaten niemals committen. Einrichten der Datenbank und Authentifizierung: [Deployment-Anleitung](docs/deployment.md).

## Struktur

```text
apps/web/              SvelteKit-Oberfläche, später API
apps/worker/           Dokumentierter späterer Outbox-Worker
packages/domain/       Frameworkfreie Cuvée-Rechnung und Tests
packages/db/           Versionierte SQL-Migrationen
packages/contracts/    Regeln für spätere API-Verträge
packages/integrations/ Geplante Adaptergrenzen
packages/ui/           Dokumentierte Design-Tokens
packages/testing/      Synthetische Fachfixtures
docs/                  Spezifikation, Entscheidungen, Architektur, Betrieb
```

Das vollständige MVP wird in den vertikalen Schritten A–K der Spezifikation aufgebaut. Die Abnahmefälle für Journal, Parallelität, Idempotenz, Tenantisolation und den Produktionspfad bleiben verpflichtend und sind noch nicht implementiert.
