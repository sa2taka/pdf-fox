# pdf-fox

PDF to PNG converter for Node.js, powered by [PDF.js](https://mozilla.github.io/pdf.js/) and [@napi-rs/canvas](https://github.com/Brooooooklyn/canvas).

[日本語](./README_ja.md)

## Install

```bash
npm install pdf-fox
```

## CLI

```bash
# Convert all pages
npx pdf-fox input.pdf

# Specify output directory
npx pdf-fox input.pdf -o output/

# Convert a specific page
npx pdf-fox input.pdf -p 2

# Set resolution (default: 200 DPI)
npx pdf-fox input.pdf --dpi 300
```

```
Options:
  -o, --output <path>       Output directory or file path
  -p, --page <number>       Page number to convert (default: all pages)
  -r, --dpi <number>        Resolution in DPI (default: 200)
  -b, --background <color>  Background color (default: white)
  -h, --help                Show help
  -V, --version             Show version
```

## Library

```ts
import { convertPdfToPng, convertPdfPageToPng } from "pdf-fox";
import { readFileSync } from "fs";

const pdf = readFileSync("input.pdf");

// All pages
const pages = await convertPdfToPng(pdf);
// => [{ pageNumber: 1, data: Buffer, width: number, height: number }, ...]

// Specific page
const page = await convertPdfPageToPng(pdf, 1, { scale: 2.0 });
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `scale` | `number` | `1.5` | Rendering scale (1.0 = 72 DPI) |
| `background` | `string` | `"white"` | Background color (any CSS color string) |

## Requirements

- Node.js 18+
