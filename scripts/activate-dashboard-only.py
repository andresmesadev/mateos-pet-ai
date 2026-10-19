#!/usr/bin/env python3
"""Cut over to a separately prepared clean DB, keeping the source for rollback.
No schema/history deletion, WhatsApp requests, credential output, or new code deploy.
"""
import argparse
import json
import os
import re
import subprocess
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

REPO = Path('/home/ubuntu/mateos-pet-ai')
SOURCE = 'mateos'


def dashboard_env(text, target):
    """Preserve auth/business settings; only change DB path and disable Meta."""
    if not re.fullmatch(r'mateos(?:_dashboard_[0-9]{8}(?:_[0-9]{6})?)?', target):
        raise ValueError('Invalid destination')
    disabled = {'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID',
                'WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN', 'OPERATOR_WHATSAPP_ENABLED'}
    lines, found = [], 0
    for line in text.splitlines():
        match = re.match(r'^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=(.*)$', line)
        if match and match[1] in disabled:
            continue
        if match and match[1] == 'DATABASE_URL':
            found += 1
            raw = match[2].strip()
            quote = raw[0] if raw and raw[0] in "\"'" else ''
            if quote:
                if not raw.endswith(quote):
                    raise ValueError('Invalid database value')
                raw = raw[1:-1]
            url = urlsplit(raw)
            if url.scheme not in ('postgres', 'postgresql') or url.hostname != 'db' or url.path != '/' + SOURCE:
                raise ValueError('Unexpected source connection')
            value = urlunsplit(url._replace(path='/' + target))
            line = 'DATABASE_URL=' + quote + value + quote
        lines.append(line)
    if found != 1:
        raise ValueError('Expected one database connection')
    lines.extend(k + ('=false' if k == 'OPERATOR_WHATSAPP_ENABLED' else '=') for k in sorted(disabled))
    return '\n'.join(lines) + '\n'


def dashboard_nginx(text):
    marker = '    server_name bot.nexoweb.co;'
    first_server = text.split('\nserver {', 1)[0]
    block = '''
    # Mateos dashboard-only: no Meta ingress during clean start.
    location ~* ^/(api/)?webhook(/|$) {
        add_header Retry-After 86400 always;
        return 503;
    }
'''
    if text.count(marker) not in (1, 2) or 'listen 443 ssl;' not in first_server:
        raise ValueError('Unexpected Nginx site')
    if '# Mateos dashboard-only' in text:
        if text.count(block) == 1 and text.count('# Mateos dashboard-only') == 1:
            return text
        raise ValueError('Unexpected existing channel gate')
    return text.replace(marker, marker + '\n' + block, 1)


def private_write(path, text):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w', encoding='utf8') as handle:
        handle.write(text)
        handle.flush()
        os.fsync(handle.fileno())


