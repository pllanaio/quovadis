# OpenProspect: öffentliche Aussagen und technische Befunde

Stand: 22. Oktober 2026. Untersucht wurden ausschließlich öffentlich zugängliche Seiten und die im Browser ausgelieferten Skripte. REA 6.7.0 (`morluto/rea`, Commit `304c978`) wurde lokal installiert und für CDP-Seiteninspektion, Bundle-Analyse und Skriptexport verwendet. Es gab keinen Zugriff auf ein OpenProspect-Konto oder dessen Servercode.

## Was „jede Firma einzeln lesen“ bedeutet

[Die Produktseite](https://www.openprospect.io/de/produkt) beschreibt einen Ablauf: Aus einem Idealkundenprofil werden Firmen gesucht, unpassende Firmen aussortiert, Ansprechpartner geprüft, öffentliche Informationen pro Firma gesammelt und daraus ein individueller Gesprächsanlass („Hook“) formuliert. Als Quellen nennt die Seite Firmenwebsites, Register, Stellenanzeigen, Bewertungen, Ausstellerlisten und Presse. Sie behauptet über 20 Quellen pro Firma. Das FAQ sagt ausdrücklich, dass Firmen einzeln geprüft werden und nur passende Firmen mit erreichbarer Ansprechperson vorgeschlagen werden.

**Technischer Befund:** Die öffentlich sichtbare Recherche-Darstellung ist eine Animation mit bereits im HTML enthaltenen Werten. REA fand in `RechercheStapel…js` und `recherche-schritte…js` DOM-Abfragen auf `data-rc-gesamt` und `data-rc-bleiben`. Der betrachtete DOM enthielt dafür die festen Werte `6041` und `527`. Diese Animation ist kein Nachweis für eine aktuell ausgeführte Suche. Ob die dahinter angebotene Dienstleistung tatsächlich jede Firma nach diesem Muster bearbeitet, lässt sich ohne einen echten Recherchelauf oder Backend-Zugang nicht feststellen.

## Was „Signale“ dort bedeutet

Die öffentlichen Beispiele legen drei Ebenen nahe:

1. **Suchkriterien im Idealkundenprofil:** Der Onboarding-Chat zeigt „Signale dafür“ und „Signale dagegen“. Sein Frontend verarbeitet `signale.dafuer` und `signale.dagegen` als getrennte Listen. Das sind Kriterien, nach denen geeignete Firmen erkannt oder ausgeschlossen werden sollen.
2. **Beobachtungen über eine konkrete Firma:** Auf der Produktseite sind das beispielsweise eine offene Stelle mit Excel-Bezug, eine Lieferzusage auf der Website, als lieferbar markierte Shopartikel, Bewertungen mit verspäteter Lieferung oder ein Messeauftritt. Die Seite gruppiert solche Beobachtungen unter „Versprechen“, „Wachstum“, „Reibung“, „Technik“ und „Anlass“. Ein belastbares Signal braucht eine bestimmte Firma, eine Fundstelle, einen beobachteten Sachverhalt und den Bezug zum Angebot.
3. **Hook für die Ansprache:** Mehrere Beobachtungen werden zu einer firmenspezifischen Frage oder These verbunden. Das öffentliche Beispiel verknüpft Lieferzusage, Artikelbestand und Excel-Stellenanzeige. Die Website sagt, die Nachricht werde vor dem Versand mit dem Kunden abgestimmt und freigegeben.

Die oben genannten Beispiele auf der Marketingseite sind Präsentationsinhalte. Sie belegen weder einen echten Fund bei „Hollmann“ noch die Aktualität der genannten Zahlen.

## Was REA am öffentlichen Chat belegen konnte

- Die Marketingseite und der Onboarding-Chat verwenden Astro/Vite-Skripte. Die eigenständige App unter `app.openprospect.io` lieferte eine Next.js-Anmeldeseite; ohne Konto war die interne Rechercheoberfläche nicht zugänglich.
- Der Onboarding-Chat sendet JSON an `/api/chat/lauf` und verarbeitet `text/event-stream` als fortlaufende Ereignisse. Weitere im Frontend deklarierte Endpunkte sind `/api/chat/nachholen`, `/api/chat/stand`, `/api/chat/ergebnis` und `/api/chat/vorbereiten`. Eine Sitzung wird über Header verwaltet; für bestimmte Schritte ist Cloudflare Turnstile eingebunden.
- Das Frontend kann ein Angebotsprofil mit `firma`, `website`, `angebot` und bis zu drei `nachweise` rendern. Die Nachweise besitzen `seite` und `zitat`. Diese Karte bezieht sich auf das Angebot des Nutzers im **Onboarding**, nicht auf eine belegte Tiefenrecherche zu einer Ziel-Firma.
- Die „Signale dafür/dagegen“ sind im ausgelieferten Chat-Code sichtbare strukturierte Felder. Der ebenfalls vorhandene Pfad `/api/chat/signal` ist aus dem Namen allein **kein** Nachweis für Firmen-Signale; seine Nutzung im Frontend ist ein gesonderter Chat-Ereignisaufruf.

Die öffentlich ausgelieferte **App-Clientdatei** [`1cg1onpxp_215.js`](https://app.openprospect.io/_next/static/chunks/1cg1onpxp_215.js) gibt einen etwas konkreteren Einblick in das vorgesehene Datenmodell. Ein Repository fragt für eine Firma `…/prospect-searches/{id}/companies/{id}/source-data` ab. Der Client kennt die Quelltypen `GOOGLE_MAPS`, `WEB_DISCOVERY`, `JOB_DISCOVERY` und `MANUAL_ENTRY`. Ein Quelleintrag kann `normalized_url`, `last_crawled_at`, `analyzed_at`, `analysis_model`, `match_score`, `match_reasoning`, gekürzte oder rohe Quelldaten sowie Bewertungsdaten enthalten. Weitere Clientrouten betreffen Stellenanzeigen und erkannte Webtechnologien je Firma. Das Firmenmodell enthält unter anderem `signal_tags`, `evidence_summary`, `key_insight`, `match_reasons`, einen Score von 0 bis 10 und einen Review-Status. Das spricht für ein **firmenbezogenes Datenmodell mit mehreren Fundarten und Prüfstatus**. Es belegt nicht, dass diese Endpunkte im zugänglichen Produkt erfolgreich laufen, wie viele Quellen pro Firma abgerufen werden oder wie die Server sie auswerten. Die in der Datei sichtbaren `localhost:8000`-URLs sind kompilierte Clientwerte, keine beobachteten Produktionsaufrufe.

Die Analyse zeigt damit, wie die öffentliche Eingabe, Darstellung und Teile des App-Datenmodells funktionieren. Sie zeigt **nicht** die Suchalgorithmen, Datenlieferanten, Zahl der tatsächlich gelesenen Quellen, Kontaktprüfung, KI-Prompts oder Qualitätskontrolle des internen Rechercheprozesses. Das Versprechen „über 20 Quellen“ bleibt von außen unbestätigt.

## Konsequenz für quovadis

Die aktuelle Recherche in `lib/research.ts` liest pro konfigurierter Quelle einen Text und lässt daraus bis zu zehn Leads mit je einem `source_url` und einem freien `signal` extrahieren. Das ist ein brauchbarer erster Schritt, bildet aber keine firmenweise Recherche über mehrere Fundstellen ab. Ein Score aus einem einzelnen LLM-Lauf sollte nicht als geprüfte Firmenbewertung erscheinen.

Für eine belastbare Umsetzung im internen Tool wäre die nächste Ausbaustufe:

1. Idealkundenprofil mit Pflichtkriterien, Ausschlüssen und positiven/negativen Signalen speichern.
2. Firmenkandidaten finden, Identität und Dubletten prüfen, danach **pro Firma** mehrere zulässige Quellen abrufen.
3. Einzelne Beobachtungen speichern: Quell-URL, Funddatum, konkretes Zitat/Ausschnitt, Signaltyp, Firma, Zuverlässigkeit und Gegenbelege.
4. KI aus diesen Beobachtungen eine begründete Eignungsbewertung und einen Hook-Entwurf erstellen lassen; unbelegte Aussagen verwerfen.
5. Kontakt und Ansprache getrennt prüfen und vor Versand freigeben. Später Antworten nach Zielgruppe, Signal und Hook auswerten.

Damit wäre „einzeln gelesen“ im Tool überprüfbar: Jede vorgeschlagene Firma hätte ein nachvollziehbares Dossier statt nur einer Zusammenfassung mit einer URL.

## Quellen und Grenzen

- [Produktseite und FAQ](https://www.openprospect.io/de/produkt), [Leistungsübersicht](https://www.openprospect.io/de/preise), [Onboarding](https://www.openprospect.io/de/onboarding)
- Öffentlich ausgelieferte Skripte zum [Onboarding-Transport](https://www.openprospect.io/_astro/transport.BsqhD0k2.js), [Chat-Frontend](https://www.openprospect.io/_astro/Chat.astro_astro_type_script_index_0_lang.uqPoPPyL.js), [Recherche-Animation](https://www.openprospect.io/_astro/RechercheStapel.astro_astro_type_script_index_0_lang.KZXQic5x.js)
- REA-Evidence-IDs der lokalen Aufnahmen: Onboarding-Seite `ev_79620b1800b54b4d877e92c971fec0a3d8f16de4f9760e06e589eba021ca1c6b`, Onboarding-Bundle `ev_6da9bfca2ada3b56eda7ddc4692d1c560dfb35d53b988a91dcebe37d1894f229`, Produktseite `ev_772b492f987e41fdcefca48ea668bb37e7337e010d301209e42684eedc87bad2`, App-Bundle `ev_eb4a34fa1d64549b0132b0def54c9f66f6532398735a9de8ae05f10438ede770`. Die lokalen Rohdaten unter `/tmp/openprospect-*` sind Momentaufnahmen und gehören nicht zum Repository.

Technische Hinweise aus ausgelieferten Skripten beschreiben nur den öffentlich sichtbaren Client. Die Serverimplementierung kann davon abweichen und ist damit nicht bestätigt.
