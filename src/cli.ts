#!/usr/bin/env node
import { parseArgs } from "util";
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "fs";
import { resolve, basename, extname, dirname, join } from "path";
import { homedir } from "os";
import { createRequire } from "module";
import { convertPdfToPng, convertPdfPageToPng } from "./index.js";
import type { PngPage } from "./types.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const PDF_BASE_DPI = 72;
const DEFAULT_DPI = 200;

const HELP = `\
Usage: pdf-fox <input.pdf> [options]

Arguments:
  input.pdf                 変換するPDFファイルのパス

Options:
  -o, --output <path>       出力先ディレクトリまたはファイルパス
                            省略時は入力ファイルと同じディレクトリ
  -p, --page <number>       変換するページ番号（省略時は全ページ）
  -r, --dpi <number>        解像度 DPI（デフォルト: ${DEFAULT_DPI}）
  -b, --background <color>  背景色（デフォルト: white）
  -f, --font <name=path>    PDF が埋め込んでいないフォントの代替を指定
                            （複数指定可。name は PDF 内のフォント名）
      --no-system-fonts     CJK システムフォントへの自動フォールバックを無効化
  -h, --help                ヘルプを表示
  -V, --version             バージョンを表示

Examples:
  pdf-fox doc.pdf                     全ページ変換 → doc-1.png, doc-2.png ...
  pdf-fox doc.pdf -o out/             出力先ディレクトリを指定
  pdf-fox doc.pdf -p 2                2ページ目のみ変換
  pdf-fox doc.pdf -p 1 -o cover.png   1ページ目を cover.png として保存
  pdf-fox doc.pdf --dpi 300           300 DPI で変換
  pdf-fox doc.pdf -f MSMincho=~/Library/Fonts/msmincho.ttc
`;

interface CliArgs {
  inputPath: string;
  outputOption: string | undefined;
  page: number | undefined;
  dpi: number;
  background: string;
  fonts: Record<string, string>;
  systemFontFallback: boolean;
}

// OutputSpec はディレクトリ出力か明示ファイル出力かを区別する
type OutputSpec =
  | { kind: "directory"; dir: string; stem: string }
  | { kind: "file"; path: string };

function parseCliArgs(): CliArgs {
  const { values, positionals } = parseArgs({
    options: {
      output:     { type: "string",  short: "o" },
      page:       { type: "string",  short: "p" },
      dpi:        { type: "string",  short: "r" },
      background: { type: "string",  short: "b" },
      font:       { type: "string",  short: "f", multiple: true },
      "no-system-fonts": { type: "boolean" },
      help:       { type: "boolean", short: "h" },
      version:    { type: "boolean", short: "V" },
    },
    allowPositionals: true,
  });

  if (values.help) {
    process.stdout.write(HELP);
    process.exit(0);
  }

  if (values.version) {
    process.stdout.write(`${version}\n`);
    process.exit(0);
  }

  if (positionals.length === 0) {
    process.stderr.write("Error: PDFファイルのパスを指定してください\n\n");
    process.stderr.write(HELP);
    process.exit(1);
  }

  const page = values.page !== undefined ? Number(values.page) : undefined;
  if (page !== undefined && (!Number.isInteger(page) || page < 1)) {
    exitWithError("--page は 1 以上の整数を指定してください");
  }

  const dpi = values.dpi !== undefined ? Number(values.dpi) : DEFAULT_DPI;
  if (isNaN(dpi) || dpi <= 0) {
    exitWithError("--dpi は正の数を指定してください");
  }

  return {
    inputPath: positionals[0],
    outputOption: values.output,
    page,
    dpi,
    background: values.background ?? "white",
    fonts: parseFontMappings(values.font),
    systemFontFallback: !values["no-system-fonts"],
  };
}

// Parses repeated `--font name=path` values into a name → path map.
function parseFontMappings(values: string[] | undefined): Record<string, string> {
  const fonts: Record<string, string> = {};
  for (const value of values ?? []) {
    const separator = value.indexOf("=");
    if (separator <= 0) {
      exitWithError(`--font は "name=path" 形式で指定してください: ${value}`);
    }
    const name = value.slice(0, separator);
    const path = value.slice(separator + 1);
    fonts[name] = resolveHome(path);
  }
  return fonts;
}

// Expands a leading "~" to the user's home directory.
function resolveHome(path: string): string {
  if (path === "~" || path.startsWith("~/")) {
    return join(homedir(), path.slice(1));
  }
  return path;
}

function resolveOutputSpec(inputPath: string, outputOption: string | undefined): OutputSpec {
  const stem = basename(inputPath, extname(inputPath));

  if (!outputOption) {
    return { kind: "directory", dir: dirname(resolve(inputPath)), stem };
  }

  const resolved = resolve(outputOption);

  // 末尾スラッシュ or 既存ディレクトリはディレクトリ出力として扱う
  if (outputOption.endsWith("/") || (existsSync(resolved) && statSync(resolved).isDirectory())) {
    return { kind: "directory", dir: resolved, stem };
  }

  return { kind: "file", path: resolved };
}

function buildOutputPath(spec: OutputSpec, pageNumber: number): string {
  if (spec.kind === "file") return spec.path;
  return join(spec.dir, `${spec.stem}-${pageNumber}.png`);
}

function writePage(outputPath: string, page: PngPage): void {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, page.data);
  process.stdout.write(`${outputPath}\n`);
}

function exitWithError(message: string): never {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
}

async function run(): Promise<void> {
  const { inputPath, outputOption, page, dpi, background, fonts, systemFontFallback } =
    parseCliArgs();
  const scale = dpi / PDF_BASE_DPI;

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = readFileSync(resolve(inputPath));
  } catch {
    exitWithError(`ファイルを読み込めません: ${inputPath}`);
  }

  const outputSpec = resolveOutputSpec(inputPath, outputOption);

  if (page !== undefined) {
    let result: PngPage;
    try {
      result = await convertPdfPageToPng(pdfBuffer, page, {
        scale,
        background,
        fonts,
        systemFontFallback,
      });
    } catch (err) {
      exitWithError(err instanceof Error ? err.message : String(err));
    }
    writePage(buildOutputPath(outputSpec, result.pageNumber), result);
    return;
  }

  let pages: PngPage[];
  try {
    pages = await convertPdfToPng(pdfBuffer, { scale, background, fonts, systemFontFallback });
  } catch (err) {
    exitWithError(err instanceof Error ? err.message : String(err));
  }

  if (outputSpec.kind === "file" && pages.length > 1) {
    exitWithError(
      `複数ページ(${pages.length}ページ)のPDFを1ファイルに出力できません。` +
      `-o にディレクトリを指定するか、-p でページを指定してください`,
    );
  }

  for (const p of pages) {
    writePage(buildOutputPath(outputSpec, p.pageNumber), p);
  }
}

run().catch((err) => {
  exitWithError(err instanceof Error ? err.message : String(err));
});
