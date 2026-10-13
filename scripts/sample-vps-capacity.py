#!/usr/bin/env python3
"""Read-only, bounded VPS observations. Run from the deployed repository."""
import argparse
import datetime
import json
import os
import shutil
import subprocess
import time

SQL = """
SELECT jsonb_build_object(
 'database_bytes',pg_database_size(current_database()),
 'max_connections',current_setting('max_connections')::int,
 'client_connections',(select count(*) from pg_stat_activity where backend_type='client backend'),
 'active_clients',(select count(*) from pg_stat_activity where backend_type='client backend' and state='active'),
 'lock_waiters',(select count(*) from pg_stat_activity where wait_event_type='Lock'),
 'long_transactions',(select count(*) from pg_stat_activity where xact_start<now()-interval '60 seconds'),
 'temp_bytes',(select temp_bytes from pg_stat_database where datname=current_database()),
 'deadlocks',(select deadlocks from pg_stat_database where datname=current_database()),
 'blocked_jobs',(select count(*) from "InboundJob" where provider='whatsapp' and status in ('received','claimed')),
 'review_jobs',(select count(*) from "InboundJob" where status='needs_review'),
 'expired_leases',(select count(*) from "InboundJob" where status='claimed' and "leaseExpiresAt"<now()),
 'oldest_pending_seconds',(select coalesce(extract(epoch from now()-min("createdAt")),0) from "InboundJob" where provider='whatsapp' and status in ('received','claimed'))
);
"""


def run(args, timeout=8, text=None):
    return subprocess.check_output(args, input=text, text=True, timeout=timeout).strip()


def cpu_ticks():
    values = list(map(int, open('/proc/stat', encoding='utf8').readline().split()[1:]))
    return sum(values[:8]), values[3] + values[4]


def sample(previous_ticks):
    memory = {}
    with open('/proc/meminfo', encoding='utf8') as source:
        for line in source:
            key, value = line.split(':', 1)
            memory[key] = int(value.split()[0]) * 1024
    current = cpu_ticks()
    total, idle = current[0] - previous_ticks[0], current[1] - previous_ticks[1]
    raw = run(['docker', 'stats', '--no-stream', '--format', '{{json .}}'])
    containers = []
    for line in raw.splitlines():
        entry = json.loads(line)
        if not entry['Name'].startswith('mateos-pet-ai-'):
            continue
        state = json.loads(run(['docker', 'inspect', '--format',
                                '{{json .State}}', entry['ID']]))
        restarts = int(run(['docker', 'inspect', '--format', '{{.RestartCount}}', entry['ID']]))
        containers.append({'name': entry['Name'], 'cpu_percent': float(entry['CPUPerc'].rstrip('%')),
                           'memory': entry['MemUsage'], 'memory_percent': float(entry['MemPerc'].rstrip('%')),
                           'pids': int(entry['PIDs']), 'oom_killed': state['OOMKilled'],
                           'started_at': state['StartedAt'], 'restarts': restarts})
    db = json.loads(run(['docker', 'compose', 'exec', '-T', '-e',
                         'PGOPTIONS=-c statement_timeout=2000 -c lock_timeout=500',
                         'db', 'psql', '-X', '-U', 'mateos', '-d', 'mateos', '-At',
                         '-v', 'ON_ERROR_STOP=1'], text=SQL))
    result = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'cpu_count': os.cpu_count(), 'cpu_busy_percent': 100 * (total-idle)/total if total else 0,
              'load_average': os.getloadavg(), 'memory_total': memory['MemTotal'],
              'memory_available': memory['MemAvailable'], 'disk': shutil.disk_usage('/')._asdict(),
              'containers': containers, 'database': db}
    return result, current


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--samples', type=int, default=41)
    parser.add_argument('--interval-seconds', type=int, default=15)
    args = parser.parse_args()
    if not 2 <= args.samples <= 81 or not 10 <= args.interval_seconds <= 60:
        parser.error('Bounded observation: 2..81 samples, interval 10..60 seconds')
    previous = cpu_ticks()
    start = time.monotonic()
    for index in range(args.samples):
        if index:
            time.sleep(max(0, start + index * args.interval_seconds - time.monotonic()))
        result, previous = sample(previous)
        print(json.dumps(result, separators=(',', ':')), flush=True)


if __name__ == '__main__':
    main()
