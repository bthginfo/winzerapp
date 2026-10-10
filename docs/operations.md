# Betrieb und Grenzen

## Zugang und Sicherheit

App-Login und Vercel Deployment Protection sind getrennt. Die stabile Produktionsdomain braucht keinen Vercel-Account. Geschützte Vorschau-/Deployment-URLs brauchen zusätzlich Vercel-Anmeldung; Betriebsrechte entstehen ausschließlich durch Better Auth und Membership. Aktuelle Rollen werden bei jedem Fachaufruf geprüft. Privilegierte Aktionen brauchen MFA. Wiederherstellungscodes offline sicher aufbewahren. Ein E-Mail-Passwortreset ist ohne konfigurierten Versanddienst nicht verfügbar; keine fiktive Zustellung.

Browserlisten laden zunächst 500 Einträge; weitere Einträge können über die paginierte Read API geladen werden. Exporte lesen die vollständigen Ressourcen. Fotos/Dokumente: PNG, JPEG, PDF; 2 MB/Datei und 32 MB/Betrieb in der vorhandenen Free-Datenbank. QR-Kamerascan hängt von BarcodeDetector-Unterstützung ab, manuelle Suche funktioniert überall. Offline-Entwürfe sind lokale Daten auf dem Gerät; bei gemeinsam genutzten Geräten stets ordentlich abmelden.

## Buchungen und Fehler

Gleicher Idempotency-Key und gleiche Payload liefern das Originalergebnis. Andere Payload beim gleichen Key wird abgewiesen. Versionskonflikt: Daten neu laden und Eingabe prüfen. Bestandskorrektur braucht Begründung und ursprüngliche Operation-ID aus dem Journal; Historie wird niemals überschrieben.

Sperren, Reservierungen und Zielkapazität werden serverseitig geprüft. Belegte Zieltanks dürfen nicht still überschrieben werden. Herkunft wird aus tatsächlichen Entnahmen gebildet; Jahrgang/Region/Sensorik sind keine automatische rechtliche Zulässigkeitsprüfung. Freigabe verlangt ausdrückliche manuelle Prüfung. Beispielrechnung und geschätzter Alkohol sind keine Nachanalyse.

## Integration und Überwachung

Demo-ERP verarbeitet persistente Aufträge manuell über den Datenhub. Erfolgreiche Demo-Quittungen sind lokal, nicht extern übertragen. Unklare Ergebnisse werden zuerst abgeglichen. Zusätzlich verarbeitet ein täglich authentifizierter Vercel-Cron persistente Aufträge, reale konfigurierte ERP-Übergaben und optionale Mail-Digests. Kein kostenpflichtiger Worker wurde eingerichtet. Live-ERP benötigt einen bestätigten API-Vertrag, Credentials, Hostfreigabe und Capability-Mappings; Details in integrations.md.

Prüfen: `/api/health`, Vercel-Fehlerprotokolle, Outbox-Status/Alter, Import-Zeilenfehler, Versionskonflikte und ausgeglichene Journal-Summen. Ein HTTP-Healthcheck prüft Verbindung, nicht den ganzen Fachprozess. Regelmäßig den Browser-Abnahmeablauf und `pnpm db:verify` in isolierten Testbetrieben ausführen.

## Verschlüsseltes Backup und Restore

Der Free-Tarif garantiert die in der Produktspezifikation vorgeschlagenen RPO-/RTO-Ziele nicht. Aktuelle Neon-Aufbewahrung direkt im Anbieter prüfen; keine bezahlte Option automatisch aktivieren. Exporte ersetzen kein vollständiges Datenbankbackup: Sie enthalten keine Auth-Daten oder Datei-Inhalte.

`packages/db/scripts/backup.mjs` sichert alle Fach- und Better-Auth-Tabellen in einem konsistenten Repeatable-Read-Snapshot. NUMERIC bleibt Text, Dateien werden verlustfrei gespeichert. Das Ergebnis ist AES-256-GCM-verschlüsselt. `BACKUP_KEY` muss 32 zufällige Bytes in Base64url enthalten, außerhalb des Repositories verwahrt werden und zusammen mit dem stabilen `BETTER_AUTH_SECRET` und `INTEGRATION_ENCRYPTION_KEY` verfügbar bleiben. Dateiname/Schlüssel niemals öffentlich teilen.

```sh
node --env-file=.env.local --env-file=.env.backup.local packages/db/scripts/backup.mjs backup backups/vinea.enc
```

Restore ausschließlich in eine **isolierte leere** Datenbank: passendes Schema mit dem Migrationsskript anlegen, anschließend deren Eigentümerzugang als `DATABASE_URL` laden. Das Restore-Skript verweigert nichtleere Fach-/Auth-Tabellen, prüft Verschlüsselung und Spaltenschema und fügt alle Daten in einer Transaktion ein; es löscht keinen Bestand.

```sh
RESTORE_CONFIRM=ISOLATED_EMPTY_DATABASE node --env-file=.env.restore.local --env-file=.env.backup.local packages/db/scripts/backup.mjs restore backups/vinea.enc
```

Vor produktiver Wiederherstellung: isolierten Restore, Tabellenanzahl, Journalabgleich, Anmeldung mit stabiler Auth-Konfiguration und private Dateidownloads prüfen. Wiederherstellungszeit messen. Ein bezahlter PITR-Tarif wird durch diesen Ablauf nicht vorausgesetzt oder gebucht.

## Zusätzliche Fachmodule

Siehe [Funktionsumfang](feature-status.md) und [Verbindungen](integrations.md). Physische Reinigung, Pflanzenschutzbelege und regionale Regelpakete werden durch den Betrieb fachlich geprüft. Die App verwendet gespeicherte Quellen/Gültigkeiten und meldet fehlende Daten als unbekannt. Kein öffentlicher API-Endpunkt kann globale Worker-Funktionen ohne `CRON_SECRET` ausführen.

Umweltvariablen `CRON_SECRET` und `INTEGRATION_ENCRYPTION_KEY` nur Production/Development zuweisen. Preview erhält keine Produktionsdaten oder Credentials. Alle Testbenutzer und Testbetriebe sind synthetisch.
