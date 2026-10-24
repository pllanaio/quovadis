"""Private, authenticated, read-only Agent Reach adapter. No arbitrary commands or login."""
import hmac
import json
import os
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

REVISION = 'beabda7486e9a666360b18cdb5c0e759c2c4d20f'
DOMAINS = ('instagram.com', 'facebook.com', 'tiktok.com', 'linkedin.com', 'xing.com',
           'x.com', 'twitter.com', 'youtube.com', 'pinterest.com')


def social_url(value):
    if not isinstance(value, str) or len(value) > 2000:
        raise ValueError('Ungültige Profiladresse.')
    url = urlsplit(value)
    host = (url.hostname or '').lower()
    if (url.scheme != 'https' or url.username or url.password or url.port not in (None, 443)
            or not any(host == domain or host.endswith('.' + domain) for domain in DOMAINS)
            or '\\' in value or any(ord(char) < 33 for char in value)):
        raise ValueError('Nur öffentliche HTTPS-Social-Media-Adressen sind erlaubt.')
    return value


def execute(input):
    if input.get('action') == 'status':
        return {'installed': True, 'version': '1.6.0', 'revision': REVISION,
                'mode': 'public', 'skillInstalled': Path('/opt/quovadis/skills/agent-reach/SKILL.md').is_file(),
                'notice': 'Öffentliche Inhalte ohne Login; keine Garantie für vollständige Beiträge oder Kommentare.'}
    if input.get('action') != 'read':
        raise ValueError('Nur Lesen und Status sind erlaubt.')
    url = social_url(input.get('url'))
    # Explicit web backend: never auto-install browser tools or request credentials.
    # Jina/Exa native auto-fallback is intentionally disabled on access restrictions.
    result = subprocess.run(['agent-reach', 'web', 'read', url, '--backend', 'jina', '--timeout', '25'],
                            capture_output=True, text=True, timeout=35, check=False)
    if len(result.stdout) > 2_000_000:
        raise ValueError('Antwort überschreitet das Leselimit.')
    try:
        data = json.loads(result.stdout)
    except ValueError:
        raise ValueError('Agent-Reach lieferte keine verwertbare Antwort.') from None
    if not isinstance(data, dict) or 'ok' not in data:
        raise ValueError('Ungültige Agent-Reach-Antwort.')
    # Do not expose process output, environment, internal paths or raw upstream metadata.
    return {'ok': data['ok'], 'backend': data.get('backend'), 'error': data.get('error'),
            'items': [{'url': item.get('url'), 'text': str(item.get('text') or '')[:60000],
                       'title': item.get('title'), 'published_at': item.get('published_at')}
                      for item in data.get('items', [])[:5]], 'meta': {'access': 'public', 'complete': False}}


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            key = Path(os.environ.get('WORKER_KEY_FILE', '/app/data/worker.key')).read_text()
            if not hmac.compare_digest(self.headers.get('x-worker-key', ''), key):
                self.respond(401, {'error': 'Nicht autorisiert.'})
                return
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 8192:
                raise ValueError('Ungültige Anfragegröße.')
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                raise ValueError('JSON-Objekt erforderlich.')
            self.respond(200, execute(data))
        except subprocess.TimeoutExpired:
            self.respond(200, {'ok': False, 'error': {'code': 'TIMEOUT', 'message': 'Öffentlicher Lesezugriff hat das Zeitlimit erreicht.'}, 'items': []})
        except ValueError as error:
            self.respond(400, {'error': str(error)})
        except Exception:
            self.respond(503, {'error': 'Agent-Reach-Dienst derzeit nicht verfügbar.'})

    def respond(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_):
        pass  # URLs and headers are not written to access logs.


if __name__ == '__main__':
    ThreadingHTTPServer(('0.0.0.0', 3012), Handler).serve_forever()
