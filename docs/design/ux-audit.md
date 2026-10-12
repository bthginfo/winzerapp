# UX-/UI-Audit und Überarbeitung

Prüfung am 12. Oktober 2026. Grundlage: laufende Anwendung, alle 13 Fachmodule, vorhandene Demo-Daten, Quellcode sowie Desktop- und Mobilansichten. Es handelt sich um eine heuristische Prüfung mit technischen Bedienungstests, nicht um eine Nutzungsstudie oder eine WCAG-Zertifizierung.

## Urteil

Der Fachkern war umfangreich, seine Oberfläche stellte jedoch Daten und Befehle gleichzeitig und weitgehend gleichrangig dar. Die Hauptschwäche war die fehlende Führung durch einen Arbeitsablauf. Mehr dekorative Karten allein hätten diese Schwäche nicht behoben. Das neue System trennt Orientierung, Durchführung und Nachschlagen.

## Befunde und Entscheidungen

| Priorität | Befund | Praktische Folge | Umgesetzte Entscheidung |
| --- | --- | --- | --- |
| P0 | Die Basiskarte lädt direkt OpenStreetMap-Kacheln; die globale Referrer-Regel unterdrückt den nötigen Referer. Im Fehlerfall fehlt eine brauchbare Darstellung. | Wiederholte Fehlerkacheln verdecken die Parzellen. | Lokale Parzellenansicht ohne externen Abruf; Straßenkarte ausdrücklich laden. Für Kartenabrufe ausschließlich die App-Origin senden, einen sichtbaren Tile prüfen und bei Fehlern auf die Parzellenansicht zurückfallen. |
| P1 | „Heute“ ist in der Demo 4.741 px hoch; Cuvées 5.617 px. | Häufiges Scrollen, wichtige Schritte gehen zwischen Registern unter. | Drei klar bezeichnete Ansichten: Überblick, Arbeitsbereich, Register & Verlauf. Aufgaben als kompakte Karten mit Filter und begrenzter Erstansicht. |
| P1 | Cuvées enthält 13 gleichzeitig vorhandene Formulare; Keller ebenfalls 13. | Auswahl überfordert; Planung und verbindliche Buchung wirken gleichrangig. | Prominente primäre Aktion, vollständiger Aktionskatalog und fokussierter Dialog. Cuvée-Schritte von Projekt bis Produktion sichtbar ordnen. |
| P1 | Register zeigen lange, dichte Tabellen ohne Sortierung oder lokale Seitennavigation. | Schwer scanbar; Suche erfordert Kenntnis der internen Darstellung. | Filter, sortierbare Spalten, 10/25/50 Zeilen, lokale Seitennavigation, numerische Ausrichtung und verständliche Referenzen. Die bestehende serverseitige Nachladung bleibt erhalten. |
| P1 | Labor startet ohne ausgewählte Partie; Messreihen unterschiedlicher Methoden verhindern die gesamte Kurve. | Eine vorhandene Gärkurve bleibt zunächst unsichtbar. | Aktive Gärpartie vorauswählen; Reihen nach Methode und Einheit trennen; Auswahl anbieten. Achsen, Messpunkte, letzter Wert und Datentabelle ergänzen. |
| P1 | Formulare haben keine klare Konzentration auf eine einzelne Aufgabe. | Hohe Gefahr, Kontext oder ungespeicherte Eingaben zu verlieren. | Native Dialoge mit Tastatur-Fokus, Escape, Schutz ungespeicherter Eingaben und Objekt-Vorbelegung für planbezogene Aktionen. |
| P2 | Navigation nummeriert 13 Einträge ohne Arbeitsgruppen. | Die Reihenfolge vermittelt keine Beziehung der Module. | Gruppen für Betriebsplanung, Produktion, Kontrolle/Nachweise und Verwaltung; konsistente Icons; aktive Seite und Schnellzugriff mit Tastaturkürzel. |
| P2 | Kleinteilige Typografie, schwache Statushierarchie, rohe IDs und Ergebnis-JSON im Arbeitsablauf. | Schlechte Lesbarkeit und unnötige technische Orientierung. | Gemeinsame Farben, Abstände, Typografie, Status-Chips und humanisierte Referenzen; Verarbeitungsergebnisse als verständliche Meldungen. |
| P2 | Varianten verschiedener Projekte stehen direkt nebeneinander. | Mengen und Bewertungen erscheinen vergleichbar, obwohl sie unterschiedliche Projekte betreffen. | Varianten nach Projekt auswählen; Komponentenanteile, Kostenansatz und vorhandene Blindbewertungen vergleichbar darstellen. |
| P2 | Import zeigt Zuordnung und Übernahme ohne sichtbaren Prozess. | Einsteiger verstehen die Konsequenz eines Imports schlechter. | Sichtbare Schritte Datei → Zuordnung → Prüfen/Übernehmen; Fehlerzahl und Hinweis zur Behandlung fehlerhafter Zeilen. |

