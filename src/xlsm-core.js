(() => {
  'use strict';

  const enc = new TextEncoder();
  const dec = new TextDecoder('utf-8');
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  const u16 = (v) => new Uint8Array([v & 255, (v >>> 8) & 255]);
  const u32 = (v) => new Uint8Array([v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]);
  const r16 = (v, o) => v.getUint16(o, true);
  const r32 = (v, o) => v.getUint32(o, true);

  function join(parts) {
    const size = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(size);
    let offset = 0;
    parts.forEach((p) => { out.set(p, offset); offset += p.length; });
    return out;
  }

  function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (const b of bytes) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function zip(files) {
    const local = [];
    const central = [];
    let offset = 0;
    const now = new Date();
    const time = ((now.getHours() & 31) << 11) | ((now.getMinutes() & 63) << 5) | (Math.floor(now.getSeconds() / 2) & 31);
    const date = (((Math.max(1980, now.getFullYear()) - 1980) & 127) << 9) | (((now.getMonth() + 1) & 15) << 5) | (now.getDate() & 31);

    Object.entries(files).forEach(([name, value]) => {
      const nameBytes = enc.encode(name);
      const data = value instanceof Uint8Array ? value : enc.encode(value);
      const crc = crc32(data);
      const entry = join([u32(0x04034B50), u16(20), u16(0x0800), u16(0), u16(time), u16(date), u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), nameBytes, data]);
      local.push(entry);
      central.push(join([u32(0x02014B50), u16(20), u16(20), u16(0x0800), u16(0), u16(time), u16(date), u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes]));
      offset += entry.length;
    });

    const directory = join(central);
    return join([...local, directory, u32(0x06054B50), u16(0), u16(0), u16(central.length), u16(central.length), u32(directory.length), u32(offset), u16(0)]);
  }

  function esc(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  function colName(index) {
    let value = index + 1;
    let result = '';
    while (value) {
      result = String.fromCharCode(65 + ((value - 1) % 26)) + result;
      value = Math.floor((value - 1) / 26);
    }
    return result;
  }

  function sheetXml(matrix, widths) {
    const rows = matrix.map((row, ri) => `<row r="${ri + 1}">${row.map((value, ci) => `<c r="${colName(ci)}${ri + 1}" t="inlineStr"${ri === 0 ? ' s="1"' : ''}><is><t xml:space="preserve">${esc(value)}</t></is></c>`).join('')}</row>`).join('');
    const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
    const lastCol = colName(Math.max(0, (matrix[0]?.length || 1) - 1));
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${rows}</sheetData><autoFilter ref="A1:${lastCol}${Math.max(1, matrix.length)}"/></worksheet>`;
  }

  function create(sheets) {
    const now = new Date().toISOString();
    const names = sheets.map((s) => s.name);
    const sheetOverrides = sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
    const workbookSheets = sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('');
    const rels = sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('');
    const files = {
      '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.ms-excel.sheet.macroEnabled.main+xml"/>${sheetOverrides}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
      '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
      'docProps/core.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>DienstPilot Dienste und Dienstpläne</dc:title><dc:creator>DienstPilot</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`,
      'docProps/app.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>DienstPilot</Application><TitlesOfParts><vt:vector size="${names.length}" baseType="lpstr">${names.map((n) => `<vt:lpstr>${esc(n)}</vt:lpstr>`).join('')}</vt:vector></TitlesOfParts></Properties>`,
      'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${workbookSheets}</sheets></workbook>`,
      'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      'xl/styles.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
    };
    sheets.forEach((s, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(s.rows, s.widths); });
    return zip(files);
  }

  async function inflate(bytes) {
    if (typeof DecompressionStream !== 'function') throw new Error('Dieser Browser kann komprimierte Excel-Dateien nicht einlesen.');
    return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  }

  async function unzip(buffer) {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i -= 1) {
      if (r32(view, i) === 0x06054B50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Die Datei ist keine gültige XLSM- oder XLSX-Datei.');
    const count = r16(view, eocd + 10);
    let offset = r32(view, eocd + 16);
    const files = {};
    for (let i = 0; i < count; i += 1) {
      if (r32(view, offset) !== 0x02014B50) throw new Error('Die Excel-Datei ist beschädigt.');
      const method = r16(view, offset + 10);
      const size = r32(view, offset + 20);
      const nameLen = r16(view, offset + 28);
      const extraLen = r16(view, offset + 30);
      const commentLen = r16(view, offset + 32);
      const localOffset = r32(view, offset + 42);
      const name = dec.decode(bytes.slice(offset + 46, offset + 46 + nameLen));
      const localNameLen = r16(view, localOffset + 26);
      const localExtraLen = r16(view, localOffset + 28);
      const start = localOffset + 30 + localNameLen + localExtraLen;
      const compressed = bytes.slice(start, start + size);
      files[name] = method === 0 ? compressed : method === 8 ? await inflate(compressed) : null;
      offset += 46 + nameLen + extraLen + commentLen;
    }
    return files;
  }

  function resolve(base, target) {
    if (target.startsWith('/')) return target.slice(1);
    const parts = base.split('/');
    parts.pop();
    target.split('/').forEach((p) => { if (p === '..') parts.pop(); else if (p && p !== '.') parts.push(p); });
    return parts.join('/');
  }

  function colIndex(ref) {
    const letters = String(ref || '').match(/^[A-Z]+/i)?.[0]?.toUpperCase() || 'A';
    let value = 0;
    for (const c of letters) value = value * 26 + c.charCodeAt(0) - 64;
    return value - 1;
  }

  function sharedStrings(files) {
    if (!files['xl/sharedStrings.xml']) return [];
    const doc = new DOMParser().parseFromString(dec.decode(files['xl/sharedStrings.xml']), 'application/xml');
    return [...doc.getElementsByTagNameNS('*', 'si')].map((si) => [...si.getElementsByTagNameNS('*', 't')].map((t) => t.textContent || '').join(''));
  }

  function parseSheet(bytes, shared) {
    const doc = new DOMParser().parseFromString(dec.decode(bytes), 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Ein Tabellenblatt ist beschädigt.');
    return [...doc.getElementsByTagNameNS('*', 'row')].map((row) => {
      const values = [];
      [...row.getElementsByTagNameNS('*', 'c')].forEach((cell) => {
        const type = cell.getAttribute('t') || '';
        let value = '';
        if (type === 'inlineStr') value = [...cell.getElementsByTagNameNS('*', 't')].map((t) => t.textContent || '').join('');
        else {
          value = cell.getElementsByTagNameNS('*', 'v')[0]?.textContent || '';
          if (type === 's') value = shared[Number(value)] ?? '';
          if (type === 'b') value = value === '1' ? 'WAHR' : 'FALSCH';
        }
        values[colIndex(cell.getAttribute('r'))] = String(value).trim();
      });
      return values;
    });
  }

  async function read(file) {
    const files = await unzip(await file.arrayBuffer());
    const wbBytes = files['xl/workbook.xml'];
    const relBytes = files['xl/_rels/workbook.xml.rels'];
    if (!wbBytes || !relBytes) throw new Error('Die Excel-Datei enthält keine lesbare Arbeitsmappe.');
    const wb = new DOMParser().parseFromString(dec.decode(wbBytes), 'application/xml');
    const rel = new DOMParser().parseFromString(dec.decode(relBytes), 'application/xml');
    const targets = {};
    [...rel.getElementsByTagNameNS('*', 'Relationship')].forEach((r) => { targets[r.getAttribute('Id')] = r.getAttribute('Target'); });
    const shared = sharedStrings(files);
    const sheets = {};
    [...wb.getElementsByTagNameNS('*', 'sheet')].forEach((sheet) => {
      const id = sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || sheet.getAttribute('r:id');
      const path = targets[id] ? resolve('xl/workbook.xml', targets[id]) : '';
      if (path && files[path]) sheets[sheet.getAttribute('name') || ''] = parseSheet(files[path], shared);
    });
    return sheets;
  }

  window.DienstPilotXlsmCore = { create, read };
})();