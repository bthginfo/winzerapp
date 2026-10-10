# Erster vollständiger Ablauf

1. **Anmeldung:** `/login`, Konto mit E-Mail/Passwort erstellen, Betrieb anlegen. Unter **Betrieb & Sicherheit** zweiten Faktor einrichten, Authenticator-Code bestätigen und Wiederherstellungscodes sicher aufbewahren. Deutsch/Englisch/Italienisch/Französisch sind in der Seitenleiste verfügbar.
2. **Bestände:** Im Datenhub Beispiel-CSV wählen, Spalten zuordnen, Vorschau lesen, übernehmen. Fehler bleiben als einzelne Zeilenergebnisse sichtbar; dieselbe Datei erzeugt keinen zweiten Anfangsbestand. Alternativ Gefäß, Partie und Anfangsbestand im Keller anlegen. Liter mit Dezimalpunkt und höchstens drei Nachkommastellen eingeben.
3. **Herkunft:** Optional Weinberg und Lese erfassen und beim Anlegen der Partie verknüpfen. Fehlende Weinberg-Herkunft wird als unbekannt ausgewiesen; importierte Rebsorte ist kein regionaler Rechtsnachweis.
4. **Analysen:** Partie, Probe, Probenahme, Parameter, Wert, Einheit, Methode und Messzeit erfassen. Für Alkohol `% vol`, für Zucker/Säure `g/L` verwenden. Korrektur als neue Analyse mit Referenz auf den ersetzten Befund erfassen.
5. **Cuvée:** Projekt anlegen; neue Rezeptversion mit Quellenmengen speichern. Die Planung zeigt reine Weinkosten und bei vergleichbaren Analysen eine Alkoholschätzung. Beispiel: 600 L A + 400 L B = 1.000 L, 2,40 €/L, ca. 12,6 % vol. Reales pH messen.
6. **Versuch:** Rezept fixieren; 250-ml-Versuch entnehmen. 60/40 entnimmt 150 ml A und 100 ml B tatsächlich. Den Blindcode auf die Probe schreiben. Verkoster geben eigene Bewertungen ab; Önologie/Betriebsleitung vergleicht diese. Änderungen werden als neue Rezeptversion gespeichert.
7. **Freigabe:** Labor, Herkunft und aktuelle Quellen fachlich prüfen, Prüffeld bestätigen und freien Zieltank auswählen. Freigabe reserviert Quellen. Bei geänderten Anteilen tatsächliche Entnahmen mit Begründung als Abweichung freigeben, anschließend mit aktueller Auftragsversion produzieren.
8. **Produktion:** Quellen, tatsächliche Liter und dokumentierten Verlust angeben. Die neue Partie erhält tatsächliche Herkunft. Teilproduktion bewahrt Restreservierungen. Bei Folgeproduktion im belegten Ziel die komplette vorherige Mischpartie ausdrücklich mit aufnehmen. Abweichungen und Korrekturen benötigen MFA.
9. **Abfüllung:** Produkt und SKU, z. B. 0,75 L, anlegen. Neue Mischposition auswählen, Loskennung, Flaschenzahl und Verlust buchen. 1.000 Flaschen plus 5 L Verlust verbrauchen 755 L; aus 1.000 L verbleiben 245 L.
10. **Nachweis:** Mengenjournal und Herkunft unter Berichte; JSON/CSV/XLSX im Datenhub. Exporte archivieren einen Datensnapshot. Demo-ERP-Aufträge lassen sich im Datenhub verarbeiten; es findet keine Live-ERP-Übertragung statt.

## Mobil und offline

Gefäß-QR im Keller öffnen/herunterladen. Smartphone-Kamera öffnet den geschützten Gefäßlink. In unterstützten Browsern ist direktes Scannen möglich; manuelle Kennungssuche bleibt verfügbar. Fotos/PDF sind privat, maximal 2 MB je Datei.

Vor Offline-Arbeit die App online öffnen. Aufgaben, Notizen und Messwerte können als Entwürfe gespeichert werden. Nach Rückkehr **Entwürfe synchronisieren** wählen. Bestand, Reservierung, Freigabe und Abfüllung werden offline nicht gebucht. Bei Versionskonflikt bleibt der Entwurf erhalten; aktuelle Daten laden, fachlich prüfen und bewusst neu erfassen. „Entwurf verwerfen“ löscht nur den lokalen Konflikt. Vor Logout/Betriebswechsel weist die App auf ungesendete Entwürfe hin.
