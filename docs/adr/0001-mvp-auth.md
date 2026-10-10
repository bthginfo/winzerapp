# Kostenloser App-Login

Der Nutzer ersetzt die OIDC-Vorgabe ausdrücklich durch Better Auth mit E-Mail und Passwort. Better Auth übernimmt Passwortableitung, Sessions, Origin-/CSRF-Prüfung und Rate Limits; die Anwendung implementiert keine eigene Passwortlogik. Benutzer und Sessions liegen in der bestehenden Neon-Free-Datenbank. Keine zusätzliche Anbieterbuchung.

Registrierung erzeugt noch keinen Zugriff auf einen fremden Betrieb. Onboarding legt einen eigenen Betrieb an; weitere Mitglieder werden vom Betriebsinhaber explizit zugeordnet. Privilegierte Nutzer erhalten die Zwei-Faktor-Funktion des Auth-Anbieters. Ein echter Passwortreset benötigt einen konfigurierten Versanddienst; ohne Versand wird keine fiktive Zustellung behauptet.
