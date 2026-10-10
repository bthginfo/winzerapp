export const languages = ['de', 'en', 'it', 'fr'] as const;
export type Language = typeof languages[number];
const de = {
  language: 'Sprache', title: 'Vom Weinberg bis zur Flasche.', subtitle: 'Dein Betrieb. Eine gemeinsame Herkunftskette.',
  foundation: 'Projektbasis', notice: 'Erste Projektbasis mit synthetischen Beispieldaten. Keine produktiven Bestandsbuchungen. Anmeldung und Buchungskern folgen vor dem Pilotbetrieb.',
  cellar: 'Keller', blending: 'Cuvée-Studio', roadmap: 'Ausbau', lots: 'Beispielpartien', available: 'Verfügbar', vintage: 'Jahrgang',
  heading: 'Eine Idee wird zur Cuvée.', intro: 'Plane die Mischung und bereite einen reproduzierbaren 250-ml-Versuch vor.',
  source: 'Quelle', volume: 'Menge in Liter', cost: 'Weinkosten', total: 'Zielmenge', alcohol: 'Alkohol · Schätzung', perLiter: 'Kosten pro Liter',
  trial: '250-ml-Versuch', sample: 'Entnahme', ph: 'pH: Analyse des realen Versuchs erforderlich.',
  estimation: 'Planungsschätzung bei vergleichbaren Analysen und angenommener Volumenadditivität. Sensorik und freies SO₂ werden nicht berechnet. Die Planung reserviert oder bucht keinen Bestand.',
  export: 'Rezept als JSON exportieren', reset: 'Beispiel zurücksetzen', missing: 'Analyse fehlt oder Methoden sind nicht vergleichbar',
  next: 'Nächste Schritte für den Pilotbetrieb', identity: 'Anmeldung & Betriebe', identityText: 'OIDC-Anmeldung, Rollen und geprüfte Mandantentrennung.',
  ledger: 'Mengenjournal & Herkunft', ledgerText: 'Atomare Buchungen, Reservierungen, Idempotenz und Herkunftskette.',
  production: 'Vom Versuch zur Abfüllung', productionText: 'Rezeptversionen, Verkostung, Freigabe, reale Mischung und Abfüllcharge.',
  data: 'Datenhub & Offline', dataText: 'CSV-Import mit Vorschau, Export und sichere Offline-Entwürfe.',
  planned: 'Geplant', noStock: 'Die Menge überschreitet den Beispielbestand.', blocked: 'Eine Quellpartie ist gesperrt.', invalid: 'Bitte gültige positive Mengen eingeben. Dezimaltrennzeichen: Punkt.', empty: 'Mindestens eine Menge muss größer als null sein.',
  unknown: 'Das Rezept konnte nicht berechnet werden.', skip: 'Zum Inhalt', back: 'Zum Cuvée-Studio', specification: 'Die vollständige Produktspezifikation liegt im Repository.',
  estimate: 'Schätzung', demo: 'Beispieldaten', lot: 'Partie', vineyard: 'Weinberg', harvest: 'Lese', laboratory: 'Labor', bottling: 'Abfüllung', tasks: 'Aufgaben'
};
type Dictionary = { [K in keyof typeof de]: string };
export const messages: Record<Language, Dictionary> = {
  de,
  en: {
    language: 'Language', title: 'From vineyard to bottle.', subtitle: 'Your winery. One shared chain of origin.',
    foundation: 'Project foundation', notice: 'Initial project foundation with synthetic example data. No production inventory transactions. Sign-in and the inventory core will follow before the pilot.',
    cellar: 'Cellar', blending: 'Blend studio', roadmap: 'Roadmap', lots: 'Example lots', available: 'Available', vintage: 'Vintage',
    heading: 'Turn an idea into a blend.', intro: 'Plan your blend and prepare a reproducible 250 ml bench trial.',
    source: 'Source', volume: 'Volume in litres', cost: 'Wine cost', total: 'Target volume', alcohol: 'Alcohol · estimate', perLiter: 'Cost per litre',
    trial: '250 ml bench trial', sample: 'Sample', ph: 'pH: analysis of the actual trial is required.',
    estimation: 'Planning estimate using comparable analyses and assumed volume additivity. Sensory properties and free SO₂ are not calculated. Planning does not reserve or post stock.',
    export: 'Export recipe as JSON', reset: 'Reset example', missing: 'Analysis missing or methods incompatible',
    next: 'Next steps for the pilot', identity: 'Sign-in & wineries', identityText: 'OIDC sign-in, roles and verified tenant isolation.',
    ledger: 'Quantity ledger & origin', ledgerText: 'Atomic transactions, reservations, idempotency and traceability.',
    production: 'From trial to bottling', productionText: 'Recipe versions, tasting, approval, actual blending and bottling batches.',
    data: 'Data hub & offline', dataText: 'CSV import with preview, export and safe offline drafts.',
    planned: 'Planned', noStock: 'The volume exceeds the example stock.', blocked: 'A source lot is blocked.', invalid: 'Enter valid positive volumes. Decimal separator: dot.', empty: 'At least one volume must be greater than zero.',
    unknown: 'The recipe could not be calculated.', skip: 'Skip to content', back: 'Go to blend studio', specification: 'The full product specification is in the repository.',
    estimate: 'Estimate', demo: 'Example data', lot: 'Lot', vineyard: 'Vineyard', harvest: 'Harvest', laboratory: 'Laboratory', bottling: 'Bottling', tasks: 'Tasks'
  },
  it: {
    language: 'Lingua', title: 'Dal vigneto alla bottiglia.', subtitle: 'La tua cantina. Una filiera di origine condivisa.',
    foundation: 'Base del progetto', notice: 'Prima base del progetto con dati sintetici di esempio. Nessun movimento di magazzino reale. Accesso e gestione delle scorte seguiranno prima del progetto pilota.',
    cellar: 'Cantina', blending: 'Studio assemblaggi', roadmap: 'Sviluppo', lots: 'Partite di esempio', available: 'Disponibile', vintage: 'Annata',
    heading: 'Da un’idea a un assemblaggio.', intro: 'Pianifica la miscela e prepara una prova riproducibile da 250 ml.',
    source: 'Origine', volume: 'Quantità in litri', cost: 'Costo del vino', total: 'Volume obiettivo', alcohol: 'Alcol · stima', perLiter: 'Costo al litro',
    trial: 'Prova da 250 ml', sample: 'Prelievo', ph: 'pH: è necessaria l’analisi della prova reale.',
    estimation: 'Stima di pianificazione con analisi comparabili e additività dei volumi presunta. Le proprietà sensoriali e la SO₂ libera non vengono calcolate. La pianificazione non riserva né movimenta le scorte.',
    export: 'Esporta ricetta in JSON', reset: 'Ripristina esempio', missing: 'Analisi assente o metodi incompatibili',
    next: 'Prossimi passi per il progetto pilota', identity: 'Accesso e aziende', identityText: 'Accesso OIDC, ruoli e isolamento verificato delle aziende.',
    ledger: 'Registro quantità e origine', ledgerText: 'Movimenti atomici, prenotazioni, idempotenza e tracciabilità.',
    production: 'Dalla prova all’imbottigliamento', productionText: 'Versioni delle ricette, degustazione, approvazione, miscela reale e lotti di imbottigliamento.',
    data: 'Dati e modalità offline', dataText: 'Importazione CSV con anteprima, esportazione e bozze offline sicure.',
    planned: 'Previsto', noStock: 'La quantità supera la disponibilità di esempio.', blocked: 'Una partita di origine è bloccata.', invalid: 'Inserisci quantità positive valide. Separatore decimale: punto.', empty: 'Almeno una quantità deve essere maggiore di zero.',
    unknown: 'Impossibile calcolare la ricetta.', skip: 'Vai al contenuto', back: 'Vai allo studio assemblaggi', specification: 'La specifica completa del prodotto si trova nel repository.',
    estimate: 'Stima', demo: 'Dati di esempio', lot: 'Partita', vineyard: 'Vigneto', harvest: 'Vendemmia', laboratory: 'Laboratorio', bottling: 'Imbottigliamento', tasks: 'Attività'
  },
  fr: {
    language: 'Langue', title: 'De la vigne à la bouteille.', subtitle: 'Votre domaine. Une chaîne d’origine commune.',
    foundation: 'Base du projet', notice: 'Première base du projet avec des données synthétiques. Aucun mouvement de stock réel. La connexion et la gestion des stocks suivront avant le pilote.',
    cellar: 'Cave', blending: 'Studio d’assemblage', roadmap: 'Évolution', lots: 'Lots d’exemple', available: 'Disponible', vintage: 'Millésime',
    heading: 'D’une idée à un assemblage.', intro: 'Planifiez votre assemblage et préparez un essai reproductible de 250 ml.',
    source: 'Origine', volume: 'Volume en litres', cost: 'Coût du vin', total: 'Volume cible', alcohol: 'Alcool · estimation', perLiter: 'Coût par litre',
    trial: 'Essai de 250 ml', sample: 'Prélèvement', ph: 'pH : une analyse de l’essai réel est nécessaire.',
    estimation: 'Estimation de planification avec analyses comparables et additivité supposée des volumes. Les propriétés sensorielles et le SO₂ libre ne sont pas calculés. La planification ne réserve ni ne modifie le stock.',
    export: 'Exporter la recette en JSON', reset: 'Réinitialiser l’exemple', missing: 'Analyse absente ou méthodes incompatibles',
    next: 'Prochaines étapes pour le pilote', identity: 'Connexion et domaines', identityText: 'Connexion OIDC, rôles et isolation vérifiée des domaines.',
    ledger: 'Journal des volumes et origine', ledgerText: 'Opérations atomiques, réservations, idempotence et traçabilité.',
    production: 'De l’essai à la mise en bouteille', productionText: 'Versions des recettes, dégustation, approbation, assemblage réel et lots d’embouteillage.',
    data: 'Données et mode hors ligne', dataText: 'Import CSV avec aperçu, export et brouillons hors ligne sécurisés.',
    planned: 'Prévu', noStock: 'Le volume dépasse le stock d’exemple.', blocked: 'Un lot source est bloqué.', invalid: 'Saisissez des volumes positifs valides. Séparateur décimal : point.', empty: 'Au moins un volume doit être supérieur à zéro.',
    unknown: 'La recette n’a pas pu être calculée.', skip: 'Aller au contenu', back: 'Aller au studio d’assemblage', specification: 'La spécification complète du produit se trouve dans le dépôt.',
    estimate: 'Estimation', demo: 'Données d’exemple', lot: 'Lot', vineyard: 'Vignoble', harvest: 'Vendanges', laboratory: 'Laboratoire', bottling: 'Mise en bouteille', tasks: 'Tâches'
  }
};
