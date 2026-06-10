import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { describe, it, expect } from "vitest";
import { convertPdfToPng, convertPdfPageToPng } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const samplePdfPath = resolve(__dirname, "fixtures/sample.pdf");

function loadSamplePdf(): Buffer {
  return readFileSync(samplePdfPath);
}

describe("convertPdfToPng", () => {
  it("全ページをPNGに変換する", async () => {
    const pdf = loadSamplePdf();

    const pages = await convertPdfToPng(pdf);

    expect(pages).toHaveLength(2);
  });

  it("変換結果にページ番号・幅・高さが含まれる", async () => {
    const pdf = loadSamplePdf();

    const pages = await convertPdfToPng(pdf);

    expect(pages[0].pageNumber).toBe(1);
    expect(pages[0].width).toBeGreaterThan(0);
    expect(pages[0].height).toBeGreaterThan(0);
    expect(pages[1].pageNumber).toBe(2);
  });

  it("変換結果のdataはPNGバイナリ", async () => {
    const pdf = loadSamplePdf();

    const pages = await convertPdfToPng(pdf);

    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(pages[0].data.subarray(0, 8)).toEqual(pngSignature);
  });

  it("scaleオプションで解像度を変更できる", async () => {
    const pdf = loadSamplePdf();

    const [normal, scaled] = await Promise.all([
      convertPdfToPng(pdf, { scale: 1.0 }),
      convertPdfToPng(pdf, { scale: 2.0 }),
    ]);

    expect(scaled[0].width).toBeCloseTo(normal[0].width * 2, -1);
    expect(scaled[0].height).toBeCloseTo(normal[0].height * 2, -1);
  });

  it("Uint8Arrayを入力として受け付ける", async () => {
    const pdf = loadSamplePdf();
    const uint8 = new Uint8Array(pdf);

    const pages = await convertPdfToPng(uint8);

    expect(pages).toHaveLength(2);
  });
});

describe("convertPdfPageToPng", () => {
  it("指定ページのみ変換する", async () => {
    const pdf = loadSamplePdf();

    const page = await convertPdfPageToPng(pdf, 1);

    expect(page.pageNumber).toBe(1);
    expect(page.data.length).toBeGreaterThan(0);
  });

  it("2ページ目を指定して変換できる", async () => {
    const pdf = loadSamplePdf();

    const page = await convertPdfPageToPng(pdf, 2);

    expect(page.pageNumber).toBe(2);
  });

  it("変換結果はPNGバイナリ", async () => {
    const pdf = loadSamplePdf();

    const page = await convertPdfPageToPng(pdf, 1);

    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(page.data.subarray(0, 8)).toEqual(pngSignature);
  });
});
