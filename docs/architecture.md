# Architektur

Modularer Monolith nach Produktspezifikation. Aktuell vorhanden: SvelteKit-Oberfläche und frameworkfreie Planungsrechnung. UI liest synthetische Fixtures und ruft ausschließlich `planBlend` auf. Keine Bestandsänderung im Browser.

Geplante Servergrenze: OIDC-Session → Membership-/Rollenprüfung → Application Service → PostgreSQL-Transaktion. Authentifizierter Tenant wird serverseitig aufgelöst, niemals aus einer frei wählbaren Browser-ID. Jeder serverseitige Datenzugriff setzt den Tenant-Kontext innerhalb derselben Transaktion.

Journal, Projektionen, Audit und Outbox müssen atomar entstehen. Mengen/Geld: NUMERIC in SQL, Decimal in TypeScript, Strings in API-JSON. Parzellen-Geometrie: PostGIS nach Verfügbarkeitsprüfung. Keine Produktionsmigration beim Web-Build. Migrationen separat, rückwärtskompatibel und nach Backup ausführen.

Die erste SQL-Datei liefert nur Tenant-/Membership-Struktur. Sie ist **kein** implementierter Buchungskern. Kritische Commands und ihre Parallelitäts-, RLS-, Idempotenz- und Mengenprüfungen folgen vor echten Daten.

Offline später nur für Entwürfe in IndexedDB; Freigaben und Bestandsbuchungen brauchen eine bestätigte Serverprüfung. Kein Caching privater API-Daten durch einen generischen Service Worker.
