// Translation of CSV/HTTP vocabulary into existing Pet.type values.
function normalizeImportSpecies(value) {
  if (typeof value !== "string") return null;
  const type = value.trim().toLowerCase();
  if (["dog", "dogs", "perro", "perros", "perra", "perras", "canino", "caninos", "canina", "caninas"].includes(type)) return "dog";
  if (["cat", "cats", "gato", "gatos", "gata", "gatas", "felino", "felinos", "felina", "felinas"].includes(type)) return "cat";
  if (["other", "otro", "otros", "otra", "otras"].includes(type)) return "other";
  return null;
}

module.exports = { normalizeImportSpecies };
