# Fachkern

Partie, Gefäß, Bestandsposition, Rezeptversion, tatsächliche Mischung und Abfüllcharge bleiben getrennte Entitäten. Der Herkunftsgraph folgt Parzelle → Ernte → Most/Weinpartie → Mischung → Abfüllcharge → ERP-Artikel.

Implementiert ist ausschließlich `planBlend`: prüft Dezimalstrings, positive Gesamtmenge, verfügbare Menge, gesperrte Quellen und doppelte Quellreferenzen. Berechnet Weinkosten, vergleichbare Alkoholkonzentration und deterministisch gerundete Versuchsmengen. Das Beispiel 600/400 L liefert 12,60 % vol als Schätzung, 2.400 € Weinkosten und 150/100 ml für 250 ml Versuch.

Fehlende oder methodisch inkompatible Alkoholwerte liefern `null`. pH ist immer `null`; tatsächlicher Versuch muss analysiert werden. Volumenadditivität ist eine Planungsannahme. Weinkosten enthalten keine Arbeit, Verpackung oder Verluste. Der JSON-Export markiert `estimated: true`, Modellversion, Quellreferenzen und `productionApproved: false`.

Nicht implementiert: Probenentnahme als Bestandsbuchung, Laborhistorie, Rezeptfreeze, Freigabe, Reservierung, atomare Mischung, Abfüllung und Herkunftsbericht. Keine dieser Funktionen wird durch den Planungsrechner ersetzt.
