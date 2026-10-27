import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { beforeAll, describe, expect, it } from "vitest";
import { convertPdfPageToPng } from "../src/index.js";

const fontsDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures/fonts");
const monoPath = resolve(fontsDirectory, "cjk-mono.ttf");
const sansPath = resolve(fontsDirectory, "cjk-sans.ttf");
const collectionPath = resolve(fontsDirectory, "collection.ttc");

const MONO_FAMILY = "Noto Sans Mono CJK JP";
const SANS_FAMILY = "Noto Sans CJK JP";

// Installed faces are removed so only these fixtures are visible to Canvas.
// cjk-mono.ttf is a full-width rectangle. cjk-sans.ttf is a narrower one.
beforeAll(() => {
  GlobalFonts.removeAll();
  expect(GlobalFonts.registerFromPath(monoPath)).not.toBeNull();
  expect(GlobalFonts.registerFromPath(sansPath)).not.toBeNull();
});

describe("generic font fallback", () => {
  it("rejects a family Canvas does not list", async () => {
    const conversion = convertPdfPageToPng(unembeddedCjkPdf(), 1, {
      fallbackFonts: { monospace: { family: "No Such Font" } },
    });

    await expect(conversion).rejects.toThrow(/No Such Font/);
  });

  it("rejects a family that is not a string", async () => {
    const conversion = convertPdfPageToPng(unembeddedCjkPdf(), 1, {
      fallbackFonts: { monospace: { family: undefined as unknown as string } },
    });

    await expect(conversion).rejects.toThrow(/monospace\.family must be a non-empty string/);
  });

  it("rejects a face index past the end of a collection", async () => {
    const conversion = convertPdfPageToPng(unembeddedCjkPdf(), 1, {
      fallbackFonts: { monospace: { path: collectionPath, faceIndex: 5 } },
    });

    await expect(conversion).rejects.toThrow(/faceIndex 5/);
  });

  it("draws non-embedded Japanese with the monospace font and keeps that choice", async () => {
    const pdf = unembeddedCjkPdf();
    const page = await convertPdfPageToPng(pdf, 1, { scale: 2 });
    const [regular, bold] = await inkBands(page.data);

    expect(regular).toBeDefined();
    expect(bold).toBeDefined();
    expect(bandWidth(regular)).toBeGreaterThan(34);
    expect(bandWidth(regular)).toBeLessThan(44);
    expect(bandWidth(bold)).toBeGreaterThan(34);
    expect(bandWidth(bold)).toBeLessThan(44);

    const override = convertPdfPageToPng(pdf, 1, {
      fallbackFonts: { monospace: { family: SANS_FAMILY } },
    });

    await expect(override).rejects.toThrow(new RegExp(MONO_FAMILY));
  });

  it("keeps the automatic choice when a preferred font appears later", async () => {
    expect(GlobalFonts.registerFromPath(sansPath, "Hiragino Sans")).not.toBeNull();

    const page = convertPdfPageToPng(unembeddedCjkPdf(), 1);

    await expect(page).resolves.toBeDefined();
  });

  it("uses the selected collection face even when another font has its family name", async () => {
    expect(GlobalFonts.registerFromPath(sansPath, "Test Mono JP")).not.toBeNull();
    const options = { fallbackFonts: { serif: { path: collectionPath, faceIndex: 1 } } };

    await convertPdfPageToPng(unembeddedCjkPdf(), 1, options);
    await convertPdfPageToPng(unembeddedCjkPdf(), 1, options);

    expect(textWidth("serif")).toBeCloseTo(40, 0);
  });
});

function textWidth(family: string): number {
  const context = createCanvas(10, 10).getContext("2d");
  context.font = `40px ${family}`;
  return context.measureText("あ").width;
}

