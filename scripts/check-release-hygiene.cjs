// Read-only publication guard. Reports locations, never secret values.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const forbiddenDirectories = new Set(['.cache', '.tmp', '.codex-remote-attachments', 'secrets', '__pycache__', 'node_modules', '.next']);
const secretPatterns = [
  ['private-key', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/],
  ['openai-token', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{35,}/],
  ['github-token', /\b(?:ghp|github_pat)_[A-Za-z0-9_]{30,}/],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/],
  ['slack-token', /\bxox[baprs]-[0-9A-Za-z-]{20,}/],
];
function inspectFile(name, content) {
  const parts = name.replaceAll('\\', '/').split('/'), base = parts.at(-1);
  if (parts.some(part => forbiddenDirectories.has(part)) ||
      (parts.includes('backups') && !/\.(?:md|json)$/.test(base)) ||
      (/^\.env(?:\.|$)/.test(base) && base !== '.env.example') ||
      /\.(?:pem|p12|pfx|dump|age|pyc)$/i.test(base)) return [{ file: name, kind: 'private-or-generated-file' }];
  if (typeof content !== 'string') return [];
  const hits = [];
  content.split(/\r?\n/).forEach((line, i) => {
    if (/^(?:<<<<<<< |>>>>>>> )/.test(line)) hits.push({ file: name, line: i + 1, kind: 'merge-conflict' });
    for (const [kind, pattern] of secretPatterns) if (pattern.test(line)) hits.push({ file: name, line: i + 1, kind });
  });
  return hits;
}
function main() {
  const files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean))];
  const issues = [];
  for (const name of files) {
    let stat; try { stat = fs.lstatSync(path.join(root, name)); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (!stat.isFile()) continue;
    // No arbitrary size cap that could hide a text credential.
    const data = fs.readFileSync(path.join(root, name));
    issues.push(...inspectFile(name, data.includes(0) ? null : data.toString('utf8')));
  }
  const versions = ['.', 'backend', 'frontend'].map(dir => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, dir, 'package.json'), 'utf8'));
    const lock = JSON.parse(fs.readFileSync(path.join(root, dir, 'package-lock.json'), 'utf8'));
    if (manifest.version !== lock.packages[''].version) issues.push({ file: `${dir}/package-lock.json`, kind: 'manifest-version-mismatch' });
    for (const section of ['dependencies', 'devDependencies']) {
      if (JSON.stringify(Object.entries(manifest[section] || {}).sort()) !== JSON.stringify(Object.entries(lock.packages[''][section] || {}).sort())) issues.push({ file: `${dir}/package-lock.json`, kind: `${section}-mismatch` });
    }
    return { directory: dir, version: manifest.version ?? null };
  });
  const rootLock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const backendLock = JSON.parse(fs.readFileSync(path.join(root, 'backend/package-lock.json'), 'utf8'));
  const prismaVersions = [rootLock.packages['node_modules/prisma']?.version, rootLock.packages['node_modules/@prisma/client']?.version,
    backendLock.packages['node_modules/@prisma/client']?.version, backendLock.packages['node_modules/@prisma/adapter-pg']?.version];
  if (prismaVersions.some(value => !value) || new Set(prismaVersions).size !== 1) issues.push({ file: 'package-lock.json', kind: 'prisma-version-mismatch' });
  console.log(JSON.stringify({ scannedFiles: files.length, versions, prismaVersion: prismaVersions[0], issues }, null, 2));
  if (issues.length) process.exitCode = 1;
}
if (require.main === module) main();
module.exports = { inspectFile };
