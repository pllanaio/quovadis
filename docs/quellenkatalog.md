# Öffentliche Quellen für quovadis

Stand: 22. Oktober 2026. Dieser Katalog trennt die **von OpenProspect genannten Quellenarten** von zusätzlichen Recherchemöglichkeiten für IT-Vertrieb in DACH. Öffentlich einsehbar heißt nicht automatisch frei zur Massenübernahme oder für Werbe-E-Mails nutzbar. Vor einer Anbindung sind Nutzungsbedingungen, API-Zugang, Aktualität und zulässige Speicherung der konkreten Quelle zu prüfen.

## Was OpenProspect selbst offenlegt

Die [Produktseite mit FAQ](https://www.openprospect.io/de/produkt) nennt Firmenwebsites, Handelsregister und andere öffentliche Register, Stellenanzeigen, Google-Bewertungen, Ausstellerlisten und Presse. Die [Datenschutzerklärung, Abschnitt 11](https://www.openprospect.io/de/datenschutz) ergänzt Impressen, Branchenverzeichnisse, Kartendienste mit Bewertungen und öffentliche Berufsprofile. OpenProspect veröffentlicht **keine vollständige Liste der behaupteten „über 20 Quellen“** und nennt für Kontaktprüfung keine konkreten Anbieter.

Der öffentlich ausgelieferte App-Client kennt vier technische Fundklassen: `GOOGLE_MAPS`, `WEB_DISCOVERY`, `JOB_DISCOVERY` und `MANUAL_ENTRY`. Das sind breite Datentypen, keine 20 Anbieter. Er sieht Quelldaten je Firma, Abrufzeitpunkte, Analysemodell, Match-Begründung, `signal_tags`, Bewertungen, Stellenanzeigen und Webtechnologien vor. Die Serververarbeitung konnte ohne Konto nicht geprüft werden. Details stehen in [der REA-Analyse](openprospect-analyse.md).

## Geeignete Quellen für die eigene Recherche

| Quelle | Mögliche IT-Signale | Möglicher Kontaktweg | Zugangshinweis |
|---|---|---|---|
| Firmenwebsite: Leistungen, News, Blog, PDFs | Expansion, neue Produkte, Digitalprojekte, veraltete Prozesse | Kontaktseite, Teamseite | Direkte Primärquelle; Änderungen zeitlich erfassen |
| Firmenwebsite: Impressum | Identität, Sitz, Rechtsform | Geschäftliche Adresse, Telefon, allgemeine E-Mail | Für Identitätsabgleich stark; allgemeine Adresse ist kein Entscheiderkontakt |
| Firmenwebsite: Karriere | IT-Vakanzen, ERP/Cloud/CRM-Einführung, Standorte | Genannte Recruiter oder Kontaktseite | Anzeigen können alt sein; Veröffentlichungsdatum sichern |
| Öffentliche Jobboards von ATS-Anbietern, z. B. [Greenhouse](https://docs.greenhouse.io/job-board.html) | Neue Rollen und eingesetzte Technologien | Stellenanzeige, Firmenwebsite | Öffentliche Board-APIs je Anbieter prüfen |
| [Jobsuche der Bundesagentur für Arbeit](https://www.arbeitsagentur.de/jobsuche/) | Personalaufbau und IT-Projekte | Arbeitgeberangaben in Anzeige | Öffentliche Suche; maschinellen Zugriff separat klären |
| [Handelsregister](https://www.handelsregister.de/) | Gründung, Leitungswechsel, Umfirmierung, neue Zweigstellen | Vertretungsberechtigte Person und Anschrift | Amtliche Identitätsquelle; meist kein direkter E-Mail-Kontakt |
| [Unternehmensregister](https://www.unternehmensregister.de/) | Jahresabschlüsse, Wachstum, Beteiligungen | Firmenidentität und Anschrift | Dokumente und Abrufbedingungen variieren |
| [Bundesanzeiger](https://www.bundesanzeiger.de/) | Gesellschaftsmeldungen, Berichte, Ausschreibungen | Anschrift aus Veröffentlichung | Amtliche Bekanntmachungen; kein allgemeines Kontaktverzeichnis |
| [Insolvenzbekanntmachungen](https://neu.insolvenzbekanntmachungen.de/ap/index.jsf) | Krisen und Restrukturierung | Öffentliche Verfahrenskontakte | Nur mit passender, respektvoller Ansprache; geringe Priorität für regulären Vertrieb |
| [Zefix](https://www.zefix.ch/) (Schweiz) | Registeränderungen, Firmenidentität | Organe und Adresse | Schweizer Register; Datenzugang separat prüfen |
| [JustizOnline Firmenbuch](https://justizonline.gv.at/) (Österreich) | Registeränderungen, Geschäftsführung | Organe und Adresse | Einsicht und Abrufbedingungen prüfen |
| [GLEIF LEI-Daten](https://www.gleif.org/en/lei-data/gleif-api) | Rechtsträger, Konzernbeziehungen | Identität und Sitz | Offizielle API; selten direkte Kontaktdaten |
| [Gelbe Seiten](https://www.gelbeseiten.de/) und [wlw](https://www.wlw.de/) | Branchen-, Standort- und Angebotsabgleich | Geschäftliche Telefonnummer und Website | Gewerbliche Verzeichnisse; Nutzung und Qualität je Eintrag prüfen |
| [OpenStreetMap/Overpass](https://overpass-turbo.eu/) | Standort, Filialen, Geschäftsart | Manchmal Website/Telefon | Offene Daten mit ODbL-Pflichten; Abdeckung schwankt |
| [Google Places API](https://developers.google.com/maps/documentation/places/web-service/overview) | Standorte, Öffnungszeiten, Bewertungen | Öffentliche Geschäftsnummer und Website | Offizielle API, Kosten und Speicherregeln beachten; nicht Maps-Seiten scrapen |
| Messe- und Kongress-Ausstellerverzeichnisse | Neue Märkte, Produkte, Messeauftritt | Ausstellerprofil, Website, Standkontakt | Je Messe verschieden; Fundseite und Datum speichern |
| Verbands-, Kammer- und Innungsverzeichnisse | Branche, Mitgliedschaft, Spezialisierung | Öffentlich angegebener Geschäftskontakt | Verzeichnisse regional unterschiedlich |
| [Presseportal](https://www.presseportal.de/) und Unternehmens-Pressebereiche | Neubau, Übernahmen, Investitionen, neue Geschäftsführung | Pressekontakt oder Firmenwebsite | Pressekontakt nicht automatisch Vertriebskontakt |
| Regionale Wirtschafts- und Fachmedien | Standortwachstum, Digitalprojekte, Partnerwechsel | Firmenwebsite nachfassen | Sekundärquelle durch Primärquelle bestätigen |
| [TED](https://ted.europa.eu/de/) und [TED API](https://docs.ted.europa.eu/api/latest/index.html) | Öffentliche IT-Ausschreibungen, Zuschläge | Auftraggeberkontakt in Bekanntmachung | Offizielle API und offene Ausschreibungsdaten |
| [service.bund.de](https://www.service.bund.de/) | Bundesweite öffentliche Ausschreibungen | Vergabestelle | Portalzugang und Nutzungsbedingungen prüfen |
| [eVergabe des Bundes](https://www.evergabe-online.de/) | Aktuelle Vergabeverfahren | Vergabestelle | Für Angebotsverfahren geeignet, nicht für freie Werbeansprache |
| [simap.ch](https://www.simap.ch/) (Schweiz) | Schweizer öffentliche Ausschreibungen | Vergabestelle | API und Nutzungsbedingungen gesondert vorhanden |
| [Förderdatenbank des Bundes](https://www.foerderdatenbank.de/) | Förderprogramme als Suchhypothesen | Kein Firmenkontakt | Zeigt Programme, nicht automatisch Empfänger; ergänzende Empfängerlisten nötig |
| [CORDIS](https://cordis.europa.eu/) | EU-Projekte, Forschung, Digitalisierung | Projektpartner und Firmenwebsite | Gute Quelle für konkrete Projekte |
| [DPMAregister](https://www.dpma.de/recherche/dpmaregister/) und [Espacenet](https://worldwide.espacenet.com/) | Patente, Marken, neue technische Schwerpunkte | Anmelder/Firma, dann Firmenwebsite | Bedarf nur indirekt ableitbar |
| Öffentliche Berufsprofile, z. B. LinkedIn/XING | Rolle, Zuständigkeit, Wechsel | Profil oder veröffentlichter Geschäftskontakt | Plattformbedingungen beachten; Angaben gegen Firmenquelle prüfen |
| Öffentliche GitHub-Organisationen und technische Dokumentation | Stack, Open-Source-Aktivität, Migrationshinweise | Firmenwebsite oder öffentliches Business-Profil | Techniksignal ist keine bestätigte Kaufabsicht |
| DNS- und Zertifikatsdaten, z. B. [crt.sh](https://crt.sh/) | Neue Subdomains, Domains, Dienste | Kein direkter Kontakt | Schwaches Indiz; nur zusammen mit anderen Belegen verwenden |

## Priorität für quovadis

1. **Hohe Aussagekraft:** Firmenwebsite, Karriereanzeigen, offizielle Ausschreibungen, Unternehmensmeldungen. Sie liefern datierbare Aussagen zur konkreten Firma.
2. **Identität und Kontakt abgleichen:** Register, Impressum, offizielle Firmenseite, Geschäftsverzeichnisse und öffentliche Berufsprofile. Telefonnummer und E-Mail müssen als veröffentlicht oder separat geprüft markiert werden; ein geratenes E-Mail-Muster ist kein bestätigter Kontakt.
3. **Ergänzende Indizien:** Bewertungen, Webtechnologien, Patente, Zertifikatsdaten, Messe- und Verbandsseiten. Diese Quellen helfen bei der Einordnung, sollten allein aber keinen hohen Opportunity-Score begründen.

Für jede Beobachtung sollte quovadis `firma`, `signaltyp`, `quell_url`, `fundstelle/zitat`, `veröffentlicht_am` (falls vorhanden), `abgerufen_am`, `zuverlässigkeit`, `kontakt_herkunft` und `prüfstatus` speichern. Ein Dossier aus mehreren unabhängigen Belegen macht den vorgeschlagenen Gesprächsanlass nachvollziehbar. Bei geschäftlicher E-Mail-Ansprache gelten zusätzlich die Anforderungen des [§ 7 UWG](https://www.gesetze-im-internet.de/uwg_2004/__7.html); öffentlich gefundene Kontaktdaten allein ersetzen keine zulässige Kontaktgrundlage.
