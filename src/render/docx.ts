type DocxParagraphStyle = "title" | "subtitle" | "heading" | "normal";

export type DocxParagraphBlock = {
  type: "paragraph";
  text: string;
  style?: DocxParagraphStyle;
  bold?: boolean;
};

export type DocxTableCell = {
  text: string;
  bold?: boolean;
};

export type DocxTableBlock = {
  type: "table";
  rows: DocxTableCell[][];
  columnWidths?: number[];
};

export type DocxBlock = DocxParagraphBlock | DocxTableBlock;

type DocxOptions = {
  orientation?: "portrait" | "landscape";
};

type ZipEntry = {
  name: string;
  data: Buffer;
};

const CRC32_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});

function crc32(data: Buffer): number {
  let crc = 0xffffffff;

  for (const byte of data) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function writeUInt16(value: number): Buffer {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value, 0);
  return buffer;
}

function writeUInt32(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  return buffer;
}

function createZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf-8");
    const crc = crc32(entry.data);
    const localHeader = Buffer.concat([
      writeUInt32(0x04034b50),
      writeUInt16(20),
      writeUInt16(0x0800),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(crc),
      writeUInt32(entry.data.length),
      writeUInt32(entry.data.length),
      writeUInt16(name.length),
      writeUInt16(0),
      name,
    ]);

    localParts.push(localHeader, entry.data);

    centralParts.push(
      Buffer.concat([
        writeUInt32(0x02014b50),
        writeUInt16(20),
        writeUInt16(20),
        writeUInt16(0x0800),
        writeUInt16(0),
        writeUInt16(0),
        writeUInt16(0),
        writeUInt32(crc),
        writeUInt32(entry.data.length),
        writeUInt32(entry.data.length),
        writeUInt16(name.length),
        writeUInt16(0),
        writeUInt16(0),
        writeUInt16(0),
        writeUInt16(0),
        writeUInt32(0),
        writeUInt32(offset),
        name,
      ]),
    );

    offset += localHeader.length + entry.data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endOfCentralDirectory = Buffer.concat([
    writeUInt32(0x06054b50),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(entries.length),
    writeUInt16(entries.length),
    writeUInt32(centralDirectory.length),
    writeUInt32(offset),
    writeUInt16(0),
  ]);

  return Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]);
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function styleName(style: DocxParagraphStyle): string {
  switch (style) {
    case "title":
      return "Title";
    case "subtitle":
      return "Subtitle";
    case "heading":
      return "Heading1";
    default:
      return "Normal";
  }
}

function paragraphXml(block: DocxParagraphBlock): string {
  const style = block.style ?? "normal";
  const paragraphStyle =
    style === "normal" ? "" : `<w:pStyle w:val="${styleName(style)}"/>`;
  const bold = block.bold ? "<w:b/>" : "";

  return `
    <w:p>
      <w:pPr>${paragraphStyle}</w:pPr>
      <w:r>
        <w:rPr>${bold}</w:rPr>
        <w:t xml:space="preserve">${xmlEscape(block.text)}</w:t>
      </w:r>
    </w:p>`;
}

function tableXml(block: DocxTableBlock): string {
  const rows = block.rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, cellIndex) => {
          const width = block.columnWidths?.[cellIndex];
          const widthXml = width
            ? `<w:tcW w:w="${width}" w:type="dxa"/>`
            : `<w:tcW w:w="0" w:type="auto"/>`;
          const bold = cell.bold || rowIndex === 0;

          return `
            <w:tc>
              <w:tcPr>${widthXml}</w:tcPr>
              ${paragraphXml({
                type: "paragraph",
                text: cell.text,
                bold,
              })}
            </w:tc>`;
        })
        .join("");

      return `<w:tr>${cells}</w:tr>`;
    })
    .join("");

  return `
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="0" w:type="auto"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        </w:tblBorders>
      </w:tblPr>
      ${rows}
    </w:tbl>`;
}

function blockXml(block: DocxBlock): string {
  if (block.type === "paragraph") {
    return paragraphXml(block);
  }

  return tableXml(block);
}

function sectionPropertiesXml(options: DocxOptions): string {
  if (options.orientation === "landscape") {
    return `
      <w:sectPr>
        <w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>
        <w:pgMar w:top="850" w:right="720" w:bottom="850" w:left="720" w:header="720" w:footer="720" w:gutter="0"/>
      </w:sectPr>`;
  }

  return `
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="850" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>`;
}

function documentXml(blocks: DocxBlock[], options: DocxOptions): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${blocks.map(blockXml).join("")}
    ${sectionPropertiesXml(options)}
  </w:body>
</w:document>`;
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:pPr><w:jc w:val="center"/><w:spacing w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle">
    <w:name w:val="Subtitle"/>
    <w:pPr><w:jc w:val="center"/><w:spacing w:after="160"/></w:pPr>
    <w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr><w:spacing w:before="180" w:after="80"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
  </w:style>
</w:styles>`;
}

export function renderDocx(blocks: DocxBlock[], options: DocxOptions = {}): Buffer {
  const entries: ZipEntry[] = [
    {
      name: "[Content_Types].xml",
      data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`, "utf-8"),
    },
    {
      name: "_rels/.rels",
      data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`, "utf-8"),
    },
    {
      name: "word/_rels/document.xml.rels",
      data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`, "utf-8"),
    },
    {
      name: "word/document.xml",
      data: Buffer.from(documentXml(blocks, options), "utf-8"),
    },
    {
      name: "word/styles.xml",
      data: Buffer.from(stylesXml(), "utf-8"),
    },
  ];

  return createZip(entries);
}
