# Verbindungen je Weingut

Jedes Weingut wählt seine Quellen im Datenhub. Kein globaler ERP-Zwang. Credentials sind AES-256-GCM-verschlüsselt; nur serverseitige Aufrufe entschlüsseln sie. `INTEGRATION_ENCRYPTION_KEY` stabil halten und getrennt sichern. Auswahl/Änderung benötigt Betriebsleitung und TOTP.

## Dateien und Mapping

CSV, JSON-Array oder XLSX (erste Tabelle) hochladen, Profil wählen, Spalten und Dezimaltrennzeichen zuordnen, Vorschau prüfen, dann übernehmen. Ein Mapping kann als neue unveränderliche Profilversion gespeichert werden. Die unveränderte Datei wird mit Hash erhalten; Mappingfehler und Zeilenfehler werden angezeigt. Keine stillen Änderungen vorhandener Stammdaten. Wiederholung desselben Imports erzeugt keine zweite Buchung.

Profile: Anfangsbestand, Gefäße, Parzellen, Analysen, Verpackungs-/Behandlungsmaterial, Artikel, Ernten, Feldarbeiten, Wetterstationen. Mengen als Dezimalstrings; Datum/Zeit mit Offset. JSON-Objekte in Feldern bleiben als JSON-Text erhalten. Mehr als 5.000 Zeilen, 50 Spalten oder 2 MB Originaldatei zuerst aufteilen. Exporte sind mandantengefiltert; CSV für einzelne Tabellen über `/api/export?format=csv&collection=analyses`. BI-Seiten: `/api/read?collection=analyses&limit=100`, danach den `next_cursor` verwenden. Für einen unveränderlichen Gesamtdatenstand einen Snapshot-Export verwenden.

## Anbieter

- **Winestro:** dokumentierte v22-Shop-API, `getArtikel`, JSON und verfügbarer Artikelbestand. Zugang `UID`, `apiUSER`, `apiCODE`, `apiShopID` vom Kunden. Der gelieferte Bestand kann Reservierungen bereits abziehen; kein erneuter Abzug. Keine behauptete Kellerbuch-/Partien-API.
- **vintrace / API-Vertrag:** nur bestätigte HTTPS-GET-Endpunkte und passende Credentials; Berechtigungen/Tarif vom Kunden/Anbieter prüfen. Betreiber setzt `ERP_ALLOWED_HOSTS` auf geprüfte Hostnamen. API-Verträge dürfen Hosts nicht selbst freischalten. Keine Redirects, kein http, keine eingebetteten Benutzerpasswörter, keine fremden Ports. API-Snapshots können heruntergeladen und nach Prüfung im Importassistenten zugeordnet werden; sie überschreiben keine Weinbestände automatisch.
- **Generische Produktionsübergabe:** optionaler POST-/Abgleichvertrag, separat fachlich bestätigen. Genau eine persistente Übergabe je Verbindung/Abfülllos. SKU-Referenz erforderlich. Materialien/Kosten und tatsächliche Abfüllwerte werden als Snapshot übertragen. `Idempotency-Key` ist die unveränderliche `event_id`.

### Receipt-Vertrag für generische Schreibadapter

Dieser Vertrag definiert die unterstützte App-Integration, keine behauptete Hersteller-API. Der Betreiber des Zielsystems muss eine passende Adapterroute bzw. einen bestätigten Hersteller-Endpunkt bereitstellen.

POST an den vereinbarten Produktions-Endpunkt: JSON mit `schema_version:1`, `event_id`, `event_type:bottling.completed`, Los/SKU-Referenz, tatsächlichen Mengen und Material-/Kostenbelegen. Das Ziel dedupliziert atomar nach `event_id` und bestätigt:

```json
{"event_id":"uuid-from-request","status":"accepted","external_id":"remote-production-id"}
```

GET an den vereinbarten Abgleich-Endpunkt mit `?event_id=…` bestätigt `accepted`, `pending` oder `not_found` (letzteres bedeutet nachweislich noch nicht angenommen). Vor jeder Wiederholung nach Timeout zuerst GET. Unbekannte/ungültige Antwort bleibt `ambiguous`; kein blindes Wiederholen. Maximal fünf Versuche, danach sichtbar `failed`. Ein erneuter POST verwendet denselben Schlüssel. Manuelle Verarbeitung im Datenhub oder täglicher Cron. Das Demo-ERP bleibt getrennt und kennzeichnet jede Quittung als nicht extern übertragen.

## Wetter / Sensoren

Bright Sky ist ein kostenloser Zugriff auf DWD-Daten. Wetteransicht speichert Zeit, Quelle, räumliche Zuordnung und Mess-/Prognosedaten. Im internationalen Einsatz fehlende Abdeckung sichtbar behandeln und lokale Stationsdateien verwenden. Arbeitsfenster sind konfigurierte Hinweise, keine automatische Ausführung.

HTTPS-Gateway: Token im Labor erstellen (nur einmal angezeigt), mit Bearer-Header `/api/sensors/ingest` aufrufen. Body: `message_id` und 1–100 `records` mit `measured_at` (ISO/Offset) und `value` als Dezimalstring. Token gilt nur für die konfigurierte Partie/Parameter/Einheit/Methode. MQTT-Geräte benutzen einen kundenseitigen HTTPS-Gateway; keine ausgehenden Steuerbefehle.

## OpenAI / OCR / Sprache

OpenAI standardmäßig deaktiviert. Je Betrieb API-Key, Modell, tägliche Requestgrenze und maximale Ausgabetokens einstellen; Datenschutz und mögliche Kosten ausdrücklich bestätigen. Es wird kein Providerkonto/Tarif angelegt. `store:false`, keine Tools, keine endgültigen Buchungen, Quelldaten und Freigaben manuell prüfen. Semantischer Index optional mit explizitem Embeddingmodell; pro Lauf maximal 50 Dokumente, veraltete oder nicht mehr berechtigte Treffer verworfen.

PNG/JPEG-OCR und PDF-Text/OCR laufen im Browser. Eigene versionierte Sprachmodelle (DE/EN/IT/FR) und PDF-Worker werden vom App-Host geladen; Dokumente gehen dabei nicht an einen OCR-Anbieter. Grenzen: 2 MB, PDF maximal zehn Textseiten bzw. drei Scan-Seiten, begrenzte Pixelzahl. Immer Vorschau und ausdrückliche Erfassungsbestätigung. Browser-Spracherkennung nur mit separater Zustimmung, da der Browser einen externen Sprachdienst verwenden kann; kein automatischer Start.

## E-Mail

Optional `SMTP_HOST`, `SMTP_PORT` (465 oder 587 mit TLS), `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`. Vor Anschluss keine fiktive Zustellung: Einladungslink privat teilen. Nach Anschluss Verifikation und Passwortreset sowie freiwilliger täglicher Aufgaben-Digest an verifizierte Adressen. Unklarer SMTP-Ausgang wird nicht blind wiederholt.
