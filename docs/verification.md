# Verifikation des vollständigen Ausbaus

Prüfdatum: 10. Oktober 2026. Die Prüfungen verwenden echte Neon-PostgreSQL-Transaktionen und den gebauten SvelteKit-Server. Konten und Betriebe sind ausschließlich synthetisch (`example.invalid`), voneinander getrennt und enthalten keine Kundendaten. Migrationen und Fixture-Vorbereitung verwenden den lokalen Eigentümerzugang; Webaufrufe verwenden die eingeschränkte Laufzeitrolle.

| Prüfung | Ergebnis |
|---|---|
| `pnpm check` | 0 Fehler, 0 Warnungen |
| `pnpm build` | Client, Server, lokale OCR/PDF-Assets und Vercel-Adapter erfolgreich gebaut |
| pnpm 10.28.2 Frozen Lockfile | kompatibel mit der CI-/Vercel-Version |
| sauberer Checkout ohne vorhandene Abhängigkeiten/Assets | pnpm 10.28.2 Installation, alle 14 Domain-Tests und vollständiger Build erfolgreich; OCR-Core aus seiner besitzenden Abhängigkeit aufgelöst |
| `pnpm test` | 14 Tests: dezimale Mischung/Rundung, fehlende Analysen, MILP, gemeinsamer Bestand, Vollkosten und Regelprüfung |
| `pnpm db:verify` | 20 Prüfungen: Journal/Parallelität/Idempotenz, Freeze/Versuch/Freigabe/Produktion, Reservierung, ERP-Hoheit, RLS und externe Laborfreigaben |
| `pnpm db:verify:full` | 12 Prüfungen: Ausbeute, Material/Zugaben, atomare Abfüllung, Reinigung/Wartung, Kosten/Umlagen, PostGIS, Sensorik, Import, Ressourcenüberschneidung und Datei-Retry |
| `pnpm test:e2e` | 16 Ende-zu-Ende-Prüfungen des ursprünglichen Fachablaufs einschließlich Mandantentrennung, Export und Offline-Konflikten |
| `VERIFY_WEATHER=1 pnpm test:e2e:full` | 14 Prüfungen: alle Zusatzmodule, echter kostenloser DWD-Abruf/Cache, Sensortoken, Importe, Nachweissnapshots, Einladungen und Offline-Dateien |
| Zusatzmodule im Browser | alle 13 Seiten in DE/EN/IT/FR, keine JavaScript-Seitenfehler; mobile Ansicht mit 390 px |
| lokale OCR im Browser | PNG, PDF mit Text und gescanntes PDF erkannt; Entwurf ausdrücklich bestätigt und ohne KI-Anbieter als Aufgabe gespeichert |
| `scripts/verify-adapters.mjs` | 3 Prüfungen: Timeout nach angenommener ERP-Übertragung wird vor Wiederholung abgeglichen, Fremdmandant geblockt, persistente KI-Quota/Replays begrenzt |
| `scripts/verify-cost-pagination.mjs` | 500 + 1 Datensätze paginiert, Vollkosten enthalten sämtliche 501 Buchungen |
| Cron / private API | ohne Bearer-Schlüssel bzw. App-Sitzung 401; autorisierter Cron-Batch erfolgreich, ohne SMTP kein Versand |
| `scripts/verify-restore.mjs` | 3.572 verschlüsselt gesicherte Zeilen in isolierter leeren Datenbank wiederhergestellt; alle Tabellenanzahlen, Journalbalance, Bestands-Rebuild und private Dateihashes stimmen; nichtleerer Restore abgewiesen |
| Migrationsintegrität | alle 30 Produktions-Prüfsummen stimmen mit den Release-Dateien überein |
| Repository-Prüfung | kein Whitespace-Fehler; Credential-Musterprüfung bestanden; Secrets, Backups und generierte OCR-Dateien ausgeschlossen |

## Reproduktion

Zuerst `pnpm build`, anschließend mit den ignorierten lokalen Umgebungsdateien `pnpm preview:db` starten. Für Browserprüfungen bei anderem Port `E2E_URL=http://localhost:PORT` setzen. Chromium muss installiert sein. Die zusätzlichen DB-/Adapter-/Restore-Skripte benötigen dieselben lokalen DB-Variablen wie die dokumentierten DB-Prüfungen; Restore zusätzlich `BACKUP_KEY` aus `.env.backup.local`. Restore legt eine eigene temporäre logische Datenbank an und entfernt ausschließlich diese nach Abschluss. Während des Tabellenvergleichs keine anderen Fixture-Schreiber ausführen.

