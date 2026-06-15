# pdf-fox

[PDF.js](https://mozilla.github.io/pdf.js/) と [@napi-rs/canvas](https://github.com/Brooooooklyn/canvas) を使った Node.js 向け PDF → PNG 変換ライブラリ。

## インストール

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
  -f, --font <name=path>    埋め込まれていないフォントの代替を指定（複数指定可）
  -h, --help                ヘルプを表示
  -V, --version             バージョンを表示
```

### 埋め込まれていないフォント

PDF がフォントを参照しているのに埋め込んでいない場合、その文字は空白の箱
として描画される。PDF が使うフォント名を指定して、手元のフォントファイルを
代替として渡す:

```bash
npx pdf-fox input.pdf -f "MSMincho=~/Library/Fonts/msmincho.ttc"
```

名前（`MSMincho`）は PDF 内のフォント名からサブセット接頭辞（`+` より前）を
除いたもの。フォント名は `pdffonts input.pdf` で確認できる。

## ライブラリ

```ts
import { convertPdfToPng, convertPdfPageToPng } from "pdf-fox";
import { readFileSync } from "fs";

const pdf = readFileSync("input.pdf");

// 全ページ
const pages = await convertPdfToPng(pdf);
// => [{ pageNumber: 1, data: Buffer, width: number, height: number }, ...]

// 特定ページ
const page = await convertPdfPageToPng(pdf, 1, { scale: 2.0 });

// 埋め込まれていないフォントを代替
const rendered = await convertPdfToPng(pdf, {
  fonts: { MSMincho: "/path/to/msmincho.ttc" },
});
```

### オプション

| オプション | 型 | デフォルト | 説明 |
|---|---|---|---|
| `scale` | `number` | `1.5` | レンダリングスケール（1.0 = 72 DPI） |
| `background` | `string` | `"white"` | 背景色（CSS カラー文字列） |
| `fonts` | `Record<string, string>` | `{}` | 埋め込まれていないフォントの代替。PDF 内のフォント名を手元のフォントファイルパスに対応付ける |

## 動作要件

- Node.js 18+
