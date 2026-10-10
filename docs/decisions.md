# Entscheidungen und offene Punkte

1. Name des GitHub-/Vercel-Projekts: `winzerapp`; Produktarbeitstitel: Vinea.
2. Das vom Nutzer erstellte Repository ist öffentlich; diese Sichtbarkeit wird beibehalten. Keine Lizenzannahme für öffentlichen Vertrieb. Ausschließlich synthetische Daten und Spezifikation, keine Secrets oder echten Betriebsdaten committen.
3. Stack und Paketstruktur gemäß Spezifikation: SvelteKit, TypeScript, pnpm; PostgreSQL mit atomarem Command-Service.
4. DE/EN/IT/FR sind vollständig für den aktuell sichtbaren Umfang verfügbar. Fachübersetzungen vor Pilotbetrieb mit Muttersprachlern prüfen. Sprache wird per Cookie gespeichert, Zahlen mit Intl angezeigt; Rechenwerte/JSON bleiben Dezimalstrings.
5. Erstes Deployment stellt eine gekennzeichnete Projektbasis mit synthetischen Daten bereit. Kein Demo-Login in Produktion und keine öffentlich beschreibbaren Betriebsdaten.
6. Neon `winzerapp` wurde mit Tarif **Free (`free_v3`)** in Frankfurt (`fra1`) erstellt; Resource-ID `store_XaZiaJMJ79R9DZFa`, Neon-Projekt `little-recipe-15893257`. Mit Production und Development verbunden; Preview erhält keinen Zugriff auf die Produktionsdatenbank. Der Vercel-Workspace hatte bereits Pro; es wurde kein Hosting-Tarif geändert und kein bezahlter Datenbanktarif ausgewählt. Bestehende Ressourcen anderer Projekte bleiben unberührt.
7. Der Nutzer ersetzt OIDC ausdrücklich durch kostenlosen Better-Auth-Login mit E-Mail/Passwort. Serverseitige DB-Sessions, TOTP, Rollen und Tenantauflösung sind implementiert; Details in `adr/0001-mvp-auth.md`.
8. Kein dauerhafter Worker auf Vercel-Funktionen. Persistente Outbox/ERP-Übergaben innerhalb kurzer Requests und täglicher Vercel-Cron; kein zusätzlicher Hostingdienst.
9. Region, Pilotbetrieb, ERP-Anbieter und rechtliche Regelpakete sind noch nicht entschieden. Weingut wählt individuell Dateien oder bestätigte API-Verträge; kein globales ERP vorausgesetzt und keine erfundenen Anbieter-Endpunkte.
10. Die ChatGPT-Projektinhalte waren über die verfügbaren Pages-/Spaces-Zugriffe nicht auffindbar; die angehängte MD-Datei ist die erhaltene Spezifikation.

11. Vollständiger Ausbau über den ursprünglichen MVP ist vom Nutzer beauftragt. Der Status steht in `feature-status.md`; Softwarefunktionen und kundenspezifische Aktivierung werden getrennt dokumentiert.
12. OpenAI und Maildienst sind derzeit nicht vorhanden. Die implementierten Verbindungen bleiben ohne Credentials deaktiviert; kein Anbieter-/Tarifkonto wird angelegt. ERP wird individuell je Tenant konfiguriert.
13. Dateien bleiben im privaten, begrenzten Datenbankspeicher auf Neon Free. Sprach-/OCR-Modelle sind statische öffentliche App-Assets; private Dokumente werden für OCR nicht an einen externen Dienst gesendet.
