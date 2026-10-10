# Vercel und kostenlose Datenbank

## Webprojekt

GitHub-Repository `winzerapp` importieren. Framework **SvelteKit**, Root Directory **apps/web**, Node.js **22.x**. Zugriff auf Workspace-Dateien außerhalb der Root Directory zulassen. Mit pnpm aus dem Repository-Lockfile installieren. Der Vercel-Adapter baut Node-Funktionen für Frankfurt (`fra1`). Keine kostenpflichtigen Build-Maschinen oder Add-ons aktivieren.

Die Planungsoberfläche benötigt keine Umgebungsvariablen. `/api/health` prüft mit dem serverseitigen `DATABASE_URL` die PostgreSQL-Verbindung und liefert bei Erfolg `{ "status": "ok", "database": "connected" }`; sonst HTTP 503 ohne technische Fehlerdetails.

## Neon Free

Bereits erstellt und verbunden: Neon-Resource `store_XaZiaJMJ79R9DZFa`, externer Projektname `little-recipe-15893257`, Anzeigename `winzerapp`, **Free (`free_v3`)**, Frankfurt. Verbindung zu Production und Development. Nicht erneut provisionieren.

Referenz für ein späteres, neues isoliertes Setup:

- Plan **Free**, API-Kennung `free_v3`; niemals Launch/Scale auswählen.
- Region Frankfurt `fra1`.
- Name `winzerapp`.
- Mit dem Vercel-Projekt `winzerapp` verbinden.
- Verbindung ausschließlich als serverseitiges `DATABASE_URL`; niemals mit öffentlichem Präfix.

Tarifgrenzen direkt in der aktuellen Anbieteranzeige prüfen. Bei nicht verfügbarem Free-Angebot stoppen, keine bezahlte Alternative buchen. Bestehende Datenbanken anderer Projekte nicht wiederverwenden. Das erzeugte Secret nur im Anbieter/Vercel konfigurieren, nicht in Chat oder GitHub posten.

Migration `packages/db/migrations/0001_identity.sql` ist vorbereitet, aber wird nicht automatisch ausgeführt. Vor Aktivierung: Datenbank verbinden, etablierten OIDC-Login und serverseitige Sessions implementieren, Rollen/RLS mit zwei echten Test-Tenants verifizieren. Dann Migration mit eigenem Migrationszugang ausführen; Anwendungsrolle ohne BYPASSRLS/Superuser einsetzen.

## Betrieb vor Pilot

Keine echten Betriebsdaten vor Authentifizierung und dem getesteten Buchungskern. Backup-/Restore-Verfahren und die tatsächlich im kostenlosen Tarif verfügbaren Aufbewahrungsgrenzen prüfen. Vollständige Produktionsabnahme nach Abschnitt 11 und 13 der Produktspezifikation.
