#!/usr/bin/env node
// Copies only the existing encrypted backup. No dump, decryption or production writes.
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createReadStream, createWriteStream } = require('node:fs');
const { createHash } = require('node:crypto');
const { pipeline } = require('node:stream/promises');

const REPO = path.resolve(__dirname, '..');
const ROOT = '/var/backups/mateos-pet-ai';
const NAME = /^mateos-pet-ai-(\d{8}T\d{6}Z)$/;
const FILES = ['manifest.txt', 'SHA256SUMS', 'database.dump.age'];
const DEFAULT_DESTINATION = path.join(REPO, 'backups', 'offsite');

function backupTime(name) {
  const stamp = NAME.exec(name)?.[1];
  if (!stamp) throw new Error('Invalid backup directory name');
  const iso = stamp.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z');
  const time = Date.parse(iso);
  if (!Number.isFinite(time) || new Date(time).toISOString().replace(/[-:]/g, '').replace('.000', '') !== stamp) throw new Error('Invalid backup date');
  return time;
}

function latestBackup(list, now = Date.now(), maxAgeHours = 36) {
  const names = list.trim().split(/\r?\n/).filter(Boolean);
  if (!names.length) throw new Error('No published backup found');
  names.forEach(backupTime);
  const name = names.sort().at(-1), age = now - backupTime(name);
  if (age < -900000 || age > maxAgeHours * 3600000) throw new Error('Latest backup is stale or has a future date');
  return name;
}

function metadata(manifest, sums, name) {
  const values = Object.create(null);
  for (const line of manifest.trim().split(/\r?\n/)) {
    const match = /^([a-z][a-z0-9_]*)=([^\r\n]+)$/.exec(line);
    if (!match || Object.hasOwn(values, match[1])) throw new Error('Invalid or duplicated manifest field');
    values[match[1]] = match[2];
  }
  const checksum = /^([a-f0-9]{64}) [ *]database\.dump\.age\r?\n?$/i.exec(sums);
  const size = Number(values.encrypted_size_bytes);
  if (!checksum || values.encrypted_sha256?.toLowerCase() !== checksum[1].toLowerCase() ||
      values.encrypted_file !== 'database.dump.age' || values.encryption !== 'age' ||
      values.format !== 'postgresql-custom-dump' || values.created_at_utc !== NAME.exec(name)?.[1] ||
      !/^[1-9]\d*$/.test(values.encrypted_size_bytes || '') || !Number.isSafeInteger(size) || size > 100 * 1024 ** 3) {
    throw new Error('Backup manifest and checksum do not agree');
  }
  return { sha256: checksum[1].toLowerCase(), size };
}

