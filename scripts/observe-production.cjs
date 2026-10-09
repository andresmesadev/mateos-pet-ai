#!/usr/bin/env node
// Read-only observations; neither a load test nor a WhatsApp delivery certificate.
const fs = require('node:fs/promises');
const path = require('node:path');
const { setTimeout: sleep } = require('node:timers/promises');
const REPO = path.resolve(__dirname, '..');
const OUTPUT = path.join(REPO, '.cache', 'stability');
const URL = 'https://bot.nexoweb.co/api/health';

async function sample(fetcher = fetch, clock = Date.now) {
  const start = clock();
  const result = { at: new Date(start).toISOString(), ok: false };
  try {
    const response = await fetcher(URL, { signal: AbortSignal.timeout(25000), redirect: 'error' });
    const payload = await response.json();
    const worker = payload?.workers?.inbound;
    Object.assign(result, {
      http: response.status, latencyMs: clock() - start,
      version: typeof payload?.version === 'string' ? payload.version.slice(0, 40) : null,
      status: payload?.status === 'ok' ? 'ok' : 'degraded',
      database: payload?.services?.database === 'ok' ? 'ok' : 'error',
      openai: payload?.services?.openai === 'ok' ? 'ok' : 'error',
      worker: ['ok', 'starting', 'error', 'stale', 'stalled', 'not_started'].includes(worker?.status) ? worker.status : 'unknown',
      consecutiveFailures: Number.isSafeInteger(worker?.consecutiveFailures) ? worker.consecutiveFailures : null,
      workerStartedAt: validTime(worker?.startedAt),
      lastSuccessAt: validTime(worker?.lastSuccessAt),
      lastFailureAt: validTime(worker?.lastFailureAt),
    });
    result.ok = response.status === 200 && result.status === 'ok' && result.database === 'ok' &&
      result.openai === 'ok' && result.worker === 'ok' && worker?.healthy === true &&
      result.consecutiveFailures === 0 && result.lastSuccessAt !== null && result.workerStartedAt !== null && result.version !== null;
  } catch {
    // No response body, error detail, credentials or client identifiers are stored.
    result.error = 'health_request_failed'; result.latencyMs = clock() - start;
  }
  return result;
}

function validTime(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
}

function summarize(samples, { hours = 48, intervalSeconds = 300 } = {}) {
  if (!Number.isFinite(hours) || hours <= 0 || !Number.isFinite(intervalSeconds) || intervalSeconds <= 0) throw new Error('Invalid observation duration');
  if (!samples.length) return { verdict: 'incomplete', samples: 0, coverageHours: 0 };
  const times = samples.map(s => Date.parse(s.at));
  if (times.some((t, i) => !Number.isFinite(t) || (i > 0 && t <= times[i - 1]))) throw new Error('Observations must have increasing timestamps');
  const coverageHours = (times.at(-1) - times[0]) / 3600000;
  const gaps = times.slice(1).filter((t, i) => t - times[i] > intervalSeconds * 1000 + 30000).length;
  const failedSamples = samples.filter(s => s.ok !== true).length;
  const versions = new Set(samples.map(s => s.version).filter(Boolean));
  const restarts = new Set(samples.map(s => s.workerStartedAt).filter(Boolean)).size > 1;
  const recordedWorkerFailure = samples.some(s => s.lastFailureAt && Date.parse(s.lastFailureAt) >= times[0]);
  const complete = coverageHours >= hours && gaps === 0;
  const healthy = failedSamples === 0 && versions.size === 1 && !restarts && !recordedWorkerFailure;
  return { verdict: !healthy ? 'incident' : complete ? 'health_window_passed' : 'incomplete',
    samples: samples.length, startedAt: samples[0].at, endedAt: samples.at(-1).at, coverageHours,
    requiredHours: hours, gaps, failedSamples, versions: [...versions], restarts, recordedWorkerFailure,
    limits: 'Public health samples only; queue, delivery, logs and pilot load must be checked separately.' };
}

async function safeOutput(file, create) {
  const absolute = path.resolve(file), relative = path.relative(OUTPUT, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !absolute.endsWith('.jsonl')) throw new Error('Output must be a .jsonl file inside .cache/stability');
  let directory = REPO;
  for (const part of path.relative(REPO, path.dirname(absolute)).split(path.sep)) {
    directory = path.join(directory, part);
    if (create) await fs.mkdir(directory, { mode: 0o700 }).catch(e => { if (e.code !== 'EEXIST') throw e; });
    const stat = await fs.lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Observation directory must not contain links');
  }
  if (!create) {
    const stat = await fs.lstat(absolute);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16 * 1024 ** 2) throw new Error('Invalid observation file');
  }
  return absolute;
}

async function observe(file, settings) {
  file = await safeOutput(file, true);
  const handle = await fs.open(file, 'wx', 0o600), samples = [];
  let stopped = false;
  const waiting = new AbortController();
  const stop = () => { stopped = true; waiting.abort(); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try {
    const first = await sample(); samples.push(first);
    await handle.write(JSON.stringify(first) + '\n'); await handle.sync();
    const end = Date.parse(first.at) + settings.hours * 3600000;
    while (!stopped && Date.parse(samples.at(-1).at) < end) {
      const next = Math.min(Date.parse(samples.at(-1).at) + settings.intervalSeconds * 1000, end);
      try { await sleep(Math.max(0, next - Date.now()), undefined, { signal: waiting.signal }); }
      catch (error) { if (stopped) break; throw error; }
      if (stopped) break;
      const point = await sample(); samples.push(point);
      await handle.write(JSON.stringify(point) + '\n'); await handle.sync();
      console.log(JSON.stringify({ at: point.at, ok: point.ok, samples: samples.length }));
    }
    return summarize(samples, settings);
  } finally {
    await handle.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
  }
}

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--sample') {
      const point = await sample(); console.log(JSON.stringify(point)); process.exitCode = point.ok ? 0 : 1; return;
    }
    const settings = { hours: 48, intervalSeconds: 300 };
    let file, read = false;
    const keys = { '--hours': 'hours', '--interval-seconds': 'intervalSeconds' };
    for (let i = 0; i < args.length; i++) {
      const arg = args[i], value = args[++i];
      if (!value) throw new Error('Missing observation argument');
      if (keys[arg]) settings[keys[arg]] = Number(value);
      else if (arg === '--output' || arg === '--summarize') { if (file) throw new Error('Specify one observation file'); file = value; read = arg === '--summarize'; }
      else throw new Error('Unknown observation option');
    }
    if (!file || !Number.isFinite(settings.hours) || settings.hours < 1 || settings.hours > 72 ||
        !Number.isFinite(settings.intervalSeconds) || settings.intervalSeconds < 60 || settings.intervalSeconds > 900) {
      throw new Error('Use --sample, or --output/--summarize FILE with --hours 1..72 and --interval-seconds 60..900');
    }
    let summary;
    if (read) {
      const text = await fs.readFile(await safeOutput(file, false), 'utf8');
      summary = summarize(text.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)), settings);
    } else summary = await observe(file, settings);
    console.log(JSON.stringify(summary));
    // This certifies the requested health window only, never the entire beta plan.
    process.exitCode = summary.verdict === 'health_window_passed' ? 0 : 1;
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { sample, summarize, safeOutput };
