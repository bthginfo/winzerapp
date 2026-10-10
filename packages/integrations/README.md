# Integrationsverträge

Serverseitige Adapter in `apps/web/src/lib/server/live-adapters.ts` und `deliveries.ts`; tenantbezogene Konfiguration und AES-256-GCM-Credentials. Capability-Manifeste kennzeichnen bestätigte Lesefähigkeiten und begrenzte Schreibverträge. Kein angenommener Hersteller-Endpunkt.

Dateiimporte, dokumentierter Winestro-v22-Artikelabruf, bestätigte HTTPS-GET-Verträge für vintrace/generische APIs, generische Produktionsübergabe mit Reconciliation, DWD/Bright Sky, HTTPS-Sensor-Gateway, optionale OpenAI-Entwürfe/Embeddings und SMTP. Kundenzugänge werden nicht gekauft oder vorgetäuscht.

Details und bestätigter Receipt-Vertrag: `docs/integrations.md`. Reale PostgreSQL-Claims plus ein ausdrücklich synthetischer Remote-Adapter werden durch `scripts/verify-adapters.mjs` geprüft.
