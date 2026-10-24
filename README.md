# quovadis

Eigenständig betriebener IT Opportunity Radar für einen externen IT-Dienstleister. Der Agent sucht nach belegbaren IT-Bedarfssignalen, recherchiert anschließend die betreffenden Firmen und bewertet die Passung zum eigenen Angebot. React mit [HeroUI](https://heroui.com/), Next.js, PostgreSQL, SearXNG und ein interner Recherche-Worker. Kein n8n erforderlich.

## Start auf Ubuntu

Voraussetzung: Git, Docker Engine und das Docker-Compose-Plugin sind installiert.

```bash
git clone https://github.com/pllanaio/quovadis.git
cd quovadis
docker compose up --build -d
```

1. `http://localhost:3000` auf dem Server öffnen und den ersten Administratorzugang im Login-Screen anlegen. Benutzername und Passwort werden selbst gewählt; es gibt keine Standard-Zugangsdaten.
2. Unter **Einstellungen → KI & Quellen** OpenAI oder Claude, einen für den eigenen API-Zugang verfügbaren Modellnamen und den API-Key speichern. Firecrawl ist optional.
3. Unter **Einstellungen → Recherche** Uhrzeit, Zeitzone, bis zu drei Städte, Umkreis und das eigene IT-Angebot festlegen. Bedarfssignale, Suchauftrag und Suchtiefe sind dort ebenfalls bearbeitbar.
4. **Suche starten** anklicken. Unter **Recherche** erscheinen Status, Arbeitsschritt, Suchanfragen, gefundene URLs, gelesene Originalseiten und neue Signale. Die Vertiefung der Firmen läuft anschließend separat weiter.

Der Port ist standardmäßig an `127.0.0.1:3000` des Servers gebunden. Für einen schnellen Zugriff vom eigenen Rechner einen SSH-Tunnel öffnen:

```bash
ssh -L 3000:127.0.0.1:3000 BENUTZER@SERVER-IP
```

Danach im Browser des eigenen Rechners `http://localhost:3000` aufrufen. Für dauerhaften Zugriff aus dem Firmennetz einen HTTPS-Reverse-Proxy auf dem Server einrichten.

Alle fachlichen Einstellungen und Zugangsdaten werden in der Oberfläche verwaltet. PostgreSQL und die Suchmaschine starten mit Docker Compose. Die Verschlüsselungs- und Worker-Schlüssel werden automatisch im persistenten Docker-Volume `app_data` erzeugt. **`app_data` und `postgres_data` gemeinsam sichern**; ohne den Verschlüsselungsschlüssel lassen sich gespeicherte API- und SMTP-Zugangsdaten nicht wiederherstellen.

### Bestehende Installation aktualisieren

Im vorhandenen Repository auf dem Ubuntu-Server:

```bash
cd /pfad/zu/quovadis
git pull --ff-only origin main
docker compose up --build -d
```

Einstellungen, Benutzer, Firmen und Notizen bleiben in den Docker-Volumes erhalten; Datenbankanpassungen erfolgen automatisch. `docker compose down -v` würde die Volumes löschen und gehört nicht zum Update. Falls Git wegen eigener lokaler Änderungen abbricht, diese zuerst sichern oder zusammenführen.

Für eine Statusprüfung:

```bash
docker compose ps
docker compose logs --tail=100 app worker
```

## Oberfläche und Darstellung

Die Oberfläche verwendet das offizielle **Coinbase-Preset von HeroUI** mit lokal ausgelieferter Inter-Schrift. Der Darkmode hat einen **schwarzen Seitenhintergrund (`#000000`)**; abgestufte Oberflächen halten Karten, Felder und Dialoge erkennbar. Über das Sonnen-/Mondsymbol lässt sich jederzeit umschalten. Unter **Einstellungen → Konto → Darstellung** stehen **Hell**, **Schwarz** und **System** zur Wahl. Die Auswahl gilt für diesen Browser und bleibt nach dem Neuladen erhalten; standardmäßig folgt sie dem Betriebssystem.

Auf Smartphones gibt es eine untere Schnellnavigation, Firmenkarten und bildschirmfüllende Dossiers mit vier direkt erreichbaren Bereichen. Die zusätzliche Auswertung lässt sich auf dem Dashboard aufklappen. Tablets zeigen ein Raster, große Desktopfenster eine Firmentabelle. Das Navigationsmenü, Dossiers und der KI-Begleiter lassen sich auch mit der Tastatur bedienen und mit Escape schließen.

## Tägliche agentische Recherche

**Standard:** täglich um **07:00 Uhr, Europe/Berlin**, München, Augsburg und Landsberg am Lech mit jeweils **40 km Umkreis**. Zeitplan, Zeitzone, eine bis drei Städte und Umkreis von 0 bis 250 km sind im Frontend änderbar. Die Standortprüfung berücksichtigt amtliche Kurz- und Alternativnamen, etwa „Garching“ für „Garching bei München“. Mehrdeutige gleichnamige Gemeinden bleiben unbestätigt. Der Umkreis bezieht sich auf die Luftlinie zwischen Ortszentren; die Standortprüfung berücksichtigt derzeit Orte in Deutschland. Sommer- und Winterzeit folgen der gewählten Zeitzone.

Der Worker prüft den Zeitplan etwa jede Minute. Pro lokalem Kalendertag wird ein automatischer Suchlauf in PostgreSQL eingeplant. Nach einem Neustart nach der eingestellten Uhrzeit wird der noch fehlende Lauf für den aktuellen Tag nachgeholt. Frühere ausgefallene Tage werden nicht gesammelt nachgeholt. **Automatisch recherchieren** pausiert die tägliche Einplanung; manuelle Läufe bleiben möglich.

Der Ablauf ist **eingeplant → läuft → abgeschlossen/fehlgeschlagen**. Die Browseranfrage legt einen Auftrag in der Warteschlange an; der Worker verarbeitet ihn im Hintergrund. Der Browser muss währenddessen nicht geöffnet bleiben. Ein erneuter manueller Start bei bereits eingeplanter oder laufender Suche verwendet den bestehenden Auftrag.

### Mehr Suchabdeckung, überprüfbare Ergebnisse

Der Agent kombiniert kurze Anfragen pro Stadt und aktivierter Signalart mit bis zu acht KI-geplanten Zusatzanfragen. Jede Anfrage fokussiert einen Ort und ein Bedarfssignal; überlange Orts- und Stichwortketten werden verworfen. Nach der ersten Auswertung kann eine zweite Runde mit bis zu acht neuen Anfragen unterrepräsentierte Städte, Nachbarorte und Quellenarten ergänzen. Treffer werden zwischen Anfragen gemischt, doppelte URLs entfernt und passende Stellen- oder Ausschreibungsdetailseiten verfolgt.

Gesucht werden insbesondere:

- Erster IT-Administrator, IT-Allrounder, Aufbau einer IT-Abteilung oder externe IT-Betreuung.
- Aufbau, Planung, Erneuerung, Erweiterung oder Modernisierung bestehender IT; Cloud-, ERP-, CRM-, Sicherheits- und Automatisierungsprojekte.
- Ausschreibungen und ausdrückliche Dienstleistergesuche.
- Öffentlich lesbare Social-Media-Aufrufe, Unternehmensmeldungen, regionale Presse und online verfügbare Zeitungsartikel oder Anzeigen.
- Wachstum und neue Standorte als indirekte Hinweise, ausdrücklich als vermuteter Bedarf eingeordnet.

**Originalseiten pro Suchlauf** ist standardmäßig **60**, einstellbar von **12 bis 150**. Das ist das Budget für Seitenabrufe in der agentischen Signalerkennung, keine zugesagte Firmenanzahl. Nicht lesbare Seiten verbrauchen ebenfalls Abrufbudget. Zusätzliche feste Quellen und die anschließende Firmenrecherche werden separat verarbeitet. Größere Budgets benötigen mehr Zeit und KI-Aufrufe; ein Lauf hat außerdem ein Zeitbudget von ungefähr 18 Minuten.

Ein Treffer braucht eine benannte Firma, einen Standort im eingestellten Gebiet, eine überprüfte Original-URL und ein wörtliches IT-Signal aus dem gelesenen Text. Suchmaschinenbeschreibungen allein reichen nicht. Quellen ohne passenden Beleg oder verifizierbaren Standort ergeben keine Opportunity. Die Anzahl neuer Signale kann von der Anzahl neuer Firmen abweichen, weil eine bekannte Firma weitere Signale erhalten kann. **Es gibt keine garantierte Mindestmenge und keine erfundenen Ersatz-Leads.**

### Websuche ohne Firecrawl

Standardmäßig nutzt der Agent die KI-interne Websuche von OpenAI oder Claude mit deinem gespeicherten API-Key. Firecrawl und die lokale SearXNG-Suche sind zunächst ausgeschaltet und lassen sich unter **Einstellungen → KI & Quellen** einzeln zuschalten. Originalseiten werden weiterhin direkt geladen; dafür ist kein Firecrawl-Key nötig. Ausgeschaltete Suchdienste werden auch bei Fehlern nicht als Fallback verwendet.

SearXNG nutzt eine explizite Gruppe aktivierter Websuchmaschinen. Metasuchanfragen laufen nacheinander mit Abstand, um die Anbieter nicht durch parallele Anfragen zu überlasten. **Keine Treffer**, **einzelne ausgefallene Engines** (etwa CAPTCHA) und **vollständiger Ausfall** werden getrennt behandelt. Ein Teilausfall ist kein Beweis, dass alle Suchmaschinen ausgefallen sind. Bei einem vollständigen Ausfall pausiert der Zugriff kurzzeitig; ein manueller Verbindungstest kann sofort erneut prüfen.

**Bevorzugter Suchzugang** bestimmt die Reihenfolge der aktivierten Dienste. Standard ist **Direkte KI-Websuche**. Firecrawl und SearXNG werden nur nach ausdrücklicher Aktivierung verwendet. **Firecrawl-Schlüssel löschen** entfernt den gespeicherten Schlüssel beim nächsten Speichern und schaltet Firecrawl aus. Ein bloß leer gelassenes Passwortfeld behält den vorhandenen Schlüssel bei.

**KI-Websuche als Ersatz** ist im automatischen Modus unter **Einstellungen → KI & Quellen** abschaltbar. Bei ausgefallener integrierter Suche oder eingeschränkter Suche ohne Treffer nutzt QuoVadis den vorhandenen API-Key und das konfigurierte Modell: OpenAI über Responses mit `web_search`, Claude über das serverseitige Websuchwerkzeug. Es wird kein anderer Modellname automatisch gewählt. Das Modell und der API-Zugang müssen Websuche unterstützen; zusätzliche Such- und Tokengebühren des Anbieters können anfallen. Die KI-Suche übernimmt Quellen aus Suchwerkzeug-Ergebnissen beziehungsweise aus den strukturierten URL-Zitaten der API nach einer abgeschlossenen Suche. Fehlt beides, wird die Anfrage einmal wiederholt. Ein weiterhin unvollständiges Antwortformat sperrt den Anbieter nicht für weitere Suchanfragen. Modelltext wird nicht als Fundstelle übernommen; die Originalseiten werden danach weiterhin separat gelesen und belegt.

Wenn sämtliche verfügbaren Suchzugänge scheitern, stoppt der Lauf weitere Suchanfragen und eine zweite KI-Planung. Bereits gefundene Originalseiten werden noch ausgewertet, gespeicherte Firmen bleiben erhalten. Ein abgebrochener Lauf erscheint als **Unvollständig** beziehungsweise **Fehlgeschlagen**, mit einer zusammengefassten Diagnose statt wiederholter identischer Fehlerzeilen. Fehler einzelner Antworten stoppen die weiteren Suchanfragen nicht. Firecrawl meldet konkrete HTTP-/Guthaben-/Rate-Limit-Ursachen und berücksichtigt `Retry-After`; ein Fehler beim Lesen einer einzelnen Originalseite deaktiviert die Suchfunktion nicht. Nach Behebung kann **Suche starten** einen neuen Lauf auslösen; ohne manuellen Neustart erfolgt der nächste automatische Versuch zum nächsten täglichen Termin.

Die Suche braucht Internetzugang vom Server und öffentlich erreichbare Suchmaschinen und Seiten. **Einstellungen → KI & Quellen → Websuche ohne KI testen** prüft Suchtreffer und lesbare Originalseiten. Dieser Verbindungstest prüft keine KI-Auswertung. **Konfigurierte Suche testen** prüft die gespeicherte Suchkonfiguration einschließlich Ersatzsuche, sofern diese benötigt wird. Beide Tests nennen verwendeten Suchzugang, betroffene Engines und konkrete Störungen. Geänderte Zugangsdaten und Einstellungen zuerst speichern. Für den vollständigen Recherchelauf ist der API-Key des gewählten KI-Anbieters erforderlich.

## Firmendossier, Bewertung und Kontakt

**Deep Research beginnt erst nach einem belegten Signal.** Die separate Warteschlange recherchiert Firmenwebsite, Impressum, Kontakt- und Teamseiten, öffentliche Social-Media-Profile, weitere Webquellen und aktivierte MCP-Quellen. Der Worker bearbeitet zwei Firmen parallel und setzt die nächste Gruppe sofort fort, solange weitere Einträge bereitstehen. Das Quellenmonitoring läuft unabhängig davon. Der Browser muss dafür nicht geöffnet bleiben.

Jede Firma erhält einen eigenen Dossier-Auftrag. Die Oberfläche unterscheidet **Zur Vertiefung**, **Wird vertieft**, **Wiederholung geplant** und **Vertieft** und zeigt Fortschritt, Versuchszahl und nächsten Versuch. Unterbrochene Aufträge werden beim nächsten Worker-Durchlauf wieder aufgenommen. Fehlgeschlagene Versuche werden nach 2, 5, 15 und 60 Minuten erneut versucht; nach fünf Fehlschlägen pausiert die Firma bis zum nächsten Tag. **Vertiefungen fortsetzen** stößt offene Arbeit an und gibt fehlgeschlagene Aufträge sofort wieder frei. Eine fehlende Worker-Aktivität wird angezeigt.

Für eine abgeschlossene Vertiefung müssen eine überprüfbare gelesene Firmenquelle und ein auswertbares KI-Dossier vorliegen. Ist nur der erneut gelesene Originalbeleg verfügbar, wird die Firma trotzdem klassifiziert und ausdrücklich als **Vertieft · Datenlage eingeschränkt** gekennzeichnet. Nicht belegte Kontakte und Kennzahlen bleiben unbekannt. Fehlende Zugänge oder dauerhaft unlesbare Quellen werden nicht als erfolgreiche Recherche ausgegeben.

KI-Auswertungen fordern strukturiertes JSON an. Vollständige Arrays, JSON-Objekte mit Firmenlisten und einzeln gelieferte Firmen werden verarbeitet; eine abgebrochene oder formal falsche Antwort erhält höchstens einen erneuten Versuch mit größerem Ausgabebudget. Unvollständige Antworten werden nicht als „keine Treffer“ gespeichert. Transiente Verbindungsfehler und HTTP 429/502/503/504 beim Lesen einer Originalseite erhalten höchstens einen kurzfristigen Wiederholungsversuch; längeres `Retry-After` wird respektiert. Zertifikatsprüfungen bleiben aktiv.


Ein Klick auf die Firma öffnet das Dossier mit vier Bereichen:

| Bereich | Inhalt |
|---|---|
| Überblick | Konkreter Anlass, Bedarf und externe Vergabebereitschaft, Match-Prognose, Gesprächseinstieg, Preis- und Betreuungsschätzung |
| Kontakte & Firma | Veröffentlichte Telefon- und E-Mail-Kontakte, Website und offizielle Profile; Anschrift, Branche, Geschäftsführung, Rollen, Technologie und belegte Kennzahlen |
| Belege | Originalquellen, Zitate, Prüf- und bekannte Veröffentlichungsdaten, einzelne Signale und ihr Verlauf |
| Verlauf | Textnotizen sowie dokumentierte Telefonate und E-Mails |

LinkedIn, Instagram, Facebook, YouTube und XING werden berücksichtigt, soweit öffentlich zugängliche Informationen gefunden werden. Bilanzen, Jahresabschlüsse, Umsatz und andere Kennzahlen werden nur mit belegbarer Quelle aufgenommen; das Berichtsjahr gehört zur recherchierten Angabe. Fehlende Daten bleiben unbekannt. Geschützte Portale und lizenzierte Datenbanken werden nicht umgangen, E-Mail-Adressen werden nicht erfunden. Finanzdaten und sämtliche Kontaktwege sind deshalb nicht für jede Firma verfügbar.

Öffentliche PDF-Berichte werden auch ohne Firecrawl gelesen: bis 8 MiB, maximal die ersten 80 Seiten beziehungsweise 60.000 Zeichen. Reine Bildscans benötigen OCR und werden derzeit nicht ausgewertet.

Die KI bewertet die Passung zum unter **Dein IT-Angebot** gespeicherten Leistungsprofil:

| Teilbewertung | Maximalpunkte |
|---|---:|
| Konkretheit des IT-Bedarfs | 35 |
| Passung zu externer IT-Betreuung und dem eigenen Angebot | 25 |
| Aktualität | 15 |
| Wirtschaftliches Potenzial | 15 |
| Geeignete geschäftliche Kontaktwege | 10 |

Der Gesamtscore wird als Ampel dargestellt: **grün ab 80**, **gelb von 60 bis 79**, **rot unter 60**. Nachgewiesener Bedarf, vermuteter Bedarf und nachgewiesene Bereitschaft zur externen Vergabe bleiben getrennt. Eine IT-Stellenanzeige allein belegt keinen externen Vergabewillen. Match-Prognose, monatliches Betreuungspotenzial und Preisspanne auf Basis von **100 € netto pro Stunde** sind begründete Schätzungen.

**Anrufen** und **E-Mail schreiben** öffnen den Telefon- beziehungsweise Mailclient. Erfolgte Kontakte werden anschließend mit einer Notiz im Verlauf dokumentiert. Das bloße Öffnen eines Kontaktlinks bestätigt keinen Kontakt.

### Zehn Tage ohne Textnotiz

Ein Lead bleibt bis zehn Tage nach seiner Erfassung beziehungsweise nach der letzten gespeicherten, nicht leeren Textnotiz in den aktiven Charts. Auch der Text einer dokumentierten E-Mail oder eines Telefonats zählt als Notiz.

Nach Ablauf der zehn Tage erscheint er unter **Zurückgestellt**, verschwindet aus Charts und frischen Opportunities und wird hinter aktiven Leads einsortiert. Das Dossier wird nicht gelöscht. Eine neue Textnotiz aktiviert den Lead für weitere zehn Tage. Automatische Recherche, neu erkannte Signale, Kontaktklicks und Kontakteinträge ohne Text verlängern die Frist nicht. Der fachliche Match-Score bleibt erhalten; für die Platzierung wird ein gesonderter, bei ruhenden Leads reduzierter Rankingwert bereitgestellt.

## Weitere Quellen, MCP und Monitoring

Unter **Einstellungen → KI & Quellen → Zusätzliche Quellen & MCP-Tools** lassen sich feste Websites und MCP-Tools ergänzen. Aktivierte Recherche-Skills bestimmen die berücksichtigten Signalarten.

| Zweck | Verarbeitung |
|---|---|
| Bedarfssignale finden | Konfigurierte Website oder MCP-Tool bei einem Suchlauf lesen; nur belegte Firmen im eingestellten Gebiet speichern |
| Firmen recherchieren | Aktiviertes MCP-Tool erst nach erkanntem Signal für das betreffende Unternehmen ausführen |

MCP-Argumente unterstützen `{{company_name}}`, `{{city}}`, `{{signal}}`, `{{company_url}}` und `{{source_url}}`. Tools müssen vollständige HTTP(S)-Quellen-URLs und nachvollziehbare Belegtexte liefern. Pro MCP-Quelle kann ein Bearer-Token gespeichert werden. Fehlt eine belastbare zusätzliche Quelle, bleibt die Firma mit entsprechendem Recherchestatus sichtbar.

Firmen werden zusammengeführt, einzelne Signale und Änderungen getrennt gespeichert. Bereits bekannte Originalbelege werden nach ungefähr 23 Stunden wieder zur Prüfung fällig; der Worker verarbeitet kleine Gruppen. Nicht abrufbare Anzeigen bedeuten **derzeit nicht auffindbar**, nicht automatisch **Stelle besetzt** oder **Projekt vergeben**.

Weiterführend: [Ablauf und Datenmodell](docs/ablauf.md), [Katalog öffentlicher Quellen](docs/quellenkatalog.md) und [REA-Analyse der öffentlich sichtbaren OpenProspect-Abläufe](docs/openprospect-analyse.md). Der Quellenkatalog ist eine Recherchegrundlage und keine Liste bereits vorhandener direkter Portal-Integrationen.

## SMTP und gespeicherte Zugangsdaten

Unter **Einstellungen → Verbindungen** werden SMTP-Server, Port, TLS, Benutzername, Passwort, Absender, Empfänger und Wiedervorlagefrist hinterlegt. **Testmail senden** prüft die Verbindung. Bei konfiguriertem SMTP und fälligen Wiedervorlagen verschickt der Worker eine tägliche Zusammenfassung an den eingestellten Empfänger. Die Wiedervorlagefrist ist von der festen Zehn-Tage-Regel für die Charts unabhängig.

OpenAI wird über die Chat-Completions-API, Claude über die Messages-API angesprochen. API-Schlüssel, MCP- und GitHub-Tokens sowie SMTP-Passwort werden mit AES-256-GCM in PostgreSQL verschlüsselt und nach dem Speichern nicht an den Browser zurückgegeben. Das Administratorpasswort lässt sich unter **Einstellungen → Konto** ändern.

## KI-Begleiter

Über **KI-Begleiter** lässt sich direkt im Tool mit dem konfigurierten OpenAI- oder Claude-Modell schreiben. Der Chat kennt Suchauftrag, Region, eigenes IT-Angebot, aktivierte Skills und Quellen sowie gegebenenfalls den ausgewählten Lead. Er kann Suchprompts formulieren, Leads einordnen und E-Mail-Texte entwerfen. Er versendet aus dem Chat keine E-Mails.

### Firma per URL prüfen

Sende dem Begleiter eine Firmen-URL oder beispielsweise **„Prüfe https://firma.de“**. Der Auftrag wird in PostgreSQL gespeichert und vom Hintergrunddienst verarbeitet, unabhängig vom täglichen Suchlauf. Zuerst werden Firmenname und Standort anhand gelesener Seiten verifiziert. Danach folgen dieselbe Vertiefung, Kontakt- und Kennzahlenrecherche sowie Bewertung wie bei automatisch gefundenen Firmen. Die Prüfung ist auch ohne Firecrawl und ohne öffentliche Telefonnummer oder E-Mail möglich. Manuell eingereichte Firmen dürfen außerhalb der automatischen Suchregion liegen.

Der Chat zeigt den Status und bietet **Firmendossier öffnen** an, sobald die Firma erfasst ist. Unter **Alle Firmen** erscheint der Eintrag ebenfalls. Ohne belegten Anlass heißt die Einordnung **Kein IT-Bedarf belegt**; ein später verifiziertes Signal wird regulär übernommen. Bestehende Firmen und Notizen bleiben erhalten. Unterbrochene Aufträge werden wieder aufgenommen; nach drei erfolglosen Versuchen wird der Fehler angezeigt und die URL kann erneut gesendet werden. Ein gelöschter Eintrag wird durch einen bereits abgeschlossenen URL-Auftrag nicht wieder angelegt.

Für einen Promptvergleich kann der Begleiter dieselben geprüften Originalseiten oder eine konfigurierte feste Quelle mit zwei Promptvarianten auswerten. Trefferzahl, durchschnittlicher Modell-Score und Quellennachweise werden angezeigt. Das ist eine Orientierung, keine objektive Qualitätsmessung.

Der Begleiter kann Änderungen an Suchprompt, Recherche-Skills, Quellen, täglicher Startzeit, Lead-Notizen und Lead-Bewertungen sowie einen Recherchelauf vorschlagen. Jede Änderung wird erst durch **Änderung übernehmen** ausgeführt. API-Schlüssel und SMTP-Passwörter bleiben außerhalb des Chatkontexts. Chatverlauf und Promptvergleiche werden in PostgreSQL gespeichert.

### Quellcode und GitHub-PRs

Unter **Einstellungen → Verbindungen → GitHub** werden Organisation/Owner, Repository, Basis-Branch und ein GitHub-Token hinterlegt. Ein Fine-grained Personal Access Token benötigt für das Ziel-Repository **Contents: Read and write** und **Pull requests: Read and write**. Der Token wird verschlüsselt gespeichert und nicht an den Chat gesendet.

Wenn eine Quellcodeänderung gewünscht ist, schlägt der Begleiter eine konkrete Aufgabe vor. **Entwurf vorbereiten** liest geeignete Textdateien aus dem konfigurierten Repository und erzeugt einen begrenzten Code-Diff. **Diff prüfen** zeigt den vollständigen Entwurf. Erst **Draft-PR erstellen** legt einen Branch und einen GitHub Pull Request an. Der Basis-Branch darf sich zwischen Entwurf und PR nicht verändert haben; andernfalls muss ein neuer Entwurf erzeugt werden. Der PR wird nicht automatisch gemergt. Der Entwurf kann bis zu vier kleine Textdateien ändern und fügt keine neuen Paket-Abhängigkeiten hinzu. Größere Aufgaben sollten in mehrere Entwürfe aufgeteilt werden.

## Business Trigger Engine

Die fünf Scouts recherchieren unabhängig nach externer IT-Nachfrage, Geschäftsanlässen, IT-Projekten, Wachstum und IT-Stellen. Unter **Einstellungen → Recherche** lassen sich die Budgetanteile ändern (zusammen 100 %; Standard 25/30/20/15/10). Die Anteile steuern Suchanfragen und gelesene Seiten, keine Ergebnisquote. Städte und Radius bleiben verbindlich. Quellenzugänge müssen erreichbar sein; eine bestimmte tägliche Trefferzahl wird nicht zugesichert.

Im Dashboard filtert **Opportunity-Art** nach Anlass, Einstiegsprojekten mit einer geschätzten Preisspanne im Bereich 500–2.000 € und hohem Betreuungspotenzial. Im Dossier stehen belegte Ereignisse mit Originalquelle, getrennt gekennzeichnete KI-Hypothesen, Einstiegsangebote und offene Fragen. Allgemeiner Score, **IT Need Confidence**, **Entry Opportunity Score** und externe Beauftragbarkeit sind getrennte Werte. Der Entry Score ist keine Kaufwahrscheinlichkeit. Wachstum allein bestätigt keinen IT-Bedarf, interne Stellen keinen externen Auftrag. Ein bereits ausgewählter Partner senkt die Einstiegschance.

Angebote sind Kalkulationsideen: Aufwand × konfigurierter Netto-Stundensatz (Standard 100 €/h), kein bekanntes Kundenbudget. Unternehmensereignisse, daraus abgeleitete Leistungen und Analyseversionen werden getrennt gespeichert. Die Migration ergänzt bestehende Tabellen; IDs, Notizen und Kontaktverläufe bleiben erhalten.

Unter **Einstellungen → KI & Quellen** können optional Vorfilter- und Analysemodell sowie das OpenAI-Reasoning-Level gewählt werden. Leere Modellfelder nutzen das konfigurierte Hauptmodell. Das stärkere Modell analysiert nur zuvor belegte relevante Ereignisse. Bei unverändertem Quellentext und identischen Analyseeinstellungen wird die Seitenanalyse wiederverwendet; Änderungen an Angebot, Stundensatz oder Modell lösen eine neue Analyse aus. Cacheeinträge werden nach 30 Tagen bereinigt. Tokenverbrauch und Fehler werden protokolliert. Kosten sind Schätzungen anhand der selbst eingetragenen Hauptmodellpreise; andere Modelle und Suchgebühren bleiben als nicht bepreist kenntlich.

### Firmen löschen

Unter **Alle Firmen** kannst du Firmen per Checkbox auswählen (auch über mehrere Seiten), alle gefilterten Firmen markieren und **Auswahl löschen** verwenden. Nach der Bestätigung werden ausschließlich die ausgewählten Firmen samt Notizen, Kontaktverlauf, Signalen, Ereignissen, Analysehistorie und zugehörigem Seitenanalysecache entfernt. Dieselbe Löschung bleibt im Dossier verfügbar. Es gibt keinen Ausschluss von künftigen Suchen: neue Fundstellen können dieselbe Firma erneut anlegen. Frühere Ausschlüsse werden beim Update entfernt. Die Löschung ist endgültig.

### Prüfungen

```bash
# Unit- und Regressionstests, ohne bezahlte KI-Aufrufe
for test in scripts/*test.mjs; do node "$test" || exit 1; done
npm run build
# Browser gegen laufende Instanz; HTTP-Antworten sind isolierte Fixtures, keine Datenbank-Leads
UI_TEST_URL=http://127.0.0.1:3000 node tests/ui-smoke.mjs
```

`scripts/business-db-integration.mjs` prüft Migration und Löschung mit echtem PostgreSQL. Es akzeptiert ausschließlich eine eigens angelegte, leere Datenbank namens `quovadis_business_test` über `DATABASE_URL`; diese danach entfernen. Ein echter kostenpflichtiger Recherchelauf benötigt die eigenen gespeicherten API-Zugänge.

## App-Icons

Das Radar aus dem vorhandenen Logo wird für SVG-Favicon, ICO (16/32/48 px), PNG-Favicons, Apple-Touch-Icon (180 px) und Manifest-Icons (192/512 px, auch maskierbar) verwendet. Die Assets werden ausgeliefert; `node scripts/generate-icons.mjs` erzeugt sie bei Bedarf aus `public/favicon.svg` erneut.


## Opportunity Intelligence, Website-Check und Social Media

- **Suchprofil:** Standardmäßig werden Firmen mit ungefähr 50–500 Mitarbeitenden bevorzugt. Der Bereich ist unter Recherche konfigurierbar; unbekannte Größen und fehlende öffentliche Kontaktdaten sind kein Ausschluss. IT-Stellenanzeigen für Betrieb, Support und Administration gehören ausdrücklich dazu. Die Standardverteilung der Scouts enthält 25 % IT-Stellen; alte Standardgewichte werden einmalig angepasst. Individuelle Gewichte bleiben erhalten. Große Ausschreibungen sind nachrangig, realistische externe Ergänzung und allein umsetzbare Einstiegsprojekte bevorzugt. Eine Stellenanzeige beweist keine Bereitschaft zur externen Vergabe.
- **Sortierung:** Kontaktpriorität, höchster Score, niedrigster Score und neueste Firmen. Die Scoresortierung berücksichtigt auch Firmen unter 80 Punkten. „Hohe Passung“ ist ein eigener Filter.
- **Kontaktverlauf:** Ein Klick auf Telefon/E-Mail protokolliert Ziel, Kanal und Zeitpunkt als Kontaktversuch. Das beweist weder ein geführtes Gespräch noch den Versand einer E-Mail. Die Kontaktpriorität sinkt einmalig um 15 Punkte; die fachliche KI-Passung bleibt erhalten. Wiederholte Klicks innerhalb von zehn Sekunden werden zusammengefasst. Das Ergebnis lässt sich anschließend als Notiz dokumentieren. Nur echte Textnotizen erneuern die Frist von zehn Tagen in den Charts.
- **Websiteanalyse:** Im Dossier unter Belege lässt sich der Website-Check starten und `pllana.io/website-check` öffnen. Der Originalkern aus `pllanaio/pllanaio` wurde übernommen; Herkunft und Anpassungen stehen unter `lib/website-check/ORIGIN.md`. Die 19 Bereiche enthalten unter anderem CMS/Technik, DNS/Mail, TLS/HTTPS, Header, SEO, strukturierte Daten und öffentliche Unternehmensangaben. Der Google-PageSpeed-Key wird unter KI & Quellen gespeichert oder gelöscht; die PageSpeed Insights API muss im Google-Projekt aktiviert sein. Mit gespeichertem Key und aktivierter Einstellung „Websitechecks automatisch bei der Vertiefung ausführen“ werden Firmenwebsites bei der Vertiefung automatisch geprüft, nach sieben Tagen erneut. Ohne Key kann ein manueller Test die öffentlichen Kontingente nutzen. Teilfehler werden ausgewiesen. Technische Befunde fließen bei der nächsten Vertiefung in Prognose, Score und Gesprächseinstieg ein. Labormessungen und Heuristiken sind keine bestätigten Sicherheitslücken, Rechtsverstöße oder Kaufabsichten.
- **Firmenverbindungen:** Die Ansicht „Verbindungen“ zeigt gemeinsame belegte Geschäftsanschriften, Geschäftsnummern, E-Mail-Adressen und Namensnennungen mit Originalquellen. Gleichheit allein beweist keine Beteiligung, Personenidentität oder Geschäftsbeziehung. Der Graph prüft bis zu 2.000 Firmen; Einträge lassen sich direkt öffnen.
- **Social Media ohne Login (Standard):** Unter Einstellungen → Verbindungen ist der öffentliche Modus voreingestellt. QuoVadis liest zuerst öffentliche Originalseiten; bei fehlendem Seitentext ergänzt der installierte Agent-Reach-Skill den Zugriff über seinen Jina-Webleser. Docker installiert Agent-Reach 1.6.0 aus einer festgelegten Quellrevision automatisch. „Installation prüfen“ zeigt den Dienst- und Skillstatus. Es werden keine Zugangsdaten oder Cookies an Agent-Reach übergeben. Plattformen können öffentliche Zugriffe trotzdem blockieren oder eine Anmeldung verlangen; der Skill garantiert keinen vollständigen Instagram-/Facebook-/TikTok-Zugriff. Native OpenCLI-Kanäle mit gegebenenfalls nötiger Anmeldung werden nicht automatisch installiert. Alte wegen Browser-Anmeldung pausierte Aufträge werden beim Wechsel in den öffentlichen Modus einmalig wieder eingeplant; eine neue öffentliche Zugangssperre bleibt anschließend pausiert.
- **Optionale eigene Sitzung:** Unter Verbindungen kann ausdrücklich auf die Browser-Sitzung umgeschaltet werden. Dort werden Plattformzugänge gespeichert. Instagram, Facebook, TikTok, LinkedIn, XING, X, YouTube und Pinterest haben eigene Playwright-Sitzungen. Benutzername und Passwort liegen verschlüsselt in PostgreSQL; Cookies, Local Storage und IndexedDB werden verschlüsselt im zusätzlichen `browser_data`-Volume gespeichert. Schlüssel stammen aus dem bestehenden `app_data`-Volume. Diese Volumes gemeinsam sichern. „Cookies und Sitzung löschen“ entfernt die Sitzung, Zugangsdaten werden separat entfernt.
- **Anmeldung:** Erst Einstellungen speichern, dann „Anmelden / Sitzung fortsetzen“. Die Browseransicht erlaubt aktive Anmeldung und 2FA-Eingaben. CAPTCHA, Sicherheitsabfragen und abgelaufene Sitzungen verlangen eine Aktion des Nutzers. Die Automatik umgeht sie nicht und pausiert die betroffenen Aufträge. Ohne reale Plattformzugänge lässt sich die erfolgreiche Anmeldung nicht vorab garantieren.
- **Beitragsanalyse:** Im Dossier unter Belege lassen sich offizielle, bereits belegte Firmenprofile analysieren. Die optionale Einstellung „Social-Media-Profile automatisch im Deep Dive analysieren“ legt Hintergrundaufträge an. Im öffentlichen Modus werden ein Profil und bis zu vier verlinkte Beitragsseiten innerhalb eines begrenzten Zeitbudgets gelesen. Ein Profiltext wird separat gespeichert, zählt nicht als Beitrag und fließt als Profilinformation in die Vertiefung ein. Im optionalen Browser-Modus werden höchstens fünf Scrollschritte und acht zusätzliche Beitragsseiten erfasst; Analysen speichern bis zu 30 sichtbare Beiträge. Das ist keine vollständige Historie. Postingfrequenz wird nur als beobachtete Rate berechnet, wenn mindestens 28 Tage mit datierten Beiträgen vorliegen. Nicht datierte oder nicht lesbare Inhalte bleiben unbekannt. Preise brauchen einen wörtlichen Beitragsbeleg samt Währung. Die Auswertung enthält Themen, mögliche IT-Anlässe und Quellen und wird in der nächsten Vertiefung berücksichtigt. Es werden keine Nachrichten oder Posts automatisch veröffentlicht.

Der Browserdienst läuft intern auf Port 3010, Agent-Reach intern auf Port 3012; beide ohne veröffentlichten Host-Port. Der interne Agent-Reach-Adapter erlaubt nur authentifizierte Statusabfragen und lesende öffentliche Social-URLs, keine beliebigen Befehle oder automatische Logins. Rate-Limits und Sicherheits-/Login-Sperren stoppen den jeweiligen Versuch ohne Wechsel auf ein anderes Konto oder Backend. Das normale Update bleibt:

```bash
git pull --ff-only origin main && docker compose up -d --build
```

Beim ersten Update wird zusätzlich Chromium mit seinen Systembibliotheken installiert. Die optionale Browseranbindung braucht keinen weiteren externen Cloud-Dienst. Der öffentliche Agent-Reach-Zugriff verwendet zusätzlich den externen Jina Reader; dessen Erreichbarkeit und Limits gelten unabhängig von QuoVadis. Bestehende Einstellungen für die automatische Social-Recherche bleiben erhalten; bei bisher ausgeschalteter Automatik diese unter Verbindungen aktivieren.
