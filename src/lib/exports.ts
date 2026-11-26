import { supabase } from "@/integrations/supabase/client";
import { formatSession } from "@/lib/format";

export type ExportRow = {
  student_no: string;
  name: string;
  platoon: string;
  status: string;
  deduction: number;
};

export type ExportSession = {
  title: string;
  class: string;
  session_date: string;
  session_time: string;
  location: string;
  status: string;
  officer: { name: string } | null;
};

const HEAD = ["#", "Student No.", "Name", "Platoon", "Status", "Points"];
const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export async function fetchRows(sessionId: string): Promise<ExportRow[]> {
  const { data, error } = await supabase
    .from("attendance_records")
    .select("status,deduction,cadets(student_no,name,platoon)")
    .eq("session_id", sessionId);
  if (error) throw new Error(error.message);
  const raw = data as unknown as {
    status: string;
    deduction: number;
    cadets: { student_no: string; name: string; platoon: string };
  }[];
  return raw
    .map((r) => ({
      student_no: r.cadets.student_no,
      name: r.cadets.name,
      platoon: r.cadets.platoon,
      status: r.status,
      deduction: r.deduction,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function summary(rows: ExportRow[]) {
  const count = (st: string) => rows.filter((r) => r.status === st).length;
  return {
    total: rows.length,
    present: count("present"),
    late: count("late"),
    absent: count("absent"),
    points: rows.reduce((n, r) => n + r.deduction, 0),
  };
}

function summaryText(rows: ExportRow[]) {
  const s = summary(rows);
  return `Total ${s.total} | Present ${s.present} | Late ${s.late} | Absent ${s.absent} | Total deduction ${s.points}`;
}

function metaLines(s: ExportSession) {
  return [
    `Class: ${s.class}`,
    `Date and time: ${formatSession(s.session_date, s.session_time).replace(" · ", ", ")}`,
    `Location: ${s.location || "N/A"}`,
    `Officer: ${s.officer?.name ?? "N/A"}`,
    `Status: ${s.status === "done" ? "Done" : "Open"}`,
  ];
}

function bodyRows(rows: ExportRow[]) {
  return rows.map((r, i) => [
    String(i + 1),
    r.student_no,
    r.name,
    r.platoon,
    label(r.status),
    String(r.deduction),
  ]);
}

function fileBase(s: ExportSession) {
  return `${s.class}-${s.title}-${s.session_date}`.replace(/[^a-z0-9-_]+/gi, "_");
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

export async function exportPdf(s: ExportSession, rows: ExportRow[]) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();
  const meta = metaLines(s);

  doc.setFontSize(16);
  doc.text("Attendance Report", 14, 18);
  doc.setFontSize(12);
  doc.text(s.title, 14, 26);
  doc.setFontSize(10);
  meta.forEach((line, i) => doc.text(line, 14, 33 + i * 5.5));

  autoTable(doc, {
    startY: 33 + meta.length * 5.5 + 3,
    head: [HEAD],
    body: bodyRows(rows),
    headStyles: { fillColor: [15, 23, 42] },
    styles: { fontSize: 9 },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  doc.setFontSize(10);
  doc.text(summaryText(rows), 14, finalY + 8);
  doc.save(fileBase(s) + ".pdf");
}

export async function exportDocx(s: ExportSession, rows: ExportRow[]) {
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
          new Paragraph({ text: "Attendance Report", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ children: [new TextRun({ text: s.title, bold: true, size: 28 })] }),
          ...metaLines(s).map((l) => new Paragraph(l)),
          new Paragraph(""),
          table,
          new Paragraph(""),
          new Paragraph({ children: [new TextRun({ text: summaryText(rows), bold: true })] }),
        ],
      },
    ],
  });

  download(await Packer.toBlob(doc), fileBase(s) + ".docx");
}

export async function exportExcel(s: ExportSession, rows: ExportRow[]) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Attendance");

  ws.addRow(["Attendance Report"]).font = { bold: true, size: 14 };
  ws.addRow([s.title]).font = { bold: true };
  metaLines(s).forEach((l) => ws.addRow([l]));
  ws.addRow([]);
  ws.addRow(HEAD).font = { bold: true };
  bodyRows(rows).forEach((r) => ws.addRow(r));
  ws.addRow([]);
  const sum = summary(rows);
  ws.addRow(["Present", sum.present]);
  ws.addRow(["Late", sum.late]);
  ws.addRow(["Absent", sum.absent]);
  ws.addRow(["Total deduction", sum.points]);

  [6, 16, 30, 14, 12, 10].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const buf = await wb.xlsx.writeBuffer();
  download(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    fileBase(s) + ".xlsx",
  );
}

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// The window must be opened right inside the click handler, or the browser blocks it.
export function writePrint(w: Window, s: ExportSession, rows: ExportRow[]) {
  const body = bodyRows(rows)
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(s.title)}</title><style>
    body{font-family:Arial,sans-serif;padding:24px;color:#111}
    h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:0 0 12px}p{margin:2px 0;font-size:13px}
    table{border-collapse:collapse;width:100%;margin-top:16px;font-size:13px}
    th,td{border:1px solid #999;padding:6px 8px;text-align:left}th{background:#eee}
  </style></head><body>
    <h1>Attendance Report</h1><h2>${esc(s.title)}</h2>
    ${metaLines(s).map((l) => `<p>${esc(l)}</p>`).join("")}
    <table><thead><tr>${HEAD.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>
    <p style="margin-top:16px"><strong>${esc(summaryText(rows))}</strong></p>
  </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}