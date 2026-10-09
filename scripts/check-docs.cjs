#!/usr/bin/env node
// Read-only documentation inventory and local Markdown link validation.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const slash = (value) => value.replaceAll('\\', '/');
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [slash(path.relative(root, target))];
  });
}
function localTarget(target, source) {
  if (/^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(target)) return null;
  const clean = target.replace(/[?#].*$/, '');
  if (!clean) return null;
  let decoded;
  try { decoded = decodeURIComponent(clean); } catch { decoded = clean; }
  return path.resolve(root, target.startsWith('/') ? `.${decoded}` : path.join(path.dirname(source), decoded));
}
function links(text) {
  const found = [];
  // Code samples are examples, not navigable links.
  const prose = text.replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/(`+)[^`\n]*?\1/g, (span) => ' '.repeat(span.length));
  const pattern = /!?\[[^\]\n]*\]\(\s*(?:<([^>\n]+)>|([^\s)]+))(?:\s+["'][^\n]*?["'])?\s*\)|^\s*\[[^\]\n]+\]:\s*(?:<([^>\n]+)>|(\S+))/gm;
  for (const match of prose.matchAll(pattern)) {
    found.push({ target: match[1] || match[2] || match[3] || match[4], line: prose.slice(0, match.index).split('\n').length });
  }
  return found;
}
function inspect() {
  const docs = walk(path.join(root, 'docs')).sort();
  const repository = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const markdown = [...new Set([...docs, ...repository])].filter((file) => file.endsWith('.md') && fs.existsSync(path.join(root, file)));
  const broken = [];
  const missingDocReferences = [];
  const nonPortableLocalLinks = [];
  let checkedLinks = 0;
  for (const file of markdown) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    for (const link of links(text)) {
      if (/^(?:[a-z]:[\\/]|file:\/\/\/)/i.test(link.target)) nonPortableLocalLinks.push({ file, ...link });
      const target = localTarget(link.target, file);
      if (!target) continue;
      checkedLinks += 1;
      if (!fs.existsSync(target)) broken.push({ file, ...link });
    }
  }
  // Literal repo-relative docs paths are also used in instructions and scripts.
  for (const file of [...new Set([...docs, ...repository])]) {
    if (!/\.(md|[cm]?js|tsx?|json|ya?ml|prisma|sql)$/.test(file) || !fs.existsSync(path.join(root, file))) continue;
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    const references = new Set([...text.matchAll(/\bdocs\/[\w./-]+\.(?:md|sql|prisma|json|html|png)\b/g)].map((match) => match[0]));
    for (const target of references) {
      if (!fs.existsSync(path.join(root, target))) missingDocReferences.push({ file, target });
    }
  }
  const hashes = new Map();
  const inventory = docs.map((file) => {
    const content = fs.readFileSync(path.join(root, file));
    const sha256 = crypto.createHash('sha256').update(content).digest('hex');
    hashes.set(sha256, [...(hashes.get(sha256) || []), file]);
    const text = /\.(md|json|sql|prisma|html)$/.test(file) ? content.toString('utf8') : '';
    return { file, bytes: content.length, sha256, title: text.split(/\r?\n/).find((line) => /^# /.test(line)) || null };
  });
  const cataloguePath = path.join(root, 'docs/documentation-inventory.json');
  const catalogue = fs.existsSync(cataloguePath) ? JSON.parse(fs.readFileSync(cataloguePath, 'utf8')) : null;
  const catalogueErrors = [];
  if (catalogue) {
    const sources = new Set();
    const destinations = new Set();
    const archived = catalogue.entries.filter((entry) => entry.action === 'archived').length;
    if (catalogue.entries.length !== catalogue.originalFiles || archived !== catalogue.archived) catalogueErrors.push('Counts do not match the catalogue entries.');
    for (const entry of catalogue.entries) {
      if (sources.has(entry.original) || destinations.has(entry.file)) catalogueErrors.push(`Duplicate catalogue entry: ${entry.file}`);
      sources.add(entry.original);
      destinations.add(entry.file);
      for (const target of [entry.file, entry.closure].filter(Boolean)) {
        if (!fs.existsSync(path.join(root, 'docs', target))) catalogueErrors.push(`Missing catalogued document: ${target}`);
      }
    }
  }
  return { documents: docs.length, markdownFiles: markdown.length, checkedLinks, broken, missingDocReferences, nonPortableLocalLinks, cataloguedOriginalFiles: catalogue?.entries.length || 0, catalogueErrors, exactDuplicates: [...hashes.values()].filter((group) => group.length > 1), inventory };
}
if (require.main === module) {
  const result = inspect();
  if (!process.argv.includes('--inventory')) delete result.inventory;
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.broken.length || result.missingDocReferences.length || result.nonPortableLocalLinks.length || result.catalogueErrors.length ? 1 : 0;
}
module.exports = { links, localTarget, inspect };
