import importlib.util
import io
import json
import pathlib
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('capacity_sampler', pathlib.Path(__file__).with_name('sample-vps-capacity.py'))
sampler = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sampler)


class DatabaseResolutionTests(unittest.TestCase):
    def test_uses_operational_database_without_defaulting_to_historical_database(self):
        with patch.object(sampler, 'run', return_value='mateos_dashboard_20261016') as run:
            self.assertEqual(sampler.resolve_database(), 'mateos_dashboard_20261016')
            self.assertIn('DATABASE_URL', run.call_args.args[0][-1])
            self.assertNotIn('password', run.call_args.args[0][-1])

    def test_invalid_or_missing_name_fails_closed(self):
        for value in ['', 'database\npassword', 'other/db', 'x;DROP DATABASE x', '-d postgres', 'a' * 64]:
            with self.subTest(value=value), patch.object(sampler, 'run', return_value=value):
                with self.assertRaises(ValueError):
                    sampler.resolve_database()

    def test_cannot_fall_back_after_backend_failure(self):
        with patch.object(sampler, 'run', side_effect=RuntimeError('backend unavailable')):
            with self.assertRaises(RuntimeError):
                sampler.resolve_database()

    def test_sampler_passes_the_resolved_name_to_psql(self):
        with patch.object(sampler, 'cpu_ticks', return_value=(100, 80)), \
             patch.object(sampler.os, 'getloadavg', return_value=(0.0, 0.0, 0.0), create=True), \
             patch('builtins.open', return_value=io.StringIO('MemTotal: 1000 kB\nMemAvailable: 800 kB\n')), \
             patch.object(sampler, 'run', side_effect=['', json.dumps({'database_name': 'mateos_dashboard_20261016'})]) as run:
            result, _ = sampler.sample((10, 8), 'mateos_dashboard_20261016')
            self.assertEqual(result['database']['database_name'], 'mateos_dashboard_20261016')
            psql_args = run.call_args.args[0]
            self.assertEqual(psql_args[psql_args.index('-d') + 1], 'mateos_dashboard_20261016')

    def test_sampler_rejects_a_different_observed_database(self):
        with patch.object(sampler, 'cpu_ticks', return_value=(100, 80)), \
             patch('builtins.open', return_value=io.StringIO('MemTotal: 1000 kB\nMemAvailable: 800 kB\n')), \
             patch.object(sampler, 'run', side_effect=['', json.dumps({'database_name': 'mateos'})]):
            with self.assertRaisesRegex(ValueError, 'differs'):
                sampler.sample((10, 8), 'mateos_dashboard_20261016')


if __name__ == '__main__':
    unittest.main()
