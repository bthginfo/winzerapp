# Architektur

SvelteKit 5 / TypeScript als modularer Monolith, Node.js 22 in Frankfurt. Better Auth 1.7 verwaltet Passwortableitung, Datenbanksessions, geteilte Rate Limits und TOTP. Die OIDC-Vorgabe wurde auf ausdrücklichen Nutzerwunsch ersetzt ([Entscheidung](adr/0001-mvp-auth.md)).

Jeder API-Aufruf erhält Benutzer und Session aus Better Auth. Die Betriebsauswahl ist ein HTTP-only-Cookie und wird gegen die aktuelle Membership geprüft. Benutzer-ID, Rollen und Tenant-Kontext werden nicht aus Command-Eingaben übernommen. Privilegierte Commands verlangen MFA; beim Ein-/Ausschalten des zweiten Faktors werden bestehende Sessions widerrufen.

`vinea_runtime` besitzt weder Superuser-/BYPASSRLS-Rechte noch direkte DML-Rechte an Fachtabellen. Leseabfragen setzen `app.tenant_id` und `app.actor_id` in derselben Neon-HTTP-Transaktion. Tenant-RLS schützt alle Fachtabellen; externe Labore sehen ausschließlich freigegebene Partien/Proben/Analysen. Identity-Helfer laufen als Schemaeigentümer und sind explizit auf geprüfte Memberships begrenzt.

Der Command-Service ist die PostgreSQL-Funktion `app.command`: mandantenweiter transaktionaler Advisory Lock, deterministische Gefäß-/Bestands-/Reservierungssperren, Versionsprüfung, Payload-Hash und betriebsspezifischer Idempotenzschlüssel. Fachänderung, ausgeglichenes Mengenjournal, Herkunft, Audit und Outbox committen gemeinsam. Der Lock priorisiert Konsistenz; Buchungen eines Betriebs werden serialisiert. Andere Betriebe laufen unabhängig.

Bestandsposition und Partie sind getrennt. Transfer bewahrt die Partie, Mischung erzeugt eine neue Partie und tatsächliche Mengen-Kanten. Belegte Ziele müssen vollständig als reale Quellen erscheinen. Teilproduktion erhält Restreservierungen; spätere Produktion nimmt die bereits gemischte Zielpartie ausdrücklich als Quelle auf. Append-only-Trigger schützen Journal, Herkunft, Analysen und Audit. Korrekturen referenzieren ursprüngliche Belege.

Liter und Geld liegen als NUMERIC in PostgreSQL und Strings im API-Vertrag; Decimal.js rechnet mit 50 Stellen Präzision. Nur Anzeigezahlen werden formatiert. Alkohol wird ausschließlich bei vorhandenen kompatiblen Methoden/Einheiten geschätzt. pH, Sensorik und freies SO₂ werden nicht gemittelt. Freeze/Freigabe archivieren die exakte Version und Evidenz; regionale Regeln bleiben ausdrücklich ungeprüft und verlangen fachliche Prüfung.

IndexedDB enthält getrennte Entwürfe mit originaler Command-ID, Erfassungszeit und erwarteter Version. Nur Notizen, Analysen und Aufgaben werden synchronisiert. Konflikte bleiben erhalten. Logout/Betriebswechsel warnen vor ungesendeten Entwürfen und löschen lokale Daten nach Zustimmung. Der Service Worker cached ausschließlich öffentliche Offline-Seite und versionierte Build-Dateien, keine private Seite/API.

Kleine private Dateien liegen in PostgreSQL (2 MB pro Datei, 32 MB pro Betrieb), ohne weiteren Speicherdienst. Eigentümer-Migrationen laufen separat vom Web-Build. [OpenAPI](../packages/contracts/openapi.json) und Zod beschreiben Commands. Demo-ERP-Verarbeitung nutzt PostgreSQL-Outbox und persistente Quittungen, `FOR UPDATE SKIP LOCKED` und Abgleich vor Wiederholung; keine externe Übertragung.
