# Persistente Jobverarbeitung

MVP-Verarbeitung: `app.process_jobs` in `packages/db/migrations/0006_worker_assets.sql`, aufgerufen durch `/api/jobs` im Datenhub. Tenant/Actor werden aus der aktuellen Session aufgelöst. PostgreSQL-Outbox, deterministische Quittungen, `FOR UPDATE SKIP LOCKED`, Retry und Reconciliation schützen vor doppelter Demo-Übertragung. Kein separater kostenpflichtiger Worker und keine unendliche Request-Schleife.
