# Vinea · Winzerapp

Mandantenfähige Winzeranwendung nach der [Produktspezifikation](docs/product-specification.md), mit **Deutsch, Englisch, Italienisch und Französisch**. App: https://winzerapp.vercel.app/app · Repository: https://github.com/bthginfo/winzerapp.

## Funktionen

Weinberg und Schlagkartei, Wetter/Arbeitsfenster, Reife/Lese, Keller und Bestandsjournal, Gärung/Labor/Sensoren, Cuvée-Studio mit MILP-Optimierung, Abfüllung und Material, Hygiene/Wartung/Ressourcenplanung, Vollkosten, Herkunft und versionierte Nachweise, Datenhub/ERP sowie optionaler Sprach-/OCR-/OpenAI-Assistent. Team-Einladungen, sichere Offline-Erfassung und getrennte Betriebe gehören zum gemeinsamen Datenkern.

Der [vollständige Funktions- und Aktivierungsstand](docs/feature-status.md) beschreibt jede Funktion und die notwendigen Anbieterzugänge. KI darf keine endgültigen Buchungen oder Freigaben ausführen. Gesetzliche Grenzen werden nicht erfunden.

## Lokal starten

Node.js 22.13+, pnpm 10.28.2. Die öffentliche Beispielrechnung (`/`) funktioniert ohne Zugangsdaten.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm dev
```

Für die vollständige Anwendung:

1. Serverseitigen Neon-**Free**-Migrationszugang als `DATABASE_URL` in `.env.local` ablegen; keine Secrets committen.
2. `pnpm db:migrate` ausführen. Das Skript prüft Migrations-Checksummen und schreibt den eingeschränkten Anwendungszugang nach `.env.runtime.local`.
3. `.env.auth.local` mit zufälligem `BETTER_AUTH_SECRET` (mindestens 32 Bytes) und `BETTER_AUTH_URL=http://localhost:5173` anlegen.
4. Optional `.env.integration.local` mit `INTEGRATION_ENCRYPTION_KEY` (32 zufällige Bytes als Base64url) und `CRON_SECRET` anlegen. Weitere optionale Werte stehen in `.env.example`.
5. `pnpm dev:db` starten, `/login` öffnen, registrieren und einen eigenen Betrieb anlegen. MFA unter „Betrieb & Sicherheit“ einrichten.
6. [Beispieldatei](docs/examples/opening-stock.csv) im Datenhub zuordnen, Vorschau prüfen und ausdrücklich übernehmen.

Die Laufzeitanwendung verwendet `APP_DATABASE_URL` mit `NOSUPERUSER NOBYPASSRLS`, niemals den Eigentümerzugang. `DATABASE_URL` dient ausschließlich lokalen Migrationen/Verifikationen; auch `/api/health` prüft mit dem eingeschränkten Anwendungszugang.

## Prüfung und Betrieb

```sh
pnpm db:verify:full  # zusätzliche Fachmodule
pnpm test:e2e:full   # vollständiger Build/Preview einschließlich Offline
pnpm db:verify       # echte PostgreSQL-Prüfungen, isolierte Testbetriebe
pnpm test:e2e       # laufender Server :5173 und Chromium erforderlich
```

Der Browser-Test durchläuft Registrierung, MFA, Import, Versuch, Freigabe, Produktion, Abfüllung, Export, Dateien, Isolation und Offline-Konflikte. Bei Bedarf `E2E_URL` und `CHROMIUM_PATH` setzen. Testkonten verwenden ausschließlich `example.invalid` und isolierte Betriebe.

[Testnachweis](docs/verification.md) · [Betrieb und Grenzen](docs/operations.md) · [Bedienung](docs/user-guide.md) · [Deployment](docs/deployment.md) · [Architektur](docs/architecture.md) · [API-Vertrag](packages/contracts/openapi.json).

Neon bleibt **Free in Frankfurt**. Es wurden keine kostenpflichtigen Datenbanktarife oder Zusatzdienste gewählt. Der bestehende Vercel-Teamtarif wird nicht geändert. OpenAI, SMTP und kundenspezifische ERP-API werden erst nach Zugangskonfiguration aktiv; Regelpakete benötigen reale fachliche Prüfung. Details in [Aktivierung](docs/backlog.md).

Für Offline-Browsertests zuerst `pnpm build`, dann `pnpm preview:db` starten. Der Service Worker wird im Produktionsbuild registriert, nicht im Vite-Entwicklungsmodus. Die lokale Preview erhält dieselben Umgebungsvariablen wie die Datenbankanwendung.
