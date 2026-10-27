# pdf-fox

[PDF.js](https://mozilla.github.io/pdf.js/) と [@napi-rs/canvas](https://github.com/Brooooooklyn/canvas) を使った Node.js 向け PDF → PNG 変換ライブラリ。

## インストール

```bash
npm install pdf-fox
```

## CLI

```bash
# 全ページ変換 → 入力と同じ場所に 1.png, 2.png, ...
npx pdf-fox input.pdf

# 出力先ディレクトリを指定 → output/1.png, output/2.png, ...
npx pdf-fox input.pdf -o output/

# 特定ページのみ → 2.png
npx pdf-fox input.pdf -p 2

# 1ページを明示ファイル名で保存
npx pdf-fox input.pdf -p 1 -o cover.png

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
      --no-system-fonts     serif / sans-serif / monospace の CJK 自動フォールバックを無効化
      --bold <px>           テキストを太らせる幅 px（例: 0.6。デフォルト: 0=無効）
      --verbosity <level>   PDF.js のログレベル（errors, warnings, infos。デフォルト: errors）
  -h, --help                ヘルプを表示
  -V, --version             バージョンを表示
```

### 文字が細く見えるとき

PDF.js は字形のアウトラインを忠実に塗るため、ブラウザ（macOS では追加のフォントスムージングが効く）より細く見えることがある。`--bold`（ライブラリでは `stemDarkening`）で太らせられる。例: `--bold 0.6`。

### 埋め込まれていないフォント

PDF がフォントを参照しているのに埋め込んでいない場合、その文字は本来なら空白の箱になる。pdf-fox は既定で、`serif`、`sans-serif`、`monospace` を利用可能な CJK システムフォント（Hiragino、Yu、MS、Noto など）に向ける。インストール済みフォントに依存しない出力が欲しいときは `--no-system-fonts` で無効化できる。

特定のフォントを使いたいときは、PDF が使うフォント名で手元のファイルを渡す:

```bash
npx pdf-fox input.pdf -f "MSMincho=~/Library/Fonts/msmincho.ttc"
```

名前（`MSMincho`）は PDF 内のフォント名からサブセット接頭辞（`+` より前）を除いたもの。フォント名は `pdffonts input.pdf` で確認できる。

`serif`、`sans-serif`、`monospace` を自分で指定するときは `fallbackFonts` を渡す。プロセス内で最初に割り当てたフォントが残る。

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

// PDF が名指ししているフォントを代替する
const rendered = await convertPdfToPng(pdf, {
  fonts: { MSMincho: "/path/to/msmincho.ttc" },
});

// 総称ファミリーを指定する。family はインストール済み、path はファイル。
const pinned = await convertPdfPageToPng(pdf, 1, {
  fallbackFonts: {
    monospace: { family: "Noto Sans CJK JP" },
  },
});
```

### オプション

| オプション | 型 | デフォルト | 説明 |
|---|---|---|---|
| `scale` | `number` | `1.5` | レンダリングスケール（1.0 = 72 DPI） |
| `background` | `string` | `"white"` | 背景色（CSS カラー文字列） |
| `fonts` | `Record<string, string>` | `{}` | PDF のフォント名で手元のファイルを登録する（先頭フェイス）。その名前は総称ファミリーより先に試される |
| `systemFontFallback` | `boolean` | `true` | `serif`、`sans-serif`、`monospace` を Canvas が描ける CJK フォントに向ける。`monospace` は日本語の等幅を優先し、無ければプロポーショナルな CJK ゴシックを使う。プロセス内で最初の割り当てが残る。フォント非依存の出力では無効化する |
| `fallbackFonts` | `{ family }` または `{ path, faceIndex? }` の一部 |  | 総称ファミリーを個別に上書きする。`systemFontFallback: false` でも有効。プロセス内の制約は上記 |
| `stemDarkening` | `number` | `0` | 字形アウトラインを指定幅（出力px）でストロークしてテキストを太らせる。ブラウザのフォントスムージング相当。`0` で無効。`0.5`〜`1.0` 推奨 |
| `verbosity` | `"errors" \| "warnings" \| "infos"` | `"errors"` | PDF.js のログレベル。`warnings` で警告も、`infos` で情報ログも出す |

## 動作要件

- Node.js 18+