function options(args) {
  const result = { host: 'ubuntu@149.130.191.53', identity: process.env.MATEOS_BACKUP_SSH_KEY,
    destination: DEFAULT_DESTINATION, maxAgeHours: 36, plan: false };
  const keys = { '--host': 'host', '--identity': 'identity', '--destination': 'destination', '--max-age-hours': 'maxAgeHours', '--backup': 'backup' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--plan') { result.plan = true; continue; }
    if (!keys[args[i]] || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('Unknown or incomplete option');
    result[keys[args[i]]] = args[++i];
  }
  if (!/^[a-z_][a-z0-9_-]*@[a-z0-9][a-z0-9.-]*$/i.test(result.host)) throw new Error('Invalid SSH destination');
  if (!result.identity || !path.isAbsolute(result.identity)) throw new Error('An absolute SSH identity path is required');
  if (result.backup) backupTime(result.backup);
  result.maxAgeHours = Number(result.maxAgeHours);
  if (!Number.isFinite(result.maxAgeHours) || result.maxAgeHours < 1 || result.maxAgeHours > 168) throw new Error('Backup age must be between 1 and 168 hours');
  result.destination = path.resolve(result.destination);
  const relative = path.relative(DEFAULT_DESTINATION, result.destination);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Destination must stay under backups/offsite in this checkout');
  return result;
}

function sshTransport(config) {
  const args = ['-i', config.identity, '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes',
    '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=10', config.host];
  function start(command) {
    const child = spawn('ssh', [...args, command], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    // Do not echo remote stderr: errors must never expose credentials or remote file contents.
    child.stderr.resume();
    const timer = setTimeout(() => child.kill(), 300000);
    const completion = new Promise((resolve, reject) => {
      child.once('error', () => reject(new Error('Could not start SSH')));
      child.once('close', code => code === 0 ? resolve() : reject(new Error('SSH read failed; check connection, host key and sudo permissions')));
    }).finally(() => clearTimeout(timer));
    completion.catch(() => {});
    return { child, completion };
  }
  return {
    async text(command) {
      const { child, completion } = start(command);
      const chunks = []; let length = 0;
      try {
        for await (const chunk of child.stdout) {
          length += chunk.length;
          if (length > 65536) throw new Error('Remote metadata exceeds its limit');
          chunks.push(chunk);
        }
        await completion;
        return Buffer.concat(chunks).toString('utf8');
      } catch (error) { child.kill(); await completion.catch(() => {}); throw error; }
    },
    async download(command, file, expectedSize) {
      const { child, completion } = start(command);
      let size = 0;
      try {
        await pipeline(child.stdout, async function* (source) {
          for await (const chunk of source) {
            size += chunk.length;
            if (size > expectedSize) throw new Error('Encrypted download exceeds the declared size');
            yield chunk;
          }
        }, createWriteStream(file, { flags: 'wx', mode: 0o600 }));
        await completion;
      } catch (error) { child.kill(); await completion.catch(() => {}); throw error; }
    },
  };
}

async function plainDirectory(directory, create = false) {
  const relative = path.relative(REPO, directory);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Directory is outside this checkout');
  let current = REPO;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (create) await fs.mkdir(current, { mode: 0o700 }).catch(e => { if (e.code !== 'EEXIST') throw e; });
    const stat = await fs.lstat(current);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Backup directory must not contain links');
  }
}

async function verifySet(directory, name) {
  await plainDirectory(directory);
  for (const file of FILES) {
    const stat = await fs.lstat(path.join(directory, file));
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Backup files must be regular files');
    if (file !== 'database.dump.age' && stat.size > 65536) throw new Error('Backup metadata exceeds its limit');
  }
  const expected = metadata(await fs.readFile(path.join(directory, FILES[0]), 'utf8'), await fs.readFile(path.join(directory, FILES[1]), 'utf8'), name);
  const hash = createHash('sha256'); let size = 0, prefix = Buffer.alloc(0);
  for await (const chunk of createReadStream(path.join(directory, FILES[2]))) {
    size += chunk.length; hash.update(chunk);
    if (prefix.length < 100) prefix = Buffer.concat([prefix, chunk.subarray(0, 100 - prefix.length)]);
  }
  if (size !== expected.size || hash.digest('hex') !== expected.sha256 ||
      !/^(age-encryption\.org\/v1\n|-----BEGIN AGE ENCRYPTED FILE-----\r?\n)/.test(prefix.toString('ascii'))) {
    throw new Error('Encrypted backup integrity check failed');
  }
  return expected;
}

async function copyBackup(config, transport = sshTransport(config), now = Date.now()) {
  const list = await transport.text(`sudo -n find ${ROOT} -mindepth 1 -maxdepth 1 -type d -name 'mateos-pet-ai-*' -printf '%f\\n'`);
  let name = latestBackup(list, now, config.maxAgeHours);
  if (config.backup) {
    if (!list.trim().split(/\r?\n/).includes(config.backup)) throw new Error('Requested backup is not published on the VPS');
    name = latestBackup(config.backup, now, config.maxAgeHours);
  }
  const remoteFile = file => `sudo -n cat -- ${ROOT}/${name}/${file}`;
  const manifest = await transport.text(remoteFile(FILES[0])), sums = await transport.text(remoteFile(FILES[1]));
  const expected = metadata(manifest, sums, name);
  const final = path.join(config.destination, name);
  if (config.plan) return { status: 'ready_to_copy', backup: name, size: expected.size, destination: final };
  await plainDirectory(config.destination, true);
  const exists = await fs.lstat(final).then(() => true, e => { if (e.code === 'ENOENT') return false; throw e; });
  if (exists) {
    const local = await verifySet(final, name);
    if (local.sha256 !== expected.sha256 || local.size !== expected.size) throw new Error('Existing backup differs from the VPS; it was not replaced');
    return { status: 'already_verified', backup: name, destination: final, ...local };
  }
  const staging = await fs.mkdtemp(path.join(config.destination, '.copy-'));
  try {
    await fs.writeFile(path.join(staging, FILES[0]), manifest, { flag: 'wx', mode: 0o600 });
    await fs.writeFile(path.join(staging, FILES[1]), sums, { flag: 'wx', mode: 0o600 });
    await transport.download(remoteFile(FILES[2]), path.join(staging, FILES[2]), expected.size);
    await verifySet(staging, name);
    await fs.writeFile(path.join(staging, 'copy-receipt.json'), JSON.stringify({ copiedAt: new Date(now).toISOString(), backup: name, sha256: expected.sha256, bytes: expected.size, source: config.host, encrypted: true }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    // A competing copy never overwrites a previously published directory.
    await fs.rename(staging, final);
    return { status: 'copied_and_verified', backup: name, destination: final, ...expected };
  } finally {
    // Delete only this invocation's unpublished staging, never existing backup sets.
    const relative = path.relative(config.destination, staging);
    if (!relative.startsWith('..') && !path.isAbsolute(relative) && /^\.copy-[a-z0-9]+$/i.test(relative)) {
      await fs.rm(staging, { recursive: true, force: true });
    }
  }
}

if (require.main === module) {
  (async () => {
    const config = options(process.argv.slice(2));
    const stat = await fs.stat(config.identity);
    if (!stat.isFile()) throw new Error('SSH identity file is unavailable');
    console.log(JSON.stringify(await copyBackup(config)));
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { backupTime, latestBackup, metadata, options, verifySet, copyBackup, DEFAULT_DESTINATION };
