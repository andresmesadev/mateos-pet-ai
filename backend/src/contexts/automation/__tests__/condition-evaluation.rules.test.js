const { matchesCondition } = require("../domain/rules/condition-evaluation.rules");

describe("matchesCondition", () => {
  test("condición null siempre aplica", () => {
    expect(matchesCondition(null, { priceSource: "manual_override" })).toBe(true);
  });

  test("condición de igualdad plana que coincide aplica", () => {
    expect(matchesCondition({ priceSource: "manual_override" }, { priceSource: "manual_override", other: 1 })).toBe(true);
  });

  test("condición de igualdad plana que no coincide no aplica", () => {
    expect(matchesCondition({ priceSource: "manual_override" }, { priceSource: "service_base_price" })).toBe(false);
  });

  test("condición con múltiples campos exige que todos coincidan", () => {
    expect(matchesCondition({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(matchesCondition({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
  });
});
