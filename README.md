# quovadis

Eigenständig betriebener IT Opportunity Radar für München, Augsburg und Landsberg am Lech. Next.js, PostgreSQL und ein interner Recherche-Worker. Kein n8n erforderlich.

## Start

1. `docker compose up --build -d`
2. `http://localhost:3000` öffnen und den ersten Administratorzugang im Browser anlegen.
3. Unter **Einstellungen** den KI-Anbieter und API-Key speichern; ein Firecrawl API-Key ist optional. Suchauftrag, Recherche-Skills, optionale MCP-Tools und SMTP werden ebenfalls dort eingerichtet.

Alle fachlichen Einstellungen erfolgen in der Oberfläche. PostgreSQL wird von Docker Compose bereitgestellt. Der Schlüssel zur Verschlüsselung gespeicherter Zugangsdaten wird automatisch im persistenten Docker-Volume `app_data` erzeugt. Dieses Volume muss bei Backups zusammen mit `postgres_data` gesichert werden. Der Administrator kann sein Passwort in der Oberfläche ändern. Der Port ist standardmäßig nur auf `127.0.0.1` gebunden; für Zugriff aus dem Firmennetz einen HTTPS-Reverse-Proxy mit eigener Zugriffsbeschränkung davor setzen.

## Täglicher Discovery-Agent und MCP

Der Worker startet die agentische Suche rund eine Minute nach dem Start und danach einmal pro Tag. Der Agent plant vier regionale Suchanfragen mit dem editierbaren QUOVADIS-Auftrag, wertet Suchtreffer aus und formuliert bis zu zwei gezielte Anschlussfragen. Der mitgelieferte SearXNG-Dienst sucht im öffentlichen Web. QuoVadis lädt die gefundenen Originalseiten selbst und übernimmt nur Signale mit benannter Firma, Standort, Original-URL und wörtlichem IT-Beleg aus der Seite. Die Anzahl geprüfter Seiten pro Lauf ist in der Oberfläche begrenzt und einstellbar. Ein Firecrawl-Key kann optional hinterlegt werden; bei fehlendem Key oder Firecrawl-Fehler nutzt QuoVadis die lokale Suche und liest Seiten direkt. Die lokale Suche braucht Internetzugang vom Server und hängt von öffentlich erreichbaren Suchmaschinen und Seiten ab. **Signalerkennung jetzt starten** löst einen zusätzlichen Lauf aus.

Gefundene Firmen werden zusammengeführt, einzelne Signale und Änderungen bleiben separat gespeichert. Bekannte Belege werden nach ungefähr 23 Stunden erneut geprüft; der Worker arbeitet jeweils einige fällige Belege alle zwei Minuten ab. Eine nicht abrufbare Seite wird als derzeit nicht auffindbar markiert, nicht als besetzte Stelle. Priorität C bleibt als vermuteter Bedarf gekennzeichnet. Eine IT-Stellenanzeige belegt keine Bereitschaft zur externen Vergabe. Der Score hat die Gewichte 35/25/15/15/10. Stundensatz und Potenzial für einen monatlichen Vertrag sind Schätzungen.

Erst nach dem Signal führt die separate Vertiefungswarteschlange weitere Web- und Firmenrecherche aus. Sie läuft alle zwei Minuten. Der Detailbereich zeigt Originalbelege, Prüfdatum, Signalverlauf, Zusatzquellen, Fakten mit Zitaten, Gesprächsansatz und Bewertung. Die Qualität hängt von den verfügbaren öffentlichen Quellen und vom KI-Zugang ab; geschützte Portale und lizenzierte Datenbanken werden nicht umgangen.

Unter **Quellen und Plugins** können zusätzlich feste Quellen einem Zweck zugeordnet werden:

1. **Signal erkennen:** QuoVadis liest konfigurierte Websites oder MCP-Tools und sucht nach konkreten, aktuellen Anlässen für IT-Dienstleistungen, etwa IT-Stellenanzeigen, Projektausschreibungen, angekündigte Migrationen oder eine ausdrückliche Dienstleistersuche. Ein Treffer benötigt eine benannte Firma, eine Quellen-URL und ein wörtliches Zitat aus dem gelieferten Quellentext. Nur aktivierte Signalarten werden berücksichtigt. Ein Treffer wird zunächst als **Signal erkannt** gespeichert.
2. **Firma vertiefen:** Erst für einen solchen Treffer startet Deep Research. QuoVadis liest eine aus dem Signal belegte Firmenwebsite mit relevanten Unterseiten sowie aktivierte MCP-Vertiefungsquellen. MCP-Argumente können die Platzhalter `{{company_name}}`, `{{city}}`, `{{signal}}`, `{{company_url}}` und `{{source_url}}` enthalten. Zusätzliche Befunde brauchen eine genaue URL und ein überprüfbares Zitat. Öffentliche `mailto:`- und `tel:`-Angaben der Firmenwebsite werden mit ihrer Fundstelle gespeichert. Fehlt eine weitere belastbare Quelle, bleibt der Treffer sichtbar mit Status **Weitere Quellen benötigt**.

