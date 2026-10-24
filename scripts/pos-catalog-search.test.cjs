const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../frontend/node_modules/typescript');
const crypto = require('node:crypto');
const React = require('../frontend/node_modules/react');
const { renderToStaticMarkup } = require('../frontend/node_modules/react-dom/server');

function load(relative, imports = {}) {
  const context = { exports: {}, crypto, require: id => {
    if (id in imports) return imports[id];
    if (id.startsWith('react')) return require('../frontend/node_modules/' + id);
    throw new Error('Unexpected import: ' + id);
  } };
  const source = fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return context.exports;
}
const helpers = load('frontend/lib/pos-catalog-search.ts');
const { catalogEntries, exactCatalogProduct, catalogProductAvailable, catalogServiceLine } = helpers;
const product = (values = {}) => ({ id: 'shared-id', name: 'Vacuna puppy', barcode: '770123', internalCode: 'VA-001', available: '11', uses: ['retail', 'veterinary'], active: true, salePrice: 60000, ...values });
const service = (values = {}) => ({ id: 'shared-id', name: 'Vacunación', category: 'veterinary', price: null, priceSource: 'unresolved', ...values });

test('one query combines server-filtered inventory and matching services without colliding IDs', () => {
  const p = product(), s = service(), other = service({ id: 'grooming', name: 'Peluquería' });
  const entries = catalogEntries([p], [s, other], ' VACUNACION ', 'all');
  assert.equal(entries.length, 2);
  assert.equal(entries[0].product, p);
  assert.equal(entries[1].service, s);
  assert.notEqual(entries[0].key, entries[1].key);
  assert.equal(catalogEntries([p], [s], '', 'products').map(e => e.kind).join(), 'product');
  assert.equal(catalogEntries([p], [s], 'vacunación', 'services').map(e => e.kind).join(), 'service');
  assert.equal(catalogEntries([], [other], 'consulta', 'all').length, 0);
});

test('scanner accepts exact barcode or internal code and never adds a partial or empty code', () => {
  const p = product();
  assert.equal(exactCatalogProduct([p], ' 770123 '), p);
  assert.equal(exactCatalogProduct([p], 'va-001'), p);
  assert.equal(exactCatalogProduct([p], '770'), undefined);
  assert.equal(exactCatalogProduct([product({ barcode: null, internalCode: '' })], ''), undefined);
});

test('inventory availability counts cart units and refuses inactive, non-retail or unpriced products', () => {
  const p = product();
  assert.equal(catalogProductAvailable(p, { [p.id]: 10 }), true);
  assert.equal(catalogProductAvailable(p, { [p.id]: 11 }), false);
  for (const values of [{ available: '0' }, { available: '-1' }, { available: 'invalid' }, { active: false }, { uses: ['veterinary'] }, { salePrice: null }, { salePrice: 0 }]) {
    assert.equal(catalogProductAvailable(product(values), {}), false);
  }
  assert.equal(catalogProductAvailable(product({ available: '9007199254740993' }), {}), true);
});

test('adding a service retains its resolved pet price, area and commission choice', () => {
  const s = service({ price: 42000, priceSource: 'pet_agreed_price', appliesCommissionSplit: true, category: 'grooming' });
  const line = catalogServiceLine(s, 'pet-a', 'Toby');
  assert.equal(line.unitPrice, '42000');
  assert.equal(line.quantity, '1');
  assert.equal(line.serviceId, s.id);
  assert.equal(line.serviceCategory, 'grooming');
  assert.equal(line.commissionSplit, true);
  assert.equal(line.serviceQuote.source, 'pet');
  assert.equal(line.serviceQuote.petId, 'pet-a');
  assert.equal(line.serviceQuote.petName, 'Toby');
  assert.notEqual(catalogServiceLine(s, 'pet-b', 'Luna').id, line.id);
  assert.equal(catalogServiceLine(service({ price: 60000, priceSource: 'service_base_price' }), '', '').serviceQuote.source, 'catalog');
});

test('unpriced services open price entry without inventing a fee or commission', () => {
  const line = catalogServiceLine(service(), 'pet-a', 'Toby');
  assert.equal(line.unitPrice, '');
  assert.equal(line.serviceQuote, undefined);
  assert.equal(line.commissionSplit, false);
});

const input = props => React.createElement('input', props);
const button = ({ variant, size, ...props }) => React.createElement('button', props);
const icon = () => null;
const { SaleCatalog } = load('frontend/components/dashboard/pos/sale-catalog.tsx', {
  'next/link': { default: props => React.createElement('a', props) },
  'lucide-react': { Loader2: icon, Package: icon, Plus: icon, Search: icon, ShoppingBag: icon },
  '@/components/ui/button': { Button: button }, '@/components/ui/input': { Input: input },
  '@/lib/api': { proxyUrl: value => value }, '@/lib/use-tenant': { useTenant: () => null },
  '@/lib/pos-checkout': { formatPosMoney: value => '$ ' + value }, '@/lib/pos-catalog-search': helpers,
});
test('each catalog filter renders one shared accessible search, initially with catalog collapsed', () => {
  for (const filter of ['all', 'products', 'services']) {
    const html = renderToStaticMarkup(React.createElement(SaleCatalog, { filter, productsEnabled: true, servicesEnabled: true, petId: '', additional: false,
      quantities: {}, focusRequest: 0, refreshRequest: 0, disabled: false, onProduct() {}, onService() {} }));
    assert.equal((html.match(/<input\b/g) ?? []).length, 1);
    assert.match(html, /role="combobox"/);
    assert.match(html, /aria-expanded="false"/);
    assert.match(html, /Ver catálogo/);
    assert.doesNotMatch(html, /role="listbox"/);
  }
});
