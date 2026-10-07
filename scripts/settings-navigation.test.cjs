const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("../frontend/node_modules/typescript");
const source = fs.readFileSync(path.join(__dirname, "../frontend/components/dashboard/settings-tabs.tsx"), "utf8");

// Exercise the component's event boundary without relying on browser-specific
// dialog suppression. Other sections are inert; the actual form is checked in Chrome.
function render({ dirty = false, saving = false } = {}) {
  const listeners = {}, writes = [], states = [], cleanups = [];
  const location = { href: "http://localhost:3001/dashboard/settings?tenant=tenant%20a&tab=general", pathname: "/dashboard/settings", origin: "http://localhost:3001" };
  const history = { replaceState: (_state, _title, url) => writes.push(url), pushState: (_state, _title, url) => writes.push(url) };
  const window = { location, history, addEventListener: (name, callback) => { listeners[name] = callback; }, removeEventListener: () => {}, confirm: () => false };
  const document = { addEventListener: (name, callback) => { listeners[name] = callback; }, removeEventListener: () => {} };
  class Element { closest() { return this.anchor; } }
  let index = 0;
  const react = {
    useState(initial) { const slot = index++; return [slot === 1 ? dirty : slot === 2 ? saving : typeof initial === "function" ? initial() : initial, (value) => states.push({ slot, value })]; },
    useCallback: (fn) => fn,
    useEffect: (fn) => { const cleanup = fn(); if (cleanup) cleanups.push(cleanup); },
  };
  const jsx = (type, props) => ({ type, props });
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports: module.exports, module, URL, window, document, Element,
    require(name) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "next/navigation") return { useRouter: () => ({ push: (url) => writes.push(url) }) };
      return new Proxy({}, { get: (_object, key) => key === "cn" ? () => "" : () => null });
    },
  });
  const tree = module.exports.SettingsTabs({ profile: { id: "tenant a" }, services: [] });
  function nodes(value) {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object") return [];
    return [value, ...nodes(value.props?.children)];
  }
  return { listeners, writes, states, Element, buttons: nodes(tree).filter((node) => node.type === "button"), cleanups };
}

test("al recargar con cambios cancela beforeunload y solicita el aviso del navegador", () => {
  const view = render({ dirty: true });
  let prevented = false;
  const event = { preventDefault: () => { prevented = true; }, returnValue: undefined };
  view.listeners.beforeunload(event);
  assert.equal(prevented, true);
  assert.equal(event.returnValue, "");
});

test("sin cambios ni guardado activo no registra un aviso de salida innecesario", () => {
  assert.equal(render().listeners.beforeunload, undefined);
});

test("una pestaña con cambios solicita descarte sin cambiar la URL", () => {
  const view = render({ dirty: true });
  view.buttons.find((button) => button.props.id === "settings-tab-areas").props.onClick();
  assert.equal(view.writes.length, 0);
  assert.equal(view.states.find((state) => state.slot === 3).value.tab, "areas");
});

test("cambiar de sección conserva el establecimiento y el resto de los parámetros", () => {
  const view = render();
  view.buttons.find((button) => button.props.id === "settings-tab-areas").props.onClick();
  const url = new URL(view.writes[0], "http://localhost:3001");
  assert.equal(url.searchParams.get("tenant"), "tenant a");
  assert.equal(url.searchParams.get("tab"), "areas");
});

test("un enlace a otro módulo pide confirmación antes de perder el borrador", () => {
  const view = render({ dirty: true });
  const target = new view.Element();
  target.anchor = { href: "http://localhost:3001/dashboard/inventory", target: "", hasAttribute: () => false };
  let prevented = false, stopped = false;
  view.listeners.click({ target, button: 0, preventDefault: () => { prevented = true; }, stopPropagation: () => { stopped = true; } });
  assert(prevented && stopped);
  assert.equal(view.states.find((state) => state.slot === 3).value.href, target.anchor.href);
  assert.equal(view.writes.length, 0);
});

test("durante el guardado bloquea el cambio de sección", () => {
  const view = render({ saving: true });
  view.buttons.find((button) => button.props.id === "settings-tab-areas").props.onClick();
  assert.equal(view.writes.length, 0);
  assert.equal(view.states.length, 0);
});
