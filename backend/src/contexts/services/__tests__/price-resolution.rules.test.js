const { resolveServicePrice, PRICE_SOURCES } = require("../domain/rules/price-resolution.rules");

describe("resolveServicePrice — jerarquía mascota > cliente > raza/tamaño > catálogo base", () => {
  const priceRules = [
    { targetType: "pet", targetId: "pet-1", price: 100, active: true },
    { targetType: "client", targetId: "client-1", price: 80, active: true },
    { targetType: "breed", targetId: "breed-1", price: 60, active: true },
    { targetType: "size", targetId: "L", price: 50, active: true },
    { targetType: "pet", targetId: "pet-2-inactive", price: 999, active: false },
  ];

  test("la regla por mascota tiene prioridad sobre todas las demás", () => {
    const result = resolveServicePrice({
      priceRules,
      basePrice: 30,
      petId: "pet-1",
      clientId: "client-1",
      breedId: "breed-1",
      size: "L",
    });
    expect(result.finalPrice).toBe(100);
    expect(result.source).toBe(PRICE_SOURCES.PET_AGREED_PRICE);
  });

  test("sin regla por mascota, aplica la regla por cliente", () => {
    const result = resolveServicePrice({
      priceRules,
      basePrice: 30,
      petId: "pet-sin-regla",
      clientId: "client-1",
      breedId: "breed-1",
      size: "L",
    });
    expect(result.finalPrice).toBe(80);
    expect(result.source).toBe(PRICE_SOURCES.CLIENT_AGREED_PRICE);
  });

  test("sin regla por mascota ni cliente, aplica la regla por raza", () => {
    const result = resolveServicePrice({
      priceRules,
      basePrice: 30,
      breedId: "breed-1",
      size: "L",
    });
    expect(result.finalPrice).toBe(60);
    expect(result.source).toBe(PRICE_SOURCES.BREED_PRICE);
  });

  test("sin regla por raza, aplica la regla por tamaño", () => {
    const result = resolveServicePrice({ priceRules, basePrice: 30, size: "L" });
    expect(result.finalPrice).toBe(50);
    expect(result.source).toBe(PRICE_SOURCES.SIZE_PRICE);
  });

  test("sin ninguna regla, aplica el precio base del catálogo", () => {
    const result = resolveServicePrice({ priceRules: [], basePrice: 30 });
    expect(result.finalPrice).toBe(30);
    expect(result.source).toBe(PRICE_SOURCES.SERVICE_BASE_PRICE);
  });

  test("una regla inactiva nunca se aplica", () => {
    const result = resolveServicePrice({ priceRules, basePrice: 30, petId: "pet-2-inactive" });
    expect(result.finalPrice).toBe(30);
    expect(result.source).toBe(PRICE_SOURCES.SERVICE_BASE_PRICE);
  });

  test("sin ninguna fuente disponible, retorna unresolved", () => {
    const result = resolveServicePrice({ priceRules: [], basePrice: null });
    expect(result.finalPrice).toBeNull();
    expect(result.source).toBe(PRICE_SOURCES.UNRESOLVED);
  });

  test("la traza incluye todos los niveles evaluados antes de resolver", () => {
    const result = resolveServicePrice({ priceRules, basePrice: 30, size: "L" });
    const levels = result.trace.map((t) => t.level);
    expect(levels).toEqual([
      PRICE_SOURCES.PET_AGREED_PRICE,
      PRICE_SOURCES.CLIENT_AGREED_PRICE,
      PRICE_SOURCES.BREED_PRICE,
      PRICE_SOURCES.SIZE_PRICE,
    ]);
  });
});
