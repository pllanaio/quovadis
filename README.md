# quovadis

Eigenständig betriebener IT Opportunity Radar für München, Augsburg und Landsberg am Lech. Next.js, PostgreSQL und ein interner Recherche-Worker. Kein n8n erforderlich.

## Start

1. `docker compose up --build -d`
2. `http://localhost:3000` öffnen und den ersten Administratorzugang im Browser anlegen.
3. Unter **Einstellungen** den KI-Anbieter, API-Key, Recherche-Skills, Quellen/Plugins, Zeitintervall und bei Bedarf SMTP einrichten.

Alle fachlichen Einstellungen erfolgen in der Oberfläche. PostgreSQL wird von Docker Compose bereitgestellt. Der Schlüssel zur Verschlüsselung gespeicherter Zugangsdaten wird automatisch im persistenten Docker-Volume `app_data` erzeugt. Dieses Volume muss bei Backups zusammen mit `postgres_data` gesichert werden. Der Administrator kann sein Passwort in der Oberfläche ändern. Der Port ist standardmäßig nur auf `127.0.0.1` gebunden; für Zugriff aus dem Firmennetz einen HTTPS-Reverse-Proxy mit eigener Zugriffsbeschränkung davor setzen.

## Recherche und MCP

Unter **Quellen und Plugins** können Website-URLs oder Streamable-HTTP-MCP-Server mit Tool-Name und JSON-Argumenten eingetragen und einzeln aktiviert werden. **Tools laden** liest die Tool-Liste des MCP-Servers. **Recherche jetzt starten** verarbeitet aktivierte Quellen sofort. Der interne Docker-Worker führt denselben Lauf im konfigurierten Intervall aus und beginnt 60 Sekunden nach dem Start. Quellenfehler werden protokolliert.

MCP-Tools müssen vollständige HTTP(S)-Quellen-URLs im Tool-Ergebnis liefern. Ein Tool ohne belegte URL erzeugt keine Opportunity. Website-Ergebnisse müssen die konfigurierte Seiten-URL als Nachweis nutzen. Eine bereits vorhandene Quellen-URL aktualisiert den bestehenden Eintrag. Die Skill-Auswahl begrenzt die Signalarten, nach denen das KI-Modell sucht.

OpenAI wird über die Chat-Completions-API, Claude über die Messages-API angesprochen. Modellname und Anbieter sind in der Oberfläche wählbar. Die angezeigten Modellnamen können geändert werden, wenn der eigene API-Zugang andere Modelle unterstützt. API-Schlüssel und SMTP-Passwort werden mit AES-256-GCM in PostgreSQL verschlüsselt und nach dem Speichern nicht an den Browser zurückgegeben.

SMTP kann in der Oberfläche konfiguriert und per **Testmail senden** geprüft werden. Der angegebene Empfänger ist der Testempfänger. Kontaktaktionen werden separat dokumentiert; ein Klick auf `mailto:` oder `tel:` gilt nicht als erfolgter Kontakt.

Die Demo-Unternehmen sind fiktiv. Ohne gespeicherte Opportunities zeigt die Oberfläche weiterhin die Demo an. Rechercheergebnisse sollten vor geschäftlicher Nutzung geprüft werden.

Für MCP-Server mit Bearer-Authentifizierung kann pro Quelle ein Token im Frontend hinterlegt werden. Es wird wie die anderen Secrets verschlüsselt gespeichert.

Der Worker verschickt über SMTP einmal pro Tag eine Zusammenfassung fälliger Wiedervorlagen, falls SMTP konfiguriert ist und Kontakte fällig sind. Die Frist lässt sich im Frontend festlegen. Eine Testmail kann dort direkt ausgelöst werden.
