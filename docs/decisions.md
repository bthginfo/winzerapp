# Entscheidungen und offene Punkte

1. Name des GitHub-/Vercel-Projekts: `winzerapp`; Produktarbeitstitel: Vinea.
2. Das vom Nutzer erstellte Repository ist öffentlich; diese Sichtbarkeit wird beibehalten. Keine Lizenzannahme für öffentlichen Vertrieb. Ausschließlich synthetische Daten und Spezifikation, keine Secrets oder echten Betriebsdaten committen.
3. Stack und Paketstruktur gemäß Spezifikation: SvelteKit, TypeScript, pnpm; PostgreSQL im nächsten vertikalen Schritt.
4. DE/EN/IT/FR sind vollständig für den aktuell sichtbaren Umfang verfügbar. Fachübersetzungen vor Pilotbetrieb mit Muttersprachlern prüfen. Sprache wird per Cookie gespeichert, Zahlen mit Intl angezeigt; Rechenwerte/JSON bleiben Dezimalstrings.
5. Erstes Deployment stellt eine gekennzeichnete Projektbasis mit synthetischen Daten bereit. Kein Demo-Login in Produktion und keine öffentlich beschreibbaren Betriebsdaten.
6. Ausschließlich kostenloser Datenbanktarif: Neon `free_v3`, Frankfurt (`fra1`). Keine bezahlten Add-ons, Planwechsel oder weitere Datenbanken auswählen. Bestehende Ressourcen anderer Projekte bleiben unberührt.
7. Authentifizierung ist noch offen. Etablierter OIDC-Anbieter mit EU-Option; serverseitige Sessions und Tenantauflösung erforderlich, bevor produktive Datenspeicherung oder Bestands-API freigeschaltet wird.
8. Kein dauerhafter Worker auf Vercel-Funktionen. Worker-Hosting erst bei implementierter Outbox festlegen.
9. Region, Pilotbetrieb, ERP-Anbieter und rechtliche Regelpakete sind noch nicht entschieden. CSV zuerst; keine erfundenen Anbieter-Endpunkte.
10. Die ChatGPT-Projektinhalte waren über die verfügbaren Pages-/Spaces-Zugriffe nicht auffindbar; die angehängte MD-Datei ist die erhaltene Spezifikation.
