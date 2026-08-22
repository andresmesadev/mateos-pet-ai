/**
 * Ingesta notas de conocimiento del negocio (ej. exportadas de Obsidian) a
 * la base de conocimiento del tenant (KnowledgeChunk). Lee todos los .md de
 * una carpeta, los trocea en fragmentos manejables, genera su embedding y
 * los persiste vía business-knowledge.service.js (sin duplicar la lógica de
 * embeddings, ya existente en embedding.service.js).
 *
 * Uso:
 *   node scripts/ingest-knowledge.js --tenant <tenantId> --folder ./mis-notas
 *
 * Nota: volver a correr el script sobre la misma carpeta duplica los
 * fragmentos — no hay reemplazo automático en este v1 (deuda documentada en
 * el diseño). Para reingestar limpio, borra antes los KnowledgeChunk de ese
 * tenant o usa --replace.
 */
const fs = require("fs");
const path = require("path");
const prisma = require("../src/lib/prisma");
const { saveKnowledgeChunk } = require("../src/services/business-knowledge.service");

const MAX_CHUNK_CHARS = 800;

function parseArgs(argv) {
  const args = { replace: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--tenant") args.tenant = argv[++i];
    else if (argv[i] === "--folder") args.folder = argv[++i];
    else if (argv[i] === "--replace") args.replace = true;
  }
  return args;
}

/**
 * Trocea un markdown por párrafos, agrupando párrafos consecutivos hasta el
 * límite de tamaño — evita fragmentos demasiado pequeños (baja relevancia
 * de búsqueda) o demasiado grandes (diluyen la similitud).
 */
function chunkMarkdown(text) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > MAX_CHUNK_CHARS && current) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  return chunks;
}

async function main() {
  const { tenant, folder, replace } = parseArgs(process.argv.slice(2));

  if (!tenant || !folder) {
    console.error("Uso: node scripts/ingest-knowledge.js --tenant <tenantId> --folder <ruta> [--replace]");
    process.exit(1);
  }

  const folderPath = path.resolve(folder);
  if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
    console.error(`No existe la carpeta: ${folderPath}`);
    process.exit(1);
  }

  const tenantExists = await prisma.tenant.findUnique({ where: { id: tenant }, select: { id: true, name: true } });
  if (!tenantExists) {
    console.error(`No existe ningún tenant con id: ${tenant}`);
    process.exit(1);
  }

  if (replace) {
    const deleted = await prisma.knowledgeChunk.deleteMany({ where: { tenantId: tenant } });
    console.log(`Fragmentos anteriores borrados: ${deleted.count}`);
  }

  const files = fs.readdirSync(folderPath).filter((f) => f.toLowerCase().endsWith(".md"));
  if (files.length === 0) {
    console.log("No se encontraron archivos .md en la carpeta.");
    return;
  }

  console.log(`Tenant: ${tenantExists.name} (${tenantExists.id})`);
  console.log(`Archivos encontrados: ${files.length}`);

  let totalChunks = 0;
  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const text = fs.readFileSync(filePath, "utf8");
    const chunks = chunkMarkdown(text);

    console.log(`  ${file} → ${chunks.length} fragmento(s)`);

    for (const chunk of chunks) {
      const saved = await saveKnowledgeChunk({
        tenantId: tenant,
        source: file,
        content: chunk,
      });
      if (saved) totalChunks++;
    }
  }

  console.log(`Listo. ${totalChunks} fragmentos guardados para el tenant ${tenantExists.name}.`);
}

main()
  .catch((error) => {
    console.error("Error en la ingesta:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
