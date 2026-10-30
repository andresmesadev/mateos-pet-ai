const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require('../../frontend/node_modules/typescript');
const root = path.resolve(__dirname, '../..');
function loadBillingAccess(fetch, env = {}) {
  function load(file, dependencies = {}) {
    const exports = {};
    const source = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(source, { exports, fetch, AbortSignal, process: { env }, require: name => {
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      throw Error('Unexpected billing access dependency: ' + name);
    } });
    return exports;
  }
  const api = load('frontend/lib/api.ts');
  return load('frontend/lib/billing-access.ts', { '@/lib/api': api });
}
module.exports = { loadBillingAccess };
