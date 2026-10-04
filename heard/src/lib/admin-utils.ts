// A leading =, +, - or @ turns a cell into a live formula in Excel and Sheets.
// Prefixing an apostrophe keeps it as plain text.
const neutralise = (val: unknown): string => {
  const str = String(val ?? "");
  return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
};

export const exportToCSV = (data: Record<string, any>[], filename: string) => {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.map((h) => `"${neutralise(h).replace(/"/g, '""')}"`).join(","),
    ...data.map((row) =>
      headers
        .map((h) => {
          const str = neutralise(row[h]).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(",")
    ),
  ];
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportToExcel = (data: Record<string, any>[], filename: string) => {
  if (!data.length) return;
  const headers = Object.keys(data[0]);

  const escapeXml = (val: any) => {
    const str = String(val ?? "");
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  };

  const rows = data.map(
    (row) =>
      `<Row>${headers
        .map((h) => {
          const val = row[h] ?? "";
          const isNum = typeof val === "number";
          return `<Cell><Data ss:Type="${isNum ? "Number" : "String"}">${isNum ? escapeXml(val) : escapeXml(neutralise(val))}</Data></Cell>`;
        })
        .join("")}</Row>`
  );

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="header"><Font ss:Bold="1"/></Style>
  </Styles>
  <Worksheet ss:Name="Sheet1">
    <Table>
      <Row ss:StyleID="header">${headers.map((h) => `<Cell><Data ss:Type="String">${escapeXml(neutralise(h))}</Data></Cell>`).join("")}</Row>
      ${rows.join("\n      ")}
    </Table>
  </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.xls`;
  a.click();
  URL.revokeObjectURL(url);
};

export const downloadTemplate = (headers: string[], exampleRow: string[], filename: string) => {
  const csvRows = [
    headers.map((h) => `"${neutralise(h).replace(/"/g, '""')}"`).join(","),
    exampleRow.map((v) => `"${neutralise(v).replace(/"/g, '""')}"`).join(","),
  ];
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-template.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const parseCSV = (text: string): { headers: string[]; rows: string[][] } => {
  const lines = text.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 1) return { headers: [], rows: [] };
  const parse = (line: string) => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };
  const headers = parse(lines[0]);
  const rows = lines.slice(1).map(parse);
  return { headers, rows };
};


export const PAGE_SIZE = 25;

// Helper to bypass strict typing for tables not yet in auto-generated types
import { supabase } from "@/integrations/supabase/client";

export const adminDb = () => supabase as any;
