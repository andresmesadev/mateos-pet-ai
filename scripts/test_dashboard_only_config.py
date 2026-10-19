"""Pure configuration guards; never reads credentials or contacts production."""
import importlib.util
import unittest
from pathlib import Path
from urllib.parse import urlsplit

spec = importlib.util.spec_from_file_location('dashboard_only', Path(__file__).with_name('activate-dashboard-only.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class DashboardOnlyConfigTests(unittest.TestCase):
    def test_changes_only_database_and_meta_settings(self):
        original = 'DATABASE_URL="postgresql://mateos:test%40password@db:5432/mateos?schema=public"\nADMIN_PASSWORD=FAKE_KEEP\nINTERNAL_API_SECRET=FAKE_KEEP_TOO\nWHATSAPP_ACCESS_TOKEN=FAKE_REMOVE\nOPERATOR_WHATSAPP_ENABLED=true\n'
        result = module.dashboard_env(original, 'mateos_dashboard_20261016')
        self.assertIn('postgresql://mateos:test%40password@db:5432/mateos_dashboard_20261016?schema=public', result)
        self.assertIn('ADMIN_PASSWORD=FAKE_KEEP\n', result)
        self.assertIn('INTERNAL_API_SECRET=FAKE_KEEP_TOO\n', result)
        self.assertNotIn('FAKE_REMOVE', result)
        self.assertIn('OPERATOR_WHATSAPP_ENABLED=false\n', result)
        self.assertIn('WHATSAPP_APP_SECRET=\n', result)

    def test_rejects_missing_duplicate_remote_or_unexpected_source(self):
        for value in ['', 'DATABASE_URL=postgres://u:p@db/mateos\nDATABASE_URL=postgres://u:p@db/mateos',
                      'DATABASE_URL=postgres://u:p@remote/mateos', 'DATABASE_URL=postgres://u:p@db/another']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                module.dashboard_env(value, 'mateos_dashboard_20261016')

    def test_rejects_destination_injection(self):
        for value in ['../mateos', 'mateos;DROP DATABASE mateos', 'different', 'mateos_dashboard_20261016/another']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                module.dashboard_env('DATABASE_URL=postgres://u:p@db/mateos', value)

    def test_rollback_keeps_whatsapp_disabled(self):
        result = module.dashboard_env('DATABASE_URL=postgres://u:p@db/mateos\nWHATSAPP_ACCESS_TOKEN=FAKE_REMOVE', 'mateos')
        self.assertIn('DATABASE_URL=postgres://u:p@db/mateos\n', result)
        self.assertIn('WHATSAPP_ACCESS_TOKEN=\n', result)
        self.assertNotIn('FAKE_REMOVE', result)

    def test_pauses_both_webhook_paths_without_changing_dashboard_proxy(self):
        original = 'server {\n    server_name bot.nexoweb.co;\n    location / { proxy_pass http://localhost:3000; }\n    listen 443 ssl;\n}\nserver {\n    listen 80;\n    server_name bot.nexoweb.co;\n    return 404;\n}'
        result = module.dashboard_nginx(original)
        self.assertIn('location ~* ^/(api/)?webhook(/|$)', result)
        self.assertIn('return 503;', result)
        self.assertIn('location / { proxy_pass http://localhost:3000; }', result)
        self.assertEqual(result.count('# Mateos dashboard-only'), 1)
        self.assertTrue(result.endswith('return 404;\n}'))
        self.assertEqual(module.dashboard_nginx(result), result)
        with self.assertRaises(ValueError):
            module.dashboard_nginx(result.replace('return 503;', 'return 200;'))

    def test_refuses_ambiguous_nginx_site(self):
        for value in ['', '    server_name other;','    server_name bot.nexoweb.co;\n    server_name bot.nexoweb.co;']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                module.dashboard_nginx(value)


if __name__ == '__main__':
    unittest.main(verbosity=2)
