export type ReportRow = {
  student_no: string;
  name: string;
  platoon: string;
  archived: boolean;
  sessions: number;
  present: number;
  late: number;
  absent: number;
  points: number;
};

export type ReportMeta = {
  cls: string;
  from: string;
  to: string;
  activity: string;
  sessionCount: number;
};

const HEAD = ["#", "Student No.", "Name", "Platoon", "Sessions", "Present", "Late", "Absent", "Points"];

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function bodyRows(rows: ReportRow[]) {
  return rows.map((r, i) => [
    String(i + 1),
    r.student_no,
    r.name + (r.archived ? " (archived)" : ""),
    r.platoon,
    String(r.sessions),
    String(r.present),
    String(r.late),
    String(r.absent),
    String(r.points),
  ]);
}

function metaLines(m: ReportMeta) {
  return [
    `Class: ${m.cls}`,
    `Period: ${m.from || "Any"} to ${m.to || "Any"}`,
    `Activity: ${m.activity || "All"}`,
    `Completed sessions: ${m.sessionCount}`,
  ];
}

function totalsText(rows: ReportRow[]) {
  const sum = (k: "present" | "late" | "absent" | "points") => rows.reduce((n, r) => n + r[k], 0);
  return `Cadets ${rows.length} | Present ${sum("present")} | Late ${sum("late")} | Absent ${sum("absent")} | Total deduction ${sum("points")}`;
}

function fileBase(m: ReportMeta) {
  return `Report-${m.cls}-${m.from || "start"}-to-${m.to || "latest"}`.replace(/[^a-z0-9-_]+/gi, "_");
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportReportPdf(m: ReportMeta, rows: ReportRow[]) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();
  const meta = metaLines(m);

  doc.setFontSize(16);
  doc.text("Attendance Summary Report", 14, 18);
  doc.setFontSize(10);
  meta.forEach((line, i) => doc.text(line, 14, 26 + i * 5.5));

  autoTable(doc, {
    startY: 26 + meta.length * 5.5 + 3,
    head: [HEAD],
    body: bodyRows(rows),
    headStyles: { fillColor: [15, 23, 42] },
    styles: { fontSize: 8 },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  doc.text(totalsText(rows), 14, finalY + 8);
  doc.save(fileBase(m) + ".pdf");
}

export async function exportReportDocx(m: ReportMeta, rows: ReportRow[]) {
  const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, WidthType } =
    await import("docx");

  const cell = (text: string, bold = false) =>
    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold })] })] });

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: HEAD.map((h) => cell(h, true)) }),
      ...bodyRows(rows).map((r) => new TableRow({ children: r.map((c) => cell(c)) })),
    ],
  });

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: "Attendance Summary Report", heading: HeadingLevel.HEADING_1 }),
          ...metaLines(m).map((l) => new Paragraph(l)),
          new Paragraph(""),
          table,
          new Paragraph(""),
          new Paragraph({ children: [new TextRun({ text: totalsText(rows), bold: true })] }),
        ],
      },
    ],
  });

  download(await Packer.toBlob(doc), fileBase(m) + ".docx");
}

export async function exportReportExcel(m: ReportMeta, rows: ReportRow[]) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Report");

  ws.addRow(["Attendance Summary Report"]).font = { bold: true, size: 14 };
  metaLines(m).forEach((l) => ws.addRow([l]));
  ws.addRow([]);
  ws.addRow(HEAD).font = { bold: true };
  bodyRows(rows).forEach((r) => ws.addRow(r.map((v, i) => (i === 0 || i >= 4 ? Number(v) : v))));
  ws.addRow([]);
  ws.addRow([totalsText(rows)]);

  [5, 16, 30, 14, 10, 10, 8, 8, 8].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const buf = await wb.xlsx.writeBuffer();
  download(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    fileBase(m) + ".xlsx",
  );
}

// The window must be opened right inside the click handler, or the browser blocks it.
export function writeReportPrint(w: Window, m: ReportMeta, rows: ReportRow[]) {
  const body = bodyRows(rows)
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Attendance Summary Report</title><style>
    body{font-family:Arial,sans-serif;padding:24px;color:#111}
    h1{font-size:20px;margin:0 0 12px}p{margin:2px 0;font-size:13px}
    table{border-collapse:collapse;width:100%;margin-top:16px;font-size:12px}
    th,td{border:1px solid #999;padding:5px 7px;text-align:left}th{background:#eee}
  </style></head><body>
    <h1>Attendance Summary Report</h1>
    ${metaLines(m).map((l) => `<p>${esc(l)}</p>`).join("")}
    <table><thead><tr>${HEAD.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>
    <p style="margin-top:16px"><strong>${esc(totalsText(rows))}</strong></p>
  </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}