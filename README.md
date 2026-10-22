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

**Standard:** täglich um **07:00 Uhr, Europe/Berlin**, München, Augsburg und Landsberg am Lech mit jeweils **40 km Umkreis**. Zeitplan, Zeitzone, eine bis drei Städte und Umkreis von 0 bis 250 km sind im Frontend änderbar. Der Umkreis bezieht sich auf die Luftlinie zwischen Ortszentren; die Standortprüfung berücksichtigt derzeit Orte in Deutschland. Sommer- und Winterzeit folgen der gewählten Zeitzone.

Der Worker prüft den Zeitplan etwa jede Minute. Pro lokalem Kalendertag wird ein automatischer Suchlauf in PostgreSQL eingeplant. Nach einem Neustart nach der eingestellten Uhrzeit wird der noch fehlende Lauf für den aktuellen Tag nachgeholt. Frühere ausgefallene Tage werden nicht gesammelt nachgeholt. **Automatisch recherchieren** pausiert die tägliche Einplanung; manuelle Läufe bleiben möglich.

Der Ablauf ist **eingeplant → läuft → abgeschlossen/fehlgeschlagen**. Die Browseranfrage legt einen Auftrag in der Warteschlange an; der Worker verarbeitet ihn im Hintergrund. Der Browser muss währenddessen nicht geöffnet bleiben. Ein erneuter manueller Start bei bereits eingeplanter oder laufender Suche verwendet den bestehenden Auftrag.

### Mehr Suchabdeckung, überprüfbare Ergebnisse

Der Agent kombiniert systematische Anfragen pro Stadt und aktivierter Signalart mit bis zu acht KI-geplanten Zusatzanfragen. Nach der ersten Auswertung kann eine zweite Runde mit bis zu acht neuen Anfragen unterrepräsentierte Städte, Nachbarorte und Quellenarten ergänzen. Treffer werden zwischen Anfragen gemischt, doppelte URLs entfernt und passende Stellen- oder Ausschreibungsdetailseiten verfolgt.

Gesucht werden insbesondere:

- Erster IT-Administrator, IT-Allrounder, Aufbau einer IT-Abteilung oder externe IT-Betreuung.
- Aufbau, Planung, Erneuerung, Erweiterung oder Modernisierung bestehender IT; Cloud-, ERP-, CRM-, Sicherheits- und Automatisierungsprojekte.
- Ausschreibungen und ausdrückliche Dienstleistergesuche.
- Öffentlich lesbare Social-Media-Aufrufe, Unternehmensmeldungen, regionale Presse und online verfügbare Zeitungsartikel oder Anzeigen.
- Wachstum und neue Standorte als indirekte Hinweise, ausdrücklich als vermuteter Bedarf eingeordnet.

**Originalseiten pro Suchlauf** ist standardmäßig **60**, einstellbar von **12 bis 150**. Das ist das Budget für Seitenabrufe in der agentischen Signalerkennung, keine zugesagte Firmenanzahl. Nicht lesbare Seiten verbrauchen ebenfalls Abrufbudget. Zusätzliche feste Quellen und die anschließende Firmenrecherche werden separat verarbeitet. Größere Budgets benötigen mehr Zeit und KI-Aufrufe; ein Lauf hat außerdem ein Zeitbudget von ungefähr 18 Minuten.

Ein Treffer braucht eine benannte Firma, einen Standort im eingestellten Gebiet, eine überprüfte Original-URL und ein wörtliches IT-Signal aus dem gelesenen Text. Suchmaschinenbeschreibungen allein reichen nicht. Quellen ohne passenden Beleg oder verifizierbaren Standort ergeben keine Opportunity. Die Anzahl neuer Signale kann von der Anzahl neuer Firmen abweichen, weil eine bekannte Firma weitere Signale erhalten kann. **Es gibt keine garantierte Mindestmenge und keine erfundenen Ersatz-Leads.**

### Websuche ohne Firecrawl

Der mitgelieferte SearXNG-Dienst sucht im öffentlichen Web; QuoVadis lädt gefundene Originalseiten selbst. Ein Firecrawl-Key kann diese Suche und Seitenabrufe ergänzen. Ohne Key oder bei einem Firecrawl-Fehler wird die integrierte Suche beziehungsweise der direkte Seitenabruf verwendet.

Die Suche braucht Internetzugang vom Server und öffentlich erreichbare Suchmaschinen und Seiten. **Einstellungen → KI & Quellen → Websuche ohne KI testen** prüft Suchtreffer und lesbare Originalseiten. Dieser Verbindungstest prüft keine KI-Auswertung. Für den vollständigen Recherchelauf ist der API-Key des gewählten KI-Anbieters erforderlich.

## Firmendossier, Bewertung und Kontakt

**Deep Research beginnt erst nach einem belegten Signal.** Die separate Warteschlange recherchiert Firmenwebsite, Impressum, Kontakt- und Teamseiten, öffentliche Social-Media-Profile, weitere Webquellen und aktivierte MCP-Quellen. Sie wird vom Worker nach jeder Verarbeitung mit einer Pause von etwa zwei Minuten weiter abgearbeitet.

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

Für einen Promptvergleich kann der Begleiter dieselben geprüften Originalseiten oder eine konfigurierte feste Quelle mit zwei Promptvarianten auswerten. Trefferzahl, durchschnittlicher Modell-Score und Quellennachweise werden angezeigt. Das ist eine Orientierung, keine objektive Qualitätsmessung.

Der Begleiter kann Änderungen an Suchprompt, Recherche-Skills, Quellen, täglicher Startzeit, Lead-Notizen und Lead-Bewertungen sowie einen Recherchelauf vorschlagen. Jede Änderung wird erst durch **Änderung übernehmen** ausgeführt. API-Schlüssel und SMTP-Passwörter bleiben außerhalb des Chatkontexts. Chatverlauf und Promptvergleiche werden in PostgreSQL gespeichert.

### Quellcode und GitHub-PRs

Unter **Einstellungen → Verbindungen → GitHub** werden Organisation/Owner, Repository, Basis-Branch und ein GitHub-Token hinterlegt. Ein Fine-grained Personal Access Token benötigt für das Ziel-Repository **Contents: Read and write** und **Pull requests: Read and write**. Der Token wird verschlüsselt gespeichert und nicht an den Chat gesendet.

Wenn eine Quellcodeänderung gewünscht ist, schlägt der Begleiter eine konkrete Aufgabe vor. **Entwurf vorbereiten** liest geeignete Textdateien aus dem konfigurierten Repository und erzeugt einen begrenzten Code-Diff. **Diff prüfen** zeigt den vollständigen Entwurf. Erst **Draft-PR erstellen** legt einen Branch und einen GitHub Pull Request an. Der Basis-Branch darf sich zwischen Entwurf und PR nicht verändert haben; andernfalls muss ein neuer Entwurf erzeugt werden. Der PR wird nicht automatisch gemergt. Der Entwurf kann bis zu vier kleine Textdateien ändern und fügt keine neuen Paket-Abhängigkeiten hinzu. Größere Aufgaben sollten in mehrere Entwürfe aufgeteilt werden.
