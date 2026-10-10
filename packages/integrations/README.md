# Adaptergrenze

`apps/web/src/lib/server/erp-adapter.ts` definiert Adaptervertrag und Capability-Manifest. Der Demo-ERP-Adapter verwendet persistente PostgreSQL-Quittungen und verarbeitet keine echten externen Daten. Live-Adapter brauchen eine bestätigte API und Credentials; unklaren Schreibausgang immer zuerst abgleichen. Im ERP-Modus liegt die Flaschenbestandsführerschaft beim ERP.