def activate(target, apply=False):
    os.umask(0o077)
    env_path = REPO / 'backend/.env'
    if env_path.is_symlink():
        raise ValueError('Environment must not be a link')
    site = Path('/etc/nginx/sites-enabled/bot.nexoweb.co').resolve(strict=True)
    if site != Path('/etc/nginx/sites-available/bot.nexoweb.co'):
        raise ValueError('Unexpected site destination')
    original_env = env_path.read_text()
    next_env = dashboard_env(original_env, target)
    original_site = site.read_text()
    next_site = dashboard_nginx(original_site)
    if not apply:
        print(json.dumps({'plan': True, 'source': SOURCE, 'destination': target,
                          'preserve': 'establishment/config/admin; source archive',
                          'exclude': 'operational history/services/staff/sample credentials',
                          'whatsapp': 'blocked ingress; no active token/channel/reminder employee'}))
        return
    # Explicit, bounded destinations. Never put secret values in argv or output.
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    recovery = Path('/home/ubuntu/mateos-beta-ops-20261016') / ('private-cutover-' + stamp)
    recovery.mkdir(mode=0o700)
    private_write(recovery / 'backend.env.before', original_env)
    private_write(recovery / 'nginx.before', original_site)
    private_write(recovery / 'nginx.dashboard-only', next_site)
    compose = ['docker', 'compose']
    def run(args, capture=False):
        with (recovery / 'operation.log').open('a') as log:
            result = subprocess.run(args, cwd=REPO, stdout=subprocess.PIPE if capture else log,
                                    stderr=log, text=True, check=True)
        return result.stdout.strip() if capture else None
    def replace_env(contents):
        temporary = env_path.with_name('.env.dashboard-cutover-' + stamp)
        private_write(temporary, contents)
        os.replace(temporary, env_path)
    # Verify the destination before any interruption or configuration change.
    check = run(compose + ['exec', '-T', 'db', 'psql', '-U', 'mateos', '-d', target, '-Atc',
        'SELECT (SELECT count(*) FROM "Tenant") = 1 AND '
        '(SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) = 52 AND '
        '(SELECT count(*) FROM "Appointment") = 0 AND (SELECT count(*) FROM "User") = 0 AND '
        '(SELECT count(*) FROM "Staff") = 0 AND (SELECT count(*) FROM "Service") = 0 AND '
        '(SELECT count(*) FROM "Channel") = 0;'], capture=True)
    if check != 't':
        raise ValueError('Destination is not the prepared clean database')
    run(['sudo', 'install', '-m', '644', str(recovery / 'nginx.dashboard-only'), str(site)])
    try:
        run(['sudo', 'nginx', '-t'])
    except Exception:
        run(['sudo', 'install', '-m', '644', str(recovery / 'nginx.before'), str(site)])
        raise
    run(['sudo', 'systemctl', 'reload', 'nginx'])
    stopped = False
    try:
        run(['sudo', 'systemctl', 'stop', 'mateos-pet-ai-stability.service'])
        # The backup obtains its connection from the running source backend.
        # Ingress is already blocked; complete backup BEFORE stopping it.
        run(['sudo', 'systemctl', 'start', 'mateos-pet-ai-backup.service'])
        run(compose + ['stop', 'backend'])
        stopped = True
        replace_env(next_env)
        run(compose + ['up', '-d', '--no-deps', '--force-recreate', 'backend'])
        healthy = False
        for _ in range(24):
            try:
                with urllib.request.urlopen('http://127.0.0.1:3000/api/health', timeout=3) as response:
                    health = json.load(response)
                healthy = (health.get('status') == 'ok' and health.get('version') == '2.48.0'
                           and health.get('services', {}).get('database') == 'ok'
                           and health.get('workers', {}).get('inbound', {}).get('healthy') is True)
                if healthy:
                    break
            except Exception:
                pass
            time.sleep(2)
        if not healthy:
            raise RuntimeError('Clean database health check failed')
        run(compose + ['exec', '-T', 'db', 'psql', '-U', 'mateos', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c',
                       'ALTER DATABASE mateos SET default_transaction_read_only = on;'])
        print(json.dumps({'state': 'dashboard_only', 'database': target, 'sourceArchivedReadOnly': True,
                          'health': 'ok', 'version': '2.48.0', 'recoveryDirectory': str(recovery)}))
    except Exception:
        if stopped:
            # Revert the DB connection if startup fails, keeping WhatsApp OFF.
            run(compose + ['exec', '-T', 'db', 'psql', '-U', 'mateos', '-d', 'postgres', '-c',
                           'ALTER DATABASE mateos RESET default_transaction_read_only;'])
            replace_env(dashboard_env(original_env, SOURCE))
            run(compose + ['up', '-d', '--no-deps', '--force-recreate', 'backend'])
        raise


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('target')
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if not re.fullmatch(r'mateos_dashboard_[0-9]{8}(?:_[0-9]{6})?', args.target):
        parser.error('Use the separately prepared mateos_dashboard_YYYYMMDD database')
    try:
        activate(args.target, args.apply)
    except Exception:
        print('Cutover stopped; inspect its private recovery log. No history was deleted.')
        raise SystemExit(1)
