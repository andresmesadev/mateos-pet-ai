export type ImportedPet = {
  name: string;
  breed: string;
  type: string;
  price: string;
  with_transport_price: string;
  last_visit: string;
  visit_history: string;
};

export type ImportedContact = {
  owner_name: string;
  phone: string;
  phones_alt: string;
  address: string;
  notes: string;
  pets: ImportedPet[];
};

export function normalizeImportSpecies(value: string): "dog" | "cat" | "other" | null {
  const type = value.trim().toLowerCase();
  if (["dog", "dogs", "perro", "perros", "perra", "perras", "canino", "caninos", "canina", "caninas"].includes(type)) return "dog";
  if (["cat", "cats", "gato", "gatos", "gata", "gatas", "felino", "felinos", "felina", "felinas"].includes(type)) return "cat";
  if (["other", "otro", "otros", "otra", "otras"].includes(type)) return "other";
  return null;
}

function cleanField(value: string): string {
  const clean = value.trim();
  return ["nan", "null"].includes(clean.toLowerCase()) ? "" : clean;
}

// Read complete logical records: Outlook/Excel notes can contain line breaks,
// separators and escaped quotes inside one cell.
function readCSV(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0];
  let quotes = false, commas = 0, semicolons = 0;
  for (const ch of firstLine) {
    if (ch === '"') quotes = !quotes;
    else if (!quotes && ch === ",") commas++;
    else if (!quotes && ch === ";") semicolons++;
  }
  const separator = semicolons > commas ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cell = "", inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '"') {
      if (inQuotes && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (inQuotes || cell === "") inQuotes = !inQuotes;
      else cell += ch;
    } else if (!inQuotes && ch === separator) {
      row.push(cell); cell = "";
    } else if (!inQuotes && (ch === "\n" || ch === "\r")) {
      row.push(cell);
      if (row.some(value => value.trim())) rows.push(row);
      row = []; cell = "";
      if (ch === "\r" && clean[i + 1] === "\n") i++;
    } else cell += ch;
  }
  if (inQuotes) throw new Error("El CSV tiene comillas sin cerrar. Guarda el archivo nuevamente como CSV.");
  row.push(cell);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

export function parseContactsCSV(text: string): ImportedContact[] {
  const rows = readCSV(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.toLowerCase().trim());
  if (!headers.includes("pet_1_name")) return [];
  return rows.slice(1).map((cols, index) => {
    if (cols.length !== headers.length) {
      throw new Error(`El registro ${index + 1} tiene una cantidad de columnas diferente al encabezado.`);
    }
    const get = (key: string) => cleanField(cols[headers.indexOf(key)] ?? "");
    const pets = Array.from({ length: 5 }, (_, index): ImportedPet => {
      const prefix = `pet_${index + 1}_`;
      const species = [get(`${prefix}type`), get(`${prefix}species`), get(`${prefix}especie`)].filter(Boolean);
      const normalized = species.map(type => normalizeImportSpecies(type));
      if (get(`${prefix}name`) && species.length > 1 && (normalized.some(type => !type) || new Set(normalized).size > 1)) {
        throw new Error(`El registro ${index + 1} indica especies diferentes para ${get(`${prefix}name`)}.`);
      }
      return {
        name: get(`${prefix}name`), breed: get(`${prefix}breed`),
        type: normalizeImportSpecies(species[0] ?? "") ?? species[0] ?? "",
        price: get(`${prefix}price`), with_transport_price: get(`${prefix}with_transport_price`), last_visit: get(`${prefix}last_visit`), visit_history: get(`${prefix}visit_history`),
      };
    }).filter(pet => pet.name);
    return { owner_name: get("owner_name"), phone: get("phone"), phones_alt: get("phones_alt"), address: get("address"), notes: get("notes"), pets };
  }).filter(contact => contact.owner_name || contact.phone || contact.pets.length);
}
