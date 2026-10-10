# Fachkern

Weinberg, Lese, Partie, Gefäß, Bestandsposition, Rezeptversion, Versuch, freigegebener Auftrag, tatsächliche Mischung, Produkt/SKU und Abfülllos sind getrennte Entitäten. Ernte-Kilogramm werden nicht still in Wein-Liter umgerechnet.

`planBlend` prüft dezimale Quellen, gesperrte Partien, doppelte Referenzen und verfügbaren Bestand. 600/400 L mit 2/3 €/L und 12/13,5 % vol ergeben 1.000 L, 2.400 € reine Weinkosten, 2,40 €/L und geschätzt 12,60 % vol bei passenden Einheiten/Methoden. Fehlende/incompatible Befunde bleiben `null`. pH ist immer `null`; Sensorik und freies SO₂ werden nicht gemittelt.

Planung allein bucht nichts. Freeze archiviert unveränderliche Version/Evidenz. Reale Versuche buchen Probenverbrauch in 1-ml-Bestandsschritten; Rest wird deterministisch der letzten Quelle zugeordnet. Der Planungsrechner kann hundertstel ml anzeigen; die tatsächliche Entnahmekarte dokumentiert die buchbare 1-ml-Rundung.

`app.command` erzeugt ausgeglichenes Mengenjournal und Bestandsprojektion zusammen. Opening belastet externes Eröffnungskonto; Verlust, Probe und Abfüllung haben getrennte Konten. Transfer/Teilung erhalten die Partie. Mischung erzeugt neue Partie und tatsächliche Herkunftsbeiträge. Verluste verändern die tatsächliche Zielmenge und Kosten je verbleibendem Liter.

Freigabe setzt aktuellen Bestand, freie Kapazität, Rollen/MFA und ausdrückliche fachliche Prüfung voraus; regionale Regelprüfung bleibt separat gekennzeichnet. Reservierungen sperren frei verfügbare Mengen. Produktion konsumiert die eigenen Reservierungen; Teilproduktion erhält den Rest. Geänderte Anteile oder zusätzliche Mengen verlangen eine exakte begründete Abweichungsfreigabe.

Abfüllung 1.000 × 0,75 L + 5 L dokumentierter Verlust konsumiert 755 L. Standalone: App führt Abfülllos; ERP-Modus: externe Flaschenbestandsführerschaft, kein zweites Warenlager. Herkunft folgt ausschließlich tatsächlichen Mengen-Kanten. Ein nicht belegter Weinberg wird nicht durch Rebsorte/Jahrgang erfunden.