Bei externen URLs berücksichtigt der Browser-Test `HTTPS_PROXY`/`HTTP_PROXY` auch für seine API-Requests. Explizit über `NODE_EXTRA_CA_CERTS` vertraute Zertifikate werden anhand ihrer öffentlichen Schlüsselfingerprints in Chromium übernommen; andere Zertifikatsfehler werden nicht pauschal deaktiviert. Fehlerausgaben enthalten keine Request-Header oder Sitzungscookies.

## Live-Prüfung

Die stabile Produktionsadresse https://winzerapp.vercel.app wurde mit dem Anwendungsstand `13c0c251578c929d5f88e540bbd001b48da59add` / Vercel-Deployment `dpl_26ydTgkDBzNugqJzCSK4tRXoVr9w` (READY) geprüft. GitHub CI für diesen Stand ist erfolgreich. Öffentlicher Login DE/EN/IT/FR, Healthcheck über die Laufzeitrolle, neue Modul-Assets und 401 ohne App-Sitzung/Cron-Schlüssel bestehen. Zusätzlich bestehen **alle 16 ursprünglichen und alle 14 erweiterten Browserprüfungen gegen Produktion**, einschließlich OCR, echtem DWD-Abruf, MFA, vollständigem Mengenablauf, Einladungen, 52 Modul-/Sprachansichten und Offline-Dateien. Die anschließenden Änderungen an Testharness und Dokumentation verändern den Anwendungscode nicht.

## Grenzen des Nachweises

OpenAI und SMTP sind mangels kundenseitigem Zugang nicht live aktiviert oder als produktiv zugestellt getestet. Die ERP-Schreibprüfung nutzt einen synthetischen Anbieter-Vertrag und echte DB-Zustände; echte Herstellerzugänge müssen entsprechend ihrer freigegebenen API geprüft werden. Regionales Recht wird nicht aus Beispielregeln abgeleitet. Sprachaufnahme hängt von Browser und dessen Sprachdienst ab. Physische Smartphone-Piloten, fachliche Übersetzungsprüfung und önologische/regulatorische Abnahme erfordern die beteiligten Menschen und Geräte. Diese Aktivierungs- und Abnahmepunkte sind in [feature-status.md](feature-status.md) und [backlog.md](backlog.md) beschrieben.

## UI-/UX-Überarbeitung · 12. Oktober 2026

Der geprüfte Produktionsbuild besteht `pnpm check` mit **0 Fehlern / 0 Warnungen**, die Domain-Tests und `pnpm build`. Gegen die lokale Produktions-Preview bestehen **16 ursprüngliche Browserprüfungen** und **7 neue UX-Prüfgruppen**. Diese prüfen alle 13 Module und die vier Sprachen, alle 39 deutschen Modul-/Ansicht-Kombinationen mit axe-core 4.10.3 (keine gefundenen WCAG-Regelverletzungen), Tastatur-Schnellzugriff, tatsächliche Sortierung und Filter-Rücksetzung, lokale Parzellen, simulierten HTTP-403 der Basiskarte, Origin-only-Referer, Mobilnavigation bei 390 px und einen tatsächlichen Task-Formularablauf bis zur Datenbank und zurück zur Aufgabenkarte. Browser-JavaScript-Fehler: **0**. Die erweiterten Fach-/Offline-Prüfungen bestehen mit **13 Prüffällen**; der optionale Live-Wettertest war in diesem Lauf deaktiviert.

Der Map-Test zeigt: ohne Einwilligung keine Basiskarten-Kacheln; bei 403 keine Fehlerkacheln, Parzellen weiter sichtbar. Echte Basiskarten-Aufrufe senden ausschließlich die Origin und haben einen funktionierenden Fehlerzustand. Der Kartenservice wird nicht als garantiert verfügbar dargestellt. Demo-Zugänge wurden für die Prüfung nur gelesen; neue Aufgaben/Buchungen entstehen in gesonderten Testbetrieben.

UX-Test: `E2E_URL=http://localhost:PORT node scripts/ux-e2e.mjs`. Optional `AXE_PATH` auf eine lokal installierte axe-core-Datei setzen; für lesende Ansichten des bestehenden Demo-Betriebs `DEMO_PASSWORD` ausschließlich im Prozessspeicher bereitstellen. Ohne Demo-Passwort registriert der Test einen separaten Testbetrieb. Keine Zugangsdaten, Browser-Sitzungen oder privaten Screenshots werden im Repository gespeichert.

[Audit und Gestaltungsentscheidungen](design/ux-audit.md). Automatisierte axe-Prüfungen ersetzen keine manuelle Screenreader- oder Nutzungsstudie.
