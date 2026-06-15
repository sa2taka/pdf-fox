# pdf-fox

PDF to PNG converter for Node.js, powered by [PDF.js](https://mozilla.github.io/pdf.js/) and [@napi-rs/canvas](https://github.com/Brooooooklyn/canvas).

## Install

```bash
npm install pdf-fox
```

## CLI

```bash
# 全ページ変換
npx pdf-fox input.pdf

# 出力先ディレクトリを指定
npx pdf-fox input.pdf -o output/

# 特定ページのみ
npx pdf-fox input.pdf -p 2

# 解像度指定（デフォルト: 200 DPI）
npx pdf-fox input.pdf --dpi 300
```

```
Options:
  -o, --output <path>       出力先ディレクトリまたはファイルパス
  -p, --page <number>       変換するページ番号（省略時は全ページ）
  -r, --dpi <number>        解像度 DPI（デフォルト: 200）
  -b, --background <color>  背景色（デフォルト: white）
  -h, --help                ヘルプを表示
  -V, --version             バージョンを表示
```

## Library

```ts
import { convertPdfToPng, convertPdfPageToPng } from "pdf-fox";
import { readFileSync } from "fs";

const pdf = readFileSync("input.pdf");

// 全ページ
const pages = await convertPdfToPng(pdf);
// => [{ pageNumber: 1, data: Buffer, width: number, height: number }, ...]

// 特定ページ
const page = await convertPdfPageToPng(pdf, 1, { scale: 2.0 });
```

### Options

| オプション | 型 | デフォルト | 説明 |
|---|---|---|---|
| `scale` | `number` | `1.5` | レンダリングスケール（1.0 = 72 DPI） |
| `background` | `string` | `"white"` | 背景色（CSS カラー文字列） |

## Requirements

- Node.js 18+
