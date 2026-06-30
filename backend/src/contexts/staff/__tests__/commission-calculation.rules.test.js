const { calculateCommissionSplit } = require("../domain/rules/commission-calculation.rules");

describe("calculateCommissionSplit", () => {
  test("split 50/50 (grooming, Fase 1)", () => {
    const result = calculateCommissionSplit(50000, 0.5);
    expect(result.staffShare).toBe(25000);
    expect(result.businessShare).toBe(25000);
    expect(result.staffShare + result.businessShare).toBe(50000);
  });

  test("splitRate 0 (veterinaria, 100% al negocio)", () => {
    const result = calculateCommissionSplit(80000, 0);
    expect(result.staffShare).toBe(0);
    expect(result.businessShare).toBe(80000);
  });

  test("staffShare + businessShare siempre suman exactamente el precio (sin error de redondeo)", () => {
    const result = calculateCommissionSplit(33333.33, 0.3333);
    expect(Math.round((result.staffShare + result.businessShare) * 100) / 100).toBe(33333.33);
  });
});
