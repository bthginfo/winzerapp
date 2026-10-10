# API-Verträge

Laufzeitvalidierung: `apps/web/src/lib/server/contracts.ts` (Zod). Generierter OpenAPI-3.1-Vertrag: `openapi.json`. Dezimalwerte bleiben Strings; Idempotency-Key steht im Header, erwartete Version im Command. Browser-Tenant und -Actor werden niemals als Identitätsnachweis akzeptiert. Import/Export und Integrationszugriffe haben eigene geschützte Endpunkte.
