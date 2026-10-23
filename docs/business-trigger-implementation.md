# Business Trigger Engine – Implementierungsplan

> Nachtrag: Die unten dokumentierte ursprüngliche Ausschlussfunktion wurde auf Nutzerwunsch entfernt. Löschungen sperren keine späteren Suchtreffer. Die aktuelle Bedienung mit Mehrfachauswahl ist in der README beschrieben.

Basis: bestehende Next.js-App, Firmen in `opportunities`, belegte Signale und Historie, separater Research-Worker, HeroUI.

1. Migrationssichere Ereignis-/Hypothesen-, Cache-, Nutzungs- und Ausschlussdaten ergänzen. Firmen bleiben unter ihren bisherigen IDs erhalten.
2. Fünf Scouts teilen Suchanfragen und Seitenbudget nach konfigurierbaren Gewichten auf. Stellenanzeigen erhalten standardmäßig 10 % des Budgets.
3. Ereignisse werden nur aus gelesenen Originalseiten mit wörtlichem Zitat, Firmen- und Ortsbeleg übernommen. Bedarf, Einstiegsangebot und externe Vergabebereitschaft werden getrennt bewertet.
4. Hypothesen und Angebotskalkulationen erhalten Ereignisbezug, Modellversion, Recherchezeit und ausdrücklich geschätzte Werte. Kein angenommenes Kundenbudget.
5. Unveränderte Seitenanalysen wiederverwenden; optionales Vorfiltermodell und Reasoning-Einstellung; Token- und geschätzte Kostenprotokolle.
6. Dashboard-Filter, Ereignisansicht, Angebote und beide zusätzlichen Scores im bestehenden responsiven Design ergänzen.
7. Authentifizierte Löschung mit Bestätigung; Signale/Notizen/Ereignisse werden transaktional gelöscht. Optionaler Ausschluss verhindert erneute automatische Erfassung derselben Firma.
8. Klassifizierungsfälle, Budgetverteilung, Grounding, Löschung, Migration und UI prüfen; Next.js-/Docker-Build validieren.
9. Feature-Branch veröffentlichen und Pull Request erstellen. Kein automatischer Merge dieses Auftrags.

## Implementiert und geprüft

- Additive PostgreSQL-Migration mit getrennten Ereignissen, mehreren Leistungshypothesen je Ereignis, unveränderlichen Analyseversionen, Seitenanalyse-Cache, Nutzungsdaten und Ausschlüssen.
- Fünf Scouts mit gewichteten Such- und Seitenbudgets; regionale Prüfung und bestehende Such-Fallbacks bleiben aktiv. Auch eine reine Social-Media-Skill-Auswahl behält Suchabdeckung.
- Belegtes Ereignis, mögliche Anforderungen, Schätzangebot und externe Beauftragbarkeit werden getrennt geführt. Interne Stellen und bereits ausgewählte Partner erhalten konservative Einstiegsscores. Veraltete Quellenbelege bleiben historisch erhalten und verlieren ihre aktuelle Bewertung.
- Frontend: Kategorien und Angebotsfilter, separate Scores, Ereignisse und Hypothesen, Kalkulation, offene Fragen, Modelle/Reasoning/Kosten, Löschung und Freigabe ausgeschlossener Firmen.
- Löschung nimmt denselben Firmen-Lock wie die Discovery; optionaler Ausschluss verhindert Wiederanlage. Notizen, Signalhistorie, Ereignisse, Analysen und zugehöriger Seitenanalyse-Cache werden transaktional entfernt.

### Prüfergebnisse

- `npx tsc --noEmit`: erfolgreich.
- `npm run build`: erfolgreich; zusätzlich Produktionsbuild im Docker-Image mit `npm ci` und aktivierter TLS-Prüfung erfolgreich.
- `for test in scripts/*test.mjs; do node "$test" || exit 1; done`: erfolgreich. Enthält sieben fachliche Pflichtfälle, Hypothesen-/Quellenprüfung, Scoutverteilung, Cacheinvalidierung, Modellwahl, Kostenkennzeichnung, Löschung/Rollback und vorhandene Such-, Scheduler- und Worker-Regressionen.
- `scripts/business-db-integration.mjs` gegen eine getrennte PostgreSQL-16-Testdatenbank: Bestandsmigration und Wiederholung, echte Discovery-Persistierung, Quellenänderung/Partnervergabe mit herabgesetztem Score, vollständige Löschkaskaden, Wiederanlage-Sperre und Freigabe erfolgreich. Produktionsdaten wurden dafür nicht verändert.
- `tests/ui-smoke.mjs` gegen den Docker-Produktionsbuild: Kategorienfilter, Dossier mit Angebotsidee und gekennzeichneten Hypothesen, Kontakte, Notizen, Quelleneditor, Einstellungen, Löschung abbrechen/bestätigen, 320/390/768/1440-Pixel-Ansichten und schwarzer Darkmode erfolgreich. Browser-Fixtures werden ausschließlich als HTTP-Antworten abgefangen und nicht gespeichert.

### Praktische Grenzen

Ein vollständiger bezahlter Recherchelauf wurde ohne hinterlegte API-Schlüssel nicht ausgeführt. Qualität und Anzahl echter Treffer hängen von erreichbaren Quellen und Suchzugängen ab. Regelbasierte Klassifizierung und KI-Schätzungen ersetzen keine fachliche Qualifizierung; Angebot und externe Vergabebereitschaft werden entsprechend gekennzeichnet. Kosten anderer Modelle und Suchwerkzeuge sind ohne bekannte Preise ausdrücklich unbepreist. Modellfehler werden gemeldet, ein anderes Modell wird nicht heimlich gewählt.
