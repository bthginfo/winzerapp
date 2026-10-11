# Demo-Betrieb erkunden

Der Demo-Betrieb enthält ausschließlich synthetische Schulungsdaten. Sein Administrator hat die Rolle **Betriebsleitung / Owner** und Zugriff auf alle Fachmodule und die Verwaltung dieses Betriebs. Die Rolle gilt innerhalb des Mandanten; sie gewährt keinen Zugriff auf fremde Weingüter.

Die Anmeldung verwendet eine E-Mail-Adresse und ein Passwort. Ein Anzeigename wie „VAdmin“ ist kein Anmelde-Identifier. Eine Adresse unter `example.invalid` oder `demo.winzerapp.invalid` ist nur für die Demo-Anmeldung gedacht und empfängt keine E-Mails. Eine echte Adresse ist nötig, sobald Mail-Verifikation oder Passwort-Wiederherstellung genutzt werden sollen.

Unter **Betrieb & Sicherheit** einen eigenen Authenticator einrichten. Freigaben, Regeln, Teamverwaltung und Verbindungen benötigen MFA. Der Seed verwendet vorübergehend die reguläre MFA-Anmeldung und entfernt diesen Faktor anschließend; er hinterlegt weder gemeinsame Authenticator-Geheimnisse noch ein Passwort im Repository.

## Rundgang

| Modul | Beispiele und nächster Schritt |
| --- | --- |
| Heute | Offene, laufende und erledigte Aufgaben mit Checklisten. Mit „DEMO starten“ beginnen. Objektkarte auf dem eigenen Gerät speichern und anschließend die Offline-Seite öffnen. |
| Weinberg | Drei Parzellen mit Polygonen, Saisons, Arbeiten, Bewässerung, Reifeproben und ausdrücklich synthetischem Wetter. Karte bewusst aktivieren; neue Reifeprobe ergänzen. |
| Lese | Vorjahres-Herkunft, abgeschlossene Lesepläne, ein offener Termin und dokumentierte kg→L-Ausbeuten. Offenen Termin bearbeiten. |
| Keller | Bewertete Grundweine, Moste, freie und gesperrte Tanks, Teilung, Rücktransfer, Verlust und Mengenjournal. QR und Herkunft öffnen. |
| Cuvées | Drei fixierte Varianten mit echten 250-ml-Bestandsentnahmen und synthetischen Blindbewertungen. Eine Cuvée wurde produziert; ein Folgeauftrag ist freigegeben und reserviert. Außerdem gibt es einen bearbeitbaren Entwurf. |
| Labor | Gärkurven, Sensor-Beispiel und Laborwerte. Hinweise zeigen passende, fehlende, veraltete und außerhalb der Spanne liegende Befunde. Eigene Kontrollmessung ergänzen. |
| Abfüllung | 1.200 Flaschen wurden mit Wein- und Verpackungsverbrauch gebucht. 240 Flaschen wurden ausgeliefert und 12 zurückgenommen: 972 sind verfügbar. Ein weiterer Plan über 300 Flaschen ist offen. |
| Hygiene | Freigegebene und unvollständige Reinigung, offene Tankwartung und abgeschlossene Pumpenwartung mit anschließender Reinigung. Gesperrten Tank erst nach dokumentierter Wartung und Reinigung freigeben. |
| Kosten | Plan/Ist, direkte Kosten, Gemeinkostenanteile, Verpackung und eine Rechnungskorrektur. Vollkosten der Cuvée und Abfüllung vergleichen. |
| Assistent | Beispielnotizen und private `DEMO-Laborbeleg-R26.pdf`. PDF unter Dateien herunterladen und in der lokalen OCR verwenden; Angaben prüfen und bewusst als Aufgabe oder Notiz speichern. Sprache benötigt die Browserfreigabe. |
| Berichte | Eingefrorene Feld-, Labor-, Kosten- und Herkunftsberichte als PDF/CSV/JSON. Interne synthetische Regeln zeigen passed/failed/unknown und sind keine Rechtsfreigabe. |
| Datenhub | Übernommene Anfangsbestände, Wetter-, Analyse- und Tank-Importe sowie eine absichtlich fehlerhafte Vorschau. Datei-Verbindung ist verfügbar; zukünftige ERP-/OpenAI-Verbindungen bleiben deaktiviert. |
| Verwaltung | Owner-Mitgliedschaft, alle Module, Region, Zeitzone und Aufbewahrung. Eigene MFA einrichten; anschließend reale Teammitglieder einladen oder Anbieter konfigurieren. |

KI, externe ERP-Übertragungen und E-Mail benötigen echte Anbieterzugänge. Die Demo schaltet keine kostenpflichtigen Dienste ein und stellt keine externen Übertragungen als erfolgreich dar. Offline-Karten, Fotos und Entwürfe werden ausdrücklich auf dem jeweils verwendeten Gerät gespeichert.

## Demo technisch anlegen oder fortsetzen

`scripts/seed-demo.mjs` verwendet die normalen öffentlichen Anwendungs-APIs, die Anmeldung und Domain-Befehle. Es benötigt keinen Datenbank-Eigentümerzugang. Vorhandene fremde Betriebe werden nicht verändert. Die Zieldomain und Zugangsdaten müssen ausdrücklich angegeben werden; im Skript steht kein Passwort.

```bash
export DEMO_URL='https://your-app.example'
export DEMO_EMAIL='your-demo@example.invalid'
read -r -s -p 'Demo-Passwort: ' DEMO_PASSWORD
export DEMO_PASSWORD
node scripts/seed-demo.mjs
unset DEMO_PASSWORD
```

Chromium und die Workspace-Abhängigkeiten müssen installiert sein; bei Bedarf `CHROMIUM_PATH` setzen. Der vorhandene Netzwerk-Proxy und die konfigurierten CA-Zertifikate werden über `scripts/browser.mjs` berücksichtigt.

Der Seed speichert seine Fortschritte ohne Passwörter, Sitzungstoken, Einladungslinks oder Sensor-Schlüssel in einer Datei mit Modus `0600`. Ihr Standardpfad ist `/tmp/vinea-demo-<Domain/E-Mail-Hash>.json`; mit `DEMO_STATE` kann ein dauerhafter privater Pfad gewählt werden. Diese Datei für einen unterbrochenen Lauf behalten. Bestandsbefehle verwenden stabile Idempotenzschlüssel. Nach erfolgreichem Abschluss dient der Betrieb der Bedienung; der Seed setzt spätere Benutzeränderungen nicht zurück.
