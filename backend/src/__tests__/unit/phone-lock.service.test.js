/**
 * Entregable 8.2 (Fase 8) — D-E3: verifica que runExclusive serializa
 * ejecuciones del mismo `key` (dos mensajes rápidos del mismo remitente) y
 * no bloquea `key`s distintos entre sí.
 */
const { runExclusive } = require("../../services/phone-lock.service");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("dos ejecuciones con la misma key se serializan (nunca corren en paralelo)", async () => {
  const order = [];

  const first = runExclusive("+573000000000", async () => {
    order.push("first:start");
    await delay(20);
    order.push("first:end");
  });

  const second = runExclusive("+573000000000", async () => {
    order.push("second:start");
    await delay(5);
    order.push("second:end");
  });

  await Promise.all([first, second]);

  expect(order).toEqual(["first:start", "first:end", "second:start", "second:end"]);
});

test("ejecuciones con keys distintas no se bloquean entre sí", async () => {
  const order = [];

  const a = runExclusive("+573000000001", async () => {
    order.push("a:start");
    await delay(20);
    order.push("a:end");
  });

  const b = runExclusive("+573000000002", async () => {
    order.push("b:start");
    await delay(1);
    order.push("b:end");
  });

  await Promise.all([a, b]);

  // b termina antes que a a pesar de haber empezado después — no esperó a "a".
  expect(order.indexOf("b:end")).toBeLessThan(order.indexOf("a:end"));
});

test("un error en la primera ejecución no bloquea la segunda para la misma key", async () => {
  const failing = runExclusive("+573000000003", async () => {
    throw new Error("boom");
  });

  await expect(failing).rejects.toThrow("boom");

  const result = await runExclusive("+573000000003", async () => "ok");
  expect(result).toBe("ok");
});
