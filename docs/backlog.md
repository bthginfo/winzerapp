# Abgegrenzte Folgeausbauten

Das MVP deckt den in Abschnitt 12/13 der Spezifikation beschriebenen Kernablauf ab. Weitere Ausbauten werden nicht als bestehende Integration dargestellt:

- Live-ERP erst mit dokumentierter Ziel-API, API-Zugang, Capability-Mapping und bestätigter Bestandsführerschaft; derzeit ausschließlich persistenter Demo-Adapter.
- E-Mail-Verifikation, Einladung und Passwortreset erst mit echtem Versanddienst. Aktuell Registrierung und ausdrückliche Zuordnung vorhandener Benutzer-IDs.
- Großbetriebsoptimierung: Cursor-Pagination, Streaming großer Exporte/Backups und gezieltere Sperren statt Serialisierung je Betrieb.
- Vollständige Schlagkartei, Pflanzenschutz, Wetterdaten, Wartung und umfassende Kostenrechnung.
- Geometrie-Bearbeitung/Karten und PostGIS; Basismodelle speichern derzeit optionales GeoJSON.
- Geprüfte regionale Regelpakete und Rechtsklassifikation, sensorische Modelle, LP/MILP-Optimierer.
- Sprach-/KI-Notizen, OCR, semantische Suche und Sensor/IoT-Anbindung erst in Phase 3 mit bestätigtem Provider und Kostenrahmen.
- Zusätzliche Importprofile (Labor, Parzellen, Artikel/XLSX-Eingang) neben dem getesteten CSV-Anfangsbestandsprofil.
- Automatisierte Hintergrundverarbeitung und Versand nach geklärtem kostenlosen Betriebsweg; derzeit ausdrücklich manueller Outbox-Lauf.
- Fachliche Pilotabnahme, messbare Backup-/Restore-Ziele und mobile Tests auf den konkret eingesetzten Geräten.