// Uniform width 1000 makes PDF.js classify both faces as monospace.
// Each row shows U+3042, regular then bold.
function unembeddedCjkPdf(): Buffer {
  const toUnicode = `CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo << /Registry (Adobe) /Ordering (Japan1) /Supplement 6 >> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
1 beginbfchar
<0001> <3042>
endbfchar
endcmap
CMapName currentdict /CMap defineresource pop
end
end
`;
  const contents = `BT
/F1 24 Tf
30 88 Td
<0001> Tj
/F2 24 Tf
0 -48 Td
<0001> Tj
ET
`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 120] /Resources << /Font << /F1 4 0 R /F2 7 0 R >> >> /Contents 11 0 R >>",
    "<< /Type /Font /Subtype /Type0 /BaseFont /NonEmbedded /Encoding /Identity-H /DescendantFonts [5 0 R] /ToUnicode 10 0 R >>",
    "<< /Type /Font /Subtype /CIDFontType2 /BaseFont /NonEmbedded /CIDSystemInfo << /Registry (Adobe) /Ordering (Japan1) /Supplement 6 >> /FontDescriptor 6 0 R /DW 1000 /W [1 [1000]] /CIDToGIDMap /Identity >>",
    "<< /Type /FontDescriptor /FontName /NonEmbedded /Flags 4 /FontBBox [0 -200 1000 800] /ItalicAngle 0 /Ascent 800 /Descent -200 /CapHeight 700 /StemV 80 >>",
    "<< /Type /Font /Subtype /Type0 /BaseFont /NonEmbedded-Bold /Encoding /Identity-H /DescendantFonts [8 0 R] /ToUnicode 10 0 R >>",
    "<< /Type /Font /Subtype /CIDFontType2 /BaseFont /NonEmbedded-Bold /CIDSystemInfo << /Registry (Adobe) /Ordering (Japan1) /Supplement 6 >> /FontDescriptor 9 0 R /DW 1000 /W [1 [1000]] /CIDToGIDMap /Identity >>",
    "<< /Type /FontDescriptor /FontName /NonEmbedded-Bold /Flags 4 /FontBBox [0 -200 1000 800] /ItalicAngle 0 /Ascent 800 /Descent -200 /CapHeight 700 /StemV 80 >>",
    `<< /Length ${Buffer.byteLength(toUnicode)} >>\nstream\n${toUnicode}endstream`,
    `<< /Length ${Buffer.byteLength(contents)} >>\nstream\n${contents}endstream`,
  ];

  const chunks: Buffer[] = [];
  let length = 0;
  const offsets = [0];
  const write = (text: string) => {
    const bytes = Buffer.from(text);
    chunks.push(bytes);
    length += bytes.length;
  };

  write("%PDF-1.4\n");
  objects.forEach((body, index) => {
    offsets.push(length);
    write(`${index + 1} 0 obj\n${body}\nendobj\n`);
  });
  const startxref = length;
  write(`xref\n0 ${objects.length + 1}\n`);
  write("0000000000 65535 f \n");
  for (const offset of offsets.slice(1)) {
    write(`${String(offset).padStart(10, "0")} 00000 n \n`);
  }
  write(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`);
  write(`startxref\n${startxref}\n%%EOF\n`);
  return Buffer.concat(chunks);
}

interface InkBand {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

async function inkBands(png: Buffer): Promise<InkBand[]> {
  const image = await loadImage(png);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  const { data, width, height } = context.getImageData(0, 0, image.width, image.height);
  const rowDark = new Array<number>(height).fill(0);
  const rowMinX = new Array<number>(height).fill(width);
  const rowMaxX = new Array<number>(height).fill(-1);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4] >= 240) continue;
      rowDark[y] += 1;
      rowMinX[y] = Math.min(rowMinX[y], x);
      rowMaxX[y] = Math.max(rowMaxX[y], x);
    }
  }

  const bands: InkBand[] = [];
  let start = -1;
  for (let y = 0; y <= height; y++) {
    const filled = y < height && rowDark[y] > 0;
    if (filled && start < 0) start = y;
    if (!filled && start >= 0) {
      let minX = width;
      let maxX = -1;
      let dark = 0;
      for (let row = start; row < y; row++) {
        dark += rowDark[row];
        minX = Math.min(minX, rowMinX[row]);
        maxX = Math.max(maxX, rowMaxX[row]);
      }
      if (dark >= 20) bands.push({ minX, maxX, minY: start, maxY: y - 1 });
      start = -1;
    }
  }
  return bands;
}

function bandWidth(band: InkBand | undefined): number {
  return band ? band.maxX - band.minX + 1 : 0;
}
