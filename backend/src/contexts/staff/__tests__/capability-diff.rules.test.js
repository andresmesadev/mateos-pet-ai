const { diffCapabilities } = require("../domain/rules/capability-diff.rules");

describe("diffCapabilities", () => {
  test("agrega servicios nuevos no presentes antes", () => {
    const { toAdd, toRemove } = diffCapabilities([], ["s1", "s2"]);
    expect(toAdd.sort()).toEqual(["s1", "s2"]);
    expect(toRemove).toEqual([]);
  });

  test("retira servicios que ya no están en el conjunto solicitado", () => {
    const { toAdd, toRemove } = diffCapabilities(["s1", "s2"], ["s1"]);
    expect(toAdd).toEqual([]);
    expect(toRemove).toEqual(["s2"]);
  });

  test("no produce cambios si el conjunto es idéntico", () => {
    const { toAdd, toRemove } = diffCapabilities(["s1", "s2"], ["s2", "s1"]);
    expect(toAdd).toEqual([]);
    expect(toRemove).toEqual([]);
  });

  test("agrega y retira simultáneamente", () => {
    const { toAdd, toRemove } = diffCapabilities(["s1"], ["s2"]);
    expect(toAdd).toEqual(["s2"]);
    expect(toRemove).toEqual(["s1"]);
  });
});
