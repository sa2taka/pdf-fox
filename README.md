# pdf-fox

PDF to PNG converter for Node.js, powered by [PDF.js](https://mozilla.github.io/pdf.js/) and [@napi-rs/canvas](https://github.com/Brooooooklyn/canvas).

[日本語](./README_ja.md)

## Install

```bash
npm install pdf-fox
```

## CLI

```bash
# Convert all pages → 1.png, 2.png, ... next to the input
npx pdf-fox input.pdf

# Specify output directory → output/1.png, output/2.png, ...
npx pdf-fox input.pdf -o output/

# Convert a specific page → 2.png
npx pdf-fox input.pdf -p 2

# Save a single page to an explicit file
npx pdf-fox input.pdf -p 1 -o cover.png

# Set resolution (default: 200 DPI)
npx pdf-fox input.pdf --dpi 300
```

```
Options:
  -o, --output <path>       Output directory or file path
  -p, --page <number>       Page number to convert (default: all pages)
  -r, --dpi <number>        Resolution in DPI (default: 200)
  -b, --background <color>  Background color (default: white)
  -f, --font <name=path>    Substitute font for a non-embedded font (repeatable)
      --no-system-fonts     Disable automatic CJK fallback for serif, sans-serif, and monospace
      --bold <px>           Thicken text by this width in px (e.g. 0.6; default: 0)
      --verbosity <level>   PDF.js diagnostics: errors, warnings, or infos (default: errors)
  -h, --help                Show help
  -V, --version             Show version
```

### Text looks too thin?

PDF.js renders glyph outlines faithfully, so text can look lighter than in a browser, which applies extra font smoothing on macOS. Thicken it with `--bold` (or the `stemDarkening` option), e.g. `--bold 0.6`.

### Non-embedded fonts

If a PDF references a font without embedding it, those glyphs would render as blank boxes. By default pdf-fox points `serif`, `sans-serif`, and `monospace` at an available CJK system font (Hiragino, Yu, MS, Noto, …). Disable this with `--no-system-fonts` for output that doesn't depend on installed fonts.

To use a specific font file under the name the PDF uses:

```bash
npx pdf-fox input.pdf -f "MSMincho=~/Library/Fonts/msmincho.ttc"
```

The name (`MSMincho`) is the PDF's font name without its subset prefix (the part before `+`). You can inspect font names with `pdffonts input.pdf`.

To pin `serif`, `sans-serif`, or `monospace` yourself, pass `fallbackFonts`. The first assignment in a process stays.

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

// Substitute the font the PDF names
const rendered = await convertPdfToPng(pdf, {
  fonts: { MSMincho: "/path/to/msmincho.ttc" },
});

// Pin generic families. `family` is already installed; `path` is a file.
const pinned = await convertPdfPageToPng(pdf, 1, {
  fallbackFonts: {
    monospace: { family: "Noto Sans CJK JP" },
  },
});
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `scale` | `number` | `1.5` | Rendering scale (1.0 = 72 DPI) |
| `background` | `string` | `"white"` | Background color (any CSS color string) |
| `fonts` | `Record<string, string>` | `{}` | Register a local font file under the PDF's font name (face 0). That name is tried before the generic family |
| `systemFontFallback` | `boolean` | `true` | Point `serif`, `sans-serif`, and `monospace` at a CJK font Canvas can draw. `monospace` prefers a Japanese monospace face and otherwise uses a proportional CJK sans. The first assignment in the process sticks. Disable for font-independent output |
| `fallbackFonts` | partial record of `{ family }` or `{ path, faceIndex? }` |  | Override one or more generic families. Used even when `systemFontFallback` is false. See above for the process-wide constraint |
| `stemDarkening` | `number` | `0` | Thicken text by stroking glyph outlines with this width in output pixels, approximating browser font smoothing. `0` disables; try `0.5`–`1.0` |
| `verbosity` | `"errors" \| "warnings" \| "infos"` | `"errors"` | How much of PDF.js's diagnostics to print. `warnings` and `infos` surface messages that `errors` hides |

## Requirements

- Node.js 18+
