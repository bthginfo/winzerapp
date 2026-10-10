# Datenbank-Grundlage

Migrationen sind versioniert und werden nicht beim Web-Build ausgeführt. `0001_identity.sql` ist eine ungetestete erste Struktur für Tenants, Identitäten und Memberships. RLS verwendet transaktionslokalen Kontext `app.tenant_id`/`app.subject`; den Kontext ausschließlich aus einer geprüften Session setzen. Anwendungsrolle darf keinen Tabellenbesitz/BYPASSRLS/Superuser-Status haben. OIDC-Identity ist `(issuer, subject)`, kein selbst entwickeltes Passwortsystem.

Mengenjournal, Gefäße, Partien, Rezepte, Reservierungen und Outbox werden im folgenden vertikalen Schritt implementiert. Erst nach PostgreSQL-Integrationstests und Mandantentests produktiv aktivieren.
