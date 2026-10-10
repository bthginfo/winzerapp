# Kunden- und Betriebsabhängige Aktivierung

Der ehemalige MVP-Folgeausbau ist implementiert; der aktuelle Funktionsumfang steht in [feature-status.md](feature-status.md). Die folgenden Punkte verlangen echte Kundendaten bzw. fachliche Abnahme, keine kostenpflichtige Provisionierung durch die App:

- OpenAI-Key und gewünschte Modelle pro Weingut hinterlegen, Datenschutz und Kosten explizit bestätigen. Ohne Verbindung bleiben Text, lokale OCR und Stichwortsuche nutzbar.
- SMTP-Dienst verbinden; dann E-Mail-Verifikation, Passwortreset, Einladungsversand und freiwillige tägliche Aufgaben-Erinnerung aktivieren.
- Kunden-ERP auswählen, dokumentierte Endpunkte und Rechte prüfen, vom Betreiber freigegebenen HTTPS-Host konfigurieren und externe Artikel-/Material-IDs zuordnen. Bis dahin CSV/JSON/XLSX verwenden. Winestro-Artikelabruf stellt keine universelle Keller-API dar.
- Weinregion und fachlich geprüfte regionale Regelpakete/amtliche Meldeformate je Weingut festlegen. Synthetisches Beispielpaket ausdrücklich kein Gesetz.
- Pilotabnahme auf den tatsächlich genutzten Smartphones, mit realen Pumpenwegen, Messmethoden, Arbeitsbelegen und Backup-Zielen durchführen.

Kein bezahlter Datenbanktarif und kein zusätzlicher kostenpflichtiger Provider werden automatisch ausgewählt.
