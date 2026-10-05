import { Workbook } from "exceljs";
import { KIND_LABELS, METHOD_LABELS, reportComparisonText, reportDateKey, reportRange, reportsAgree, type ReportSummary, type ReportBreakdown } from "./pos-reports";

export async function createReportWorkbook(summary: ReportSummary, breakdown: ReportBreakdown) {
  if (!reportsAgree(summary, breakdown)) throw new Error("Actualiza el resumen y el desglose antes de exportar.");
  const book = new Workbook();
  book.creator = "Mateos Pet AI";
  book.created = new Date(summary.asOf);
  const overview = book.addWorksheet("Resumen");
  overview.columns = [{ width: 38 }, { width: 28 }, { width: 28 }, { width: 23 }];
  overview.addRows([
    ["Reporte del establecimiento", summary.establishment.name],
    ["Establecimiento ID", summary.establishment.id],
    ["Período consultado", reportRange(summary.rangeStart, summary.rangeEnd)],
    ["Período de comparación", reportRange(summary.previousRangeStart, summary.previousRangeEnd)],
    ["Comparación", summary.comparison === "equivalent" ? "Días equivalentes" : "Período anterior completo"],
    ["Criterio", reportComparisonText(summary)],
    ["Consulta (Bogotá)", new Date(summary.asOf).toLocaleString("es-CO", { timeZone: "America/Bogota" })],
    ["Moneda", "COP"], [],
    ["Indicador", "Período seleccionado", "Período anterior", "Diferencia"],
  ]);
  for (const [name, metric] of [["Ingresos", summary.revenue], ["Gastos", summary.expenses], ["Diferencia", summary.difference], ["Citas vigentes", summary.appointments], ["Clientes nuevos", summary.newClients], ["Mascotas atendidas", summary.petsAttended]] as const) overview.addRow([name, metric.value, metric.prev, metric.delta]);
  for (let row = 11; row <= 13; row++) for (let col = 2; col <= 4; col++) overview.getCell(row, col).numFmt = '"$" #,##0.00;[Red]-"$" #,##0.00';
  overview.addRow(["Cobros activos", summary.transactionCount]);
  overview.addRow([]);
  overview.addRow(["Lectura", "Movimientos activos. La diferencia no equivale a utilidad ni efectivo físico."]);
  const payments = book.addWorksheet("Medios de pago");
  payments.columns = [{ width: 32 }, { width: 18 }, { width: 26 }];
  payments.addRow(["Medio de pago", "Cobros", "Importe (COP)"]);
  breakdown.byMethod.forEach(row => payments.addRow([METHOD_LABELS[row.method], row.count, row.total]));
  payments.addRow(["Total", breakdown.count, breakdown.total]);
  payments.addRow([]);
  payments.addRow(["Por revisar", "Cobros de citas sin método confirmado por un responsable."]);
  payments.getColumn(3).numFmt = '"$" #,##0.00';
  const items = book.addWorksheet("Productos y servicios");
  items.columns = [{ width: 36 }, { width: 18 }, { width: 18 }, { width: 26 }];
  items.addRow(["Tipo", "Unidades", "Líneas", "Importe (COP)"]);
  breakdown.byKind.forEach(row => items.addRow([KIND_LABELS[row.kind], row.quantity, row.lines, row.total]));
  items.addRow(["Diferencia sin detalle", null, null, breakdown.unallocatedTotal]);
  items.addRow(["Total de ingresos", null, null, breakdown.total]);
  items.addRow([]);
  items.addRow(["Clasificación", "Utiliza los artículos guardados; los registros históricos sin tipo se conservan sin clasificación."]);
  items.getColumn(4).numFmt = '"$" #,##0.00;[Red]-"$" #,##0.00';
  for (const sheet of book.worksheets) {
    const heading = sheet.getRow(sheet === overview ? 10 : 1);
    heading.font = { bold: true, color: { argb: "FFFFFFFF" } };
    heading.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF007F78" } };
    sheet.eachRow(row => { row.alignment = { vertical: "top", wrapText: true }; });
    sheet.views = [{ state: "frozen", ySplit: sheet === overview ? 10 : 1 }];
    sheet.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  }
  return book.xlsx.writeBuffer();
}

export function reportFilename(summary: ReportSummary) {
  const name = summary.establishment.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 60) || "establecimiento";
  return `Reporte-${name}-${reportDateKey(summary.rangeStart)}-${reportDateKey(new Date(Date.parse(summary.rangeEnd) - 1).toISOString())}.xlsx`;
}