Bei deaktivierter agentischer Websuche gilt das manuell eingestellte Intervall für feste Quellen. Bestandsdaten ohne Signalzitat bleiben als Altbestand gekennzeichnet und gehen nicht nachträglich in die Deep-Research-Warteschlange.

MCP-Tools müssen vollständige HTTP(S)-Quellen-URLs im Tool-Ergebnis liefern. Website-Signale referenzieren die konfigurierte URL. Die Quellenliste ist im Frontend konfigurierbar; die Einbindung öffentlicher Portale setzt passende URLs, Feeds oder MCP-Tools voraus.

OpenAI wird über die Chat-Completions-API, Claude über die Messages-API angesprochen. Modellname und Anbieter sind in der Oberfläche wählbar. Die angezeigten Modellnamen können geändert werden, wenn der eigene API-Zugang andere Modelle unterstützt. API-Schlüssel und SMTP-Passwort werden mit AES-256-GCM in PostgreSQL verschlüsselt und nach dem Speichern nicht an den Browser zurückgegeben.

SMTP kann in der Oberfläche konfiguriert und per **Testmail senden** geprüft werden. Der angegebene Empfänger ist der Testempfänger. Kontaktaktionen werden separat dokumentiert; ein Klick auf `mailto:` oder `tel:` gilt nicht als erfolgter Kontakt.

Die Demo-Unternehmen sind fiktiv. Ohne gespeicherte Opportunities zeigt die Oberfläche weiterhin die Demo an. Rechercheergebnisse sollten vor geschäftlicher Nutzung geprüft werden.

Für den Ausbau der Recherche gibt es einen [Katalog öffentlicher Quellen](docs/quellenkatalog.md) und eine [REA-Analyse der öffentlich sichtbaren OpenProspect-Abläufe](docs/openprospect-analyse.md). Der Katalog ist eine Recherchegrundlage; die genannten Portale sind über die Websuche auffindbar, soweit deren Seiten öffentlich zugänglich und indexierbar sind. Deep Research ergänzt Treffer mit Firmenwebsite, Websuche und konfigurierten MCP-Quellen.

Für MCP-Server mit Bearer-Authentifizierung kann pro Quelle ein Token im Frontend hinterlegt werden. Es wird wie die anderen Secrets verschlüsselt gespeichert.

Der Worker verschickt über SMTP einmal pro Tag eine Zusammenfassung fälliger Wiedervorlagen, falls SMTP konfiguriert ist und Kontakte fällig sind. Die Frist lässt sich im Frontend festlegen. Eine Testmail kann dort direkt ausgelöst werden.

## KI-Begleiter

Über **KI-Begleiter** kann man direkt im Tool mit dem konfigurierten OpenAI- oder Claude-Modell schreiben. Der Chat kennt den aktuellen Suchprompt, aktivierte Skills und Quellen sowie den ausgewählten Lead. Er kann Suchprompts formulieren, Leads einordnen und E-Mail-Texte entwerfen. Er versendet aus dem Chat keine E-Mails.

Für einen Promptvergleich kann der Begleiter dieselben geprüften Originalseiten oder eine konfigurierte feste Quelle mit zwei Promptvarianten auswerten. Trefferzahl, durchschnittlicher Modell-Score und Quellennachweise werden angezeigt; das ist eine Orientierung, keine objektive Qualitätsmessung. Vergleiche sollten mit mehreren Quellen und menschlicher Prüfung wiederholt werden.

Der Begleiter kann Änderungen an Suchprompt, Recherche-Skills, Quellen, Zeitplan, Lead-Notizen und Lead-Bewertungen sowie einen Recherchelauf vorschlagen. Jede Änderung wird erst durch **Änderung übernehmen** ausgeführt. API-Schlüssel und SMTP-Passwörter bleiben außerhalb des Chatkontexts. Der Chatverlauf und Promptvergleiche werden in PostgreSQL gespeichert.

### Quellcode und GitHub-PRs

Unter **Einstellungen → GitHub** werden Organisation/Owner, Repository, Basis-Branch und ein GitHub-Token hinterlegt. Ein Fine-grained Personal Access Token benötigt für das Ziel-Repository **Contents: Read and write** und **Pull requests: Read and write**. Der Token wird verschlüsselt gespeichert und nicht an den Chat gesendet.

Wenn eine Quellcodeänderung gewünscht ist, schlägt der Begleiter eine konkrete Aufgabe vor. **Entwurf vorbereiten** liest geeignete Textdateien aus dem konfigurierten Repository und erzeugt einen begrenzten Code-Diff. **Diff prüfen** zeigt den vollständigen Entwurf. Erst **Draft-PR erstellen** legt einen Branch und einen GitHub Pull Request an. Der Basis-Branch darf sich zwischen Entwurf und PR nicht verändert haben; andernfalls muss ein neuer Entwurf erzeugt werden. Der PR wird nicht automatisch gemergt. Der Entwurf kann bis zu vier kleine Textdateien ändern und fügt keine neuen Paket-Abhängigkeiten hinzu. Größere Aufgaben sollten in mehrere Entwürfe aufgeteilt werden.
