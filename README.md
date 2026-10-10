# Vinea · Winzerapp

Datenbankgestütztes Winzer-MVP nach der [Produktspezifikation](docs/product-specification.md), mit **Deutsch, Englisch, Italienisch und Französisch**. App: https://winzerapp.vercel.app/app · Repository: https://github.com/bthginfo/winzerapp.

## Funktionen

- Better Auth mit E-Mail/Passwort, Authenticator/TOTP und Wiederherstellungscodes. Betriebe, Rollen und eingeschränktes externes Labor; Freigaben, Korrekturen und Rollenänderungen benötigen MFA.
- Weinberge und Leseherkunft; Gefäße, Partien, Bestandspositionen, QR-Etiketten und Suche.
- Anfangsbestand, Transfer/Teilmenge, Mischung, Sperre, Reservierung, Verlust und referenzierte Korrekturen. Atomare Journal-, Bestands-, Audit- und Outbox-Buchung; Idempotenz und Versionsprüfung.
- Analysen mit Probe, Methode, Einheit und unveränderlicher Korrekturhistorie.
- Cuvée-Projekte, neue Rezeptversionen, Freeze mit Datensnapshot, echte 250-ml-Entnahme, Blindcodes und separate Bewertungen, fachliche Freigabe, Reservierung, Abweichungsfreigabe und vollständige/teilweise Produktion.
- Produkte, SKU und Abfülllose; 1.000 × 0,75 L + 5 L Verlust verbrauchen 755 L. Im ERP-Modus führt das ERP den Flaschenbestand.
- Aufgaben, Checklisten, private PNG/JPEG/PDF-Dateien, Notizen, Offline-Entwürfe und sichtbare Versionskonflikte.
- CSV-Anfangsbestandsimport mit Mapping, persistierter Vorschau, Dateihash und Zeilenergebnissen. JSON/CSV/XLSX-Exporte mit archiviertem Snapshot und Schutz vor Tabellenformeln.
- Tatsächliche Herkunft aus dem Buchungsgraphen; unbekannte Weinberg-Herkunft bleibt unbekannt. Persistente Demo-ERP-Outbox mit Retry und Abgleich unklarer Ergebnisse.

## Lokal starten

Node.js 22.9+, pnpm 10.28.2. Die öffentliche Beispielrechnung (`/`) funktioniert ohne Zugangsdaten.

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
4. `pnpm dev:db` starten, `/login` öffnen, registrieren und einen eigenen Betrieb anlegen. MFA unter „Betrieb & Sicherheit“ einrichten.
5. [Beispieldatei](docs/examples/opening-stock.csv) im Datenhub zuordnen, Vorschau prüfen und ausdrücklich übernehmen.

Die Laufzeitanwendung verwendet `APP_DATABASE_URL` mit `NOSUPERUSER NOBYPASSRLS`, niemals den Eigentümerzugang. `DATABASE_URL` dient Migrationen und dem unveränderten Verbindungstest `/api/health`.

## Prüfung und Betrieb

```sh
pnpm db:verify       # echte PostgreSQL-Prüfungen, isolierte Testbetriebe
pnpm test:e2e       # laufender Server :5173 und Chromium erforderlich
```

Der Browser-Test durchläuft Registrierung, MFA, Import, Versuch, Freigabe, Produktion, Abfüllung, Export, Dateien, Isolation und Offline-Konflikte. Bei Bedarf `E2E_URL` und `CHROMIUM_PATH` setzen. Testkonten verwenden ausschließlich `example.invalid` und isolierte Betriebe.

[Betrieb und Grenzen](docs/operations.md) · [Bedienung](docs/user-guide.md) · [Deployment](docs/deployment.md) · [Architektur](docs/architecture.md) · [API-Vertrag](packages/contracts/openapi.json).

Neon bleibt **Free in Frankfurt**. Es wurden keine kostenpflichtigen Datenbanktarife oder Zusatzdienste gewählt. Der bestehende Vercel-Teamtarif wird nicht geändert. Live-ERP, E-Mail-Versand/Passwortreset, Optimierer, KI, Wetter, IoT und vollständige regionale Rechtsprüfung sind in [Backlog](docs/backlog.md) abgegrenzt.
