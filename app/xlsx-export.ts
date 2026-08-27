export type WorkbookCell = string | number;

type ZipFile = { name: string; data: Uint8Array; crc: number; offset: number };

const encoder = new TextEncoder();

function xmlEscape(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character] ?? character);
}

function columnName(index: number) {
  let result = "";
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    result = String.fromCharCode(65 + ((value - 1) % 26)) + result;
  }
  return result;
}

function worksheet(rows: WorkbookCell[][]) {
  const body = rows.map((row, rowIndex) => {
    const cells = row.map((cell, columnIndex) => {
      const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
      if (typeof cell === "number" && Number.isFinite(cell)) return `<c r="${reference}"><v>${cell}</v></c>`;
      return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(String(cell))}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews><sheetData>${body}</sheetData></worksheet>`;
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function write16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function write32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

function join(parts: Uint8Array[]) {
  const length = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

function zip(entries: Array<{ name: string; content: string }>) {
  const now = new Date();
  const year = Math.min(2107, Math.max(1980, now.getFullYear()));
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const localParts: Uint8Array[] = [];
  const files: ZipFile[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = encoder.encode(entry.content);
    const crc = crc32(data);
    const header = new Uint8Array(30);
    const view = new DataView(header.buffer);
    write32(view, 0, 0x04034b50);
    write16(view, 4, 20);
    write16(view, 6, 0x0800);
    write16(view, 8, 0);
    write16(view, 10, dosTime);
    write16(view, 12, dosDate);
    write32(view, 14, crc);
    write32(view, 18, data.byteLength);
    write32(view, 22, data.byteLength);
    write16(view, 26, name.byteLength);
    write16(view, 28, 0);
    localParts.push(header, name, data);
    files.push({ name: entry.name, data, crc, offset });
    offset += header.byteLength + name.byteLength + data.byteLength;
  }

  const centralParts: Uint8Array[] = [];
  let centralSize = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const header = new Uint8Array(46);
    const view = new DataView(header.buffer);
    write32(view, 0, 0x02014b50);
    write16(view, 4, 20);
    write16(view, 6, 20);
    write16(view, 8, 0x0800);
    write16(view, 10, 0);
    write16(view, 12, dosTime);
    write16(view, 14, dosDate);
    write32(view, 16, file.crc);
    write32(view, 20, file.data.byteLength);
    write32(view, 24, file.data.byteLength);
    write16(view, 28, name.byteLength);
    write16(view, 30, 0);
    write16(view, 32, 0);
    write16(view, 34, 0);
    write16(view, 36, 0);
    write32(view, 38, 0);
    write32(view, 42, file.offset);
    centralParts.push(header, name);
    centralSize += header.byteLength + name.byteLength;
  }

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  write32(endView, 0, 0x06054b50);
  write16(endView, 4, 0);
  write16(endView, 6, 0);
  write16(endView, 8, files.length);
  write16(endView, 10, files.length);
  write32(endView, 12, centralSize);
  write32(endView, 16, offset);
  write16(endView, 20, 0);
  return join([...localParts, ...centralParts, end]);
}

export function createXlsx(rows: WorkbookCell[][]) {
  return zip([
    { name: "[Content_Types].xml", content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>' },
    { name: "_rels/.rels", content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: "xl/workbook.xml", content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="דוח" sheetId="1" r:id="rId1"/></sheets></workbook>' },
    { name: "xl/_rels/workbook.xml.rels", content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>' },
    { name: "xl/worksheets/sheet1.xml", content: worksheet(rows) },
  ]);
}