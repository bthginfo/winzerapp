# Persistente Hintergrundverarbeitung

Täglicher Vercel-Cron `/api/cron` mit `CRON_SECRET`; kein bezahlter Worker. Verarbeitet begrenzte Batches aus PostgreSQL, reale ausdrücklich konfigurierte ERP-Übergaben und optionale Mail-Digests. Browser-Datenhub bietet manuelle Verarbeitung.

`app.process_jobs` bleibt ein klar gekennzeichneter Demo-ERP-Sink, der keine externen Daten sendet. Reale Übergaben verwenden `integration_delivery`, atomare Claims, Lease/Versuchszähler, gefrorene Payload und Receipt-Vertrag. Unklare Ergebnisse werden vor jeder Wiederholung abgeglichen. Siehe `src/lib/server/deliveries.ts` im Webpaket, Migration `0026_erp_delivery.sql` und `docs/integrations.md`.

Mail-Digests benötigen SMTP, verifizierte Empfänger und freiwilliges Abonnement. Unklarer SMTP-Ausgang wird nicht blind erneut versendet. Keine persistente Schleife innerhalb einer Funktion, kein zusätzlicher Hostingdienst.
