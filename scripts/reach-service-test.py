import importlib.util
import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('reach_service', 'agent-reach-service/server.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ReachServiceTests(unittest.TestCase):
    def test_restricted_urls(self):
        for url in ['http://instagram.com/a', 'https://instagram.com.evil.org/a',
                    'https://localhost/a', 'https://127.0.0.1/a', 'https://instagram.com:8443/a',
                    'https://user:secret@instagram.com/a', 'https://instagram.com/\\evil']:
            with self.assertRaises(ValueError):
                module.social_url(url)
        self.assertEqual(module.social_url('https://www.instagram.com/acme/'), 'https://www.instagram.com/acme/')

    def test_no_arbitrary_commands(self):
        for action in ['login', 'setup', 'update', 'exec', 'scrape']:
            with self.assertRaises(ValueError):
                module.execute({'action': action})

    def test_actual_cli_boundary(self):
        with patch.object(module.subprocess, 'run', return_value=SimpleNamespace(stdout=json.dumps({
            'ok': True, 'backend': 'jina', 'items': [{'url': 'https://x.com/acme', 'text': 'Original content',
                                                       'raw': {'must': 'not leak'}}]}))) as run:
            result = module.execute({'action': 'read', 'url': 'https://x.com/acme'})
        args = run.call_args.args[0]
        self.assertEqual(args, ['agent-reach', 'web', 'read', 'https://x.com/acme', '--backend', 'jina', '--timeout', '25'])
        self.assertFalse(run.call_args.kwargs.get('shell', False))
        self.assertNotIn('raw', result['items'][0])
        self.assertFalse(result['meta']['complete'])


if __name__ == '__main__':
    unittest.main()
