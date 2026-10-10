# Vercel und Neon Free

Vercel-Projekt `winzerapp`, Root Directory `apps/web`, SvelteKit, Node.js 22.x, Workspace-Dateien außerhalb Root Directory erlaubt, Funktionsregion `fra1`. Repository: `bthginfo/winzerapp`; Push auf `main` löst Produktion aus. Keine bezahlte Build-Maschine oder neue Integration buchen.

Bestehende Neon-Resource `store_XaZiaJMJ79R9DZFa` / Projekt `little-recipe-15893257`, Plan **Free (`free_v3`)**, Frankfurt. Production und Development sind verbunden; Preview ist bewusst nicht mit Produktionsdaten verbunden. Der Vercel-Teamtarif besteht bereits und wird nicht verändert.

## Reihenfolge

1. Bestehende Datenbank sichern, Migrationszugang nur lokal laden.
2. `pnpm db:migrate`: versionierte SQL-Dateien mit Checksumme; Laufzeitrolle ohne RLS-Bypass.
3. `APP_DATABASE_URL` aus der ignorierten `.env.runtime.local` als verschlüsselte Variable für Production/Development konfigurieren.
4. `BETTER_AUTH_SECRET` für Production mit stabilen mindestens 32 Zufallsbytes; `BETTER_AUTH_URL=https://winzerapp.vercel.app`. Entwicklungssecret separat verwenden und lokale URL auf `http://localhost:5173` setzen.
5. `INTEGRATION_ENCRYPTION_KEY` und `CRON_SECRET` als verschlüsselte Production/Development-Variablen konfigurieren; keine SMTP- oder OpenAI-Werte ohne Providerzugang.
6. `pnpm check`, `pnpm test`, `pnpm build`, echte DB- und Browserprüfungen ausführen.
7. Commit auf `main` pushen, Vercel-Build prüfen. Die stabile Produktionsdomain ist öffentlich erreichbar und wird durch App-Login/Memberrechte geschützt. Einzelne Deployment-URLs und alle Previews behalten Vercel Authentication (`prod_deployment_urls_and_all_previews`); solche URLs Vercel-authentifiziert testen, Schutz nicht für Tests abschalten.
8. `/api/health`, `/api/auth/ok`, Registrierung, Betrieb, MFA und Fachablauf prüfen.

Kein produktiver Login mit Eigentümerzugang. Kein DB-Migrationsskript im Web-Build. Unkonfigurierte Previews können die öffentliche Beispieloberfläche anzeigen; für private Fachmodule ist eine eigene isolierte Free-Datenbank erforderlich. Keine Produktionssecrets pauschal nach Preview kopieren.

Für einen neuen Betrieb als normaler Benutzer registrieren; keine Testpasswörter oder gemeinsamen Administratorzugänge. Weitere Mitglieder erhalten einen personenbezogenen Einladungslink aus „Betrieb & Sicherheit“, registrieren sich mit genau der eingeladenen E-Mail-Adresse und nehmen die Einladung an. Ein Link ist sieben Tage gültig und widerrufbar. Einen externen Versanddienst erst nach gesonderter Konfiguration aktivieren.

Der Root-Build muss `node ../../scripts/prepare-ocr.mjs && pnpm build` oder den Monorepo-Build `pnpm --dir ../.. build` ausführen; sonst fehlen lokale OCR/PDF-Assets. `vercel.json` im Root des deployten Webprojekts enthält den täglichen Cron. Keine Migration während des Vercel-Builds ausführen.