## Gestaltungsprinzipien

- **Orientierung vor Details:** kurze Modulbeschreibung, sinnvolle Kennzahlen, dann Arbeitsobjekte. Vollständige Register bleiben erreichbar.
- **Erkennen statt Erinnern:** Objektbezeichnungen, Status und aktuelle Mengen sichtbar machen. Nutzer müssen interne UUIDs nicht zum Nachschlagen kennen.
- **Kontrollierte Durchführung:** ein Formular im Fokus; bestehende Versionsprüfung, Idempotenz, Rollen, MFA und fachliche Bestätigungen bleiben wirksam.
- **Diagramme beantworten Fragen:** Rebsortenbestände und Flächen, Lese Plan/Ist, Aufgaben-/Qualitätsstatus, Gärverlauf, Abfüllbestand und Vollkosten je Partie. Keine erfundenen Vorjahrestrends oder berechneten pH-Werte.
- **Fehler dürfen Arbeit nicht verdecken:** Kartenausfall lässt Parzellen bedienbar; Suchfilter haben eine Rücksetzfunktion; leere Zustände erklären den Einstieg.
- **Mobil und per Tastatur nutzbar:** responsive Karten, mobile Navigation im Dialog, sichtbare Fokusmarkierung, beschriftete Bedienelemente und native Fokusführung. Bewegungspräferenzen werden berücksichtigt.

## Daten und Grenzen

Überblickslisten verwenden das vorhandene, auf 500 Datensätze pro Sammlung begrenzte Lesemodell. Sobald diese Grenze erreicht ist, weist die Oberfläche auf den Ausschnitt hin. Physischer und verfügbarer Gesamtbestand stammen weiterhin aus der vollständigen Datenbank-Aggregation; Vollkosten verwenden weiterhin das vollständige Kostenmodell. Weitere Registerzeilen und vollständige Exporte bleiben erreichbar.

Gemischte Weine ohne deklarierte Rebsorte werden als „Cuvée / ohne Sortenangabe“ ausgewiesen. App-geführter Flaschenbestand wird nicht mit einem unbekannten, extern geführten ERP-Bestand vermischt. Die freie Gefäßkapazität berücksichtigt nur einsatzbereite Gefäße. Gärkurven verbinden nur Messwerte derselben Methode und Einheit.

Die Parzellenansicht ist kein Ersatz für eine Straßen- oder Satellitenkarte und hat keine externen Kartendaten. Die optionale öffentliche OpenStreetMap-Basiskarte bietet keinen Verfügbarkeitsvertrag; Fehler werden abgefangen. Es wurden weder ein kostenpflichtiger Kartendienst noch weitere bezahlte Dienste eingerichtet.

## Prüfung

`scripts/ux-e2e.mjs` prüft alle Modulansichten, die vier Sprachen, Schnellzugriff, Tabellen, Parzellen, verweigerte Basiskarten, Mobilnavigation und die vollständige Aufgabe-Route UI → API → Datenbank → neue Aufgabenkarte. Demo-Zugänge werden nur für lesende Ansichten benutzt; schreibende Bedienungstests legen eigene Testbetriebe an. Optional wird axe-core für automatisierte WCAG-Regeln eingebunden. Weitere Verifikation und die Belege der Veröffentlichung stehen in `docs/verification.md`.

Eine Nutzungsstudie mit Winzern im Feld, Screenreader-Tests auf mehreren Betriebssystemen und die fachliche Prüfung der vier Übersetzungen benötigen reale Nutzer und Geräte. Diese Einschränkung verhindert keine Prüfung der vorhandenen UI- und Datenabläufe.

### Gemessene Erstansichten

Gemessen bei 1.440 × 1.000 px, mit denselben Demo-Daten. Die reduzierte Höhe entsteht durch die neue Informationsstruktur; die vollständigen Register und Aktionen bleiben erreichbar.

| Modul | Vorher | Nachher |
| --- | ---: | ---: |
| today | 4741 px | 1802 px |
| vineyard | 2502 px | 1536 px |
| cellar | 3588 px | 1755 px |
| blends | 5617 px | 1406 px |
| lab | 2953 px | 1529 px |
| bottling | 1986 px | 1075 px |
