# Verifikation des vollständigen Ausbaus

Prüfdatum: 10. Oktober 2026. Die Prüfungen verwenden echte Neon-PostgreSQL-Transaktionen und den gebauten SvelteKit-Server. Konten und Betriebe sind ausschließlich synthetisch (`example.invalid`), voneinander getrennt und enthalten keine Kundendaten. Migrationen und Fixture-Vorbereitung verwenden den lokalen Eigentümerzugang; Webaufrufe verwenden die eingeschränkte Laufzeitrolle.

| Prüfung | Ergebnis |
|---|---|
| `pnpm check` | 0 Fehler, 0 Warnungen |
| `pnpm build` | Client, Server, lokale OCR/PDF-Assets und Vercel-Adapter erfolgreich gebaut |
| pnpm 10.28.2 Frozen Lockfile | kompatibel mit der CI-/Vercel-Version |
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

## Grenzen des Nachweises

OpenAI und SMTP sind mangels kundenseitigem Zugang nicht live aktiviert oder als produktiv zugestellt getestet. Die ERP-Schreibprüfung nutzt einen synthetischen Anbieter-Vertrag und echte DB-Zustände; echte Herstellerzugänge müssen entsprechend ihrer freigegebenen API geprüft werden. Regionales Recht wird nicht aus Beispielregeln abgeleitet. Sprachaufnahme hängt von Browser und dessen Sprachdienst ab. Physische Smartphone-Piloten, fachliche Übersetzungsprüfung und önologische/regulatorische Abnahme erfordern die beteiligten Menschen und Geräte. Diese Aktivierungs- und Abnahmepunkte sind in [feature-status.md](feature-status.md) und [backlog.md](backlog.md) beschrieben.
