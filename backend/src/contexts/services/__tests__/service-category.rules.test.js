const { isCategoryEnabled } = require("../domain/rules/service-category.rules");

describe("isCategoryEnabled", () => {
  test("grooming requiere el módulo grooming activo", () => {
    expect(isCategoryEnabled("grooming", ["grooming"])).toBe(true);
    expect(isCategoryEnabled("grooming", [])).toBe(false);
  });

  test("veterinary requiere el módulo veterinary activo", () => {
    expect(isCategoryEnabled("veterinary", ["veterinary"])).toBe(true);
    expect(isCategoryEnabled("veterinary", ["grooming"])).toBe(false);
  });

  test("una categoría sin módulo asociado (ej. 'other') está siempre habilitada", () => {
    expect(isCategoryEnabled("other", [])).toBe(true);
  });
});
