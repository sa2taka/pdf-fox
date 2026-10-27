import { readFileSync } from "fs";
import { resolve } from "path";
import { GlobalFonts } from "@napi-rs/canvas";
import { readFontFace } from "./font-face.js";
import {
  GENERIC_FONT_FAMILIES,
  type ConvertOptions,
  type FallbackFont,
  type GenericFontFamily,
} from "./types.js";

// Preference order across macOS, Windows, and common Linux installs.
// The first family GlobalFonts.has reports is the one Canvas can draw with.
// fontconfig's fc-match names are not consulted: a later face of a collection
// is visible to fontconfig and invisible here, because Canvas loads face 0 only.
const CJK_SERIF_FONTS = [
  "Hiragino Mincho ProN",
  "YuMincho",
  "Yu Mincho",
  "MS Mincho",
  "Noto Serif CJK JP",
  "Noto Serif JP",
  "Source Han Serif JP",
  "IPAexMincho",
];
const CJK_SANS_FONTS = [
  "Hiragino Sans",
  "Hiragino Kaku Gothic ProN",
  "YuGothic",
  "Yu Gothic",
  "Meiryo",
  "MS Gothic",
  "Noto Sans CJK JP",
  "Noto Sans JP",
  "Source Han Sans JP",
  "IPAexGothic",
];
// Japanese monospace families, when Canvas has loaded that face under its own
// name (a standalone file, face 0 of its collection, or every face on macOS).
// "Noto Sans Mono CJK JP" inside the combined Noto Sans CJK collection is a
// later face, so has() is false until the caller passes that faceIndex.
const CJK_MONO_FONTS = [
  "Noto Sans Mono CJK JP",
  "Noto Sans Mono JP",
  "Source Han Mono",
  "Sarasa Mono J",
  "Sarasa Gothic J",
  "PlemolJP",
  "IPAGothic",
  "MS Gothic",
];

type Request =
  | { readonly kind: "automatic"; readonly candidates: readonly string[] }
  | { readonly kind: "family"; readonly family: string }
  | { readonly kind: "file"; readonly path: string; readonly faceIndex: number };

// @napi-rs/canvas keeps one font collection for the process. setAlias adds a
// typeface under the generic name; a later setAlias for the same name does not
// replace the first typeface, and drawing keeps using it. Families that were
// left unset can still be set. A family that was set cannot be changed.
const applied: Record<GenericFontFamily, string | null> = {
  serif: null,
  "sans-serif": null,
  monospace: null,
};
// Registration name per font file face, so each face is registered once.
const registeredFaces = new Set<string>();

export function prepareGenericFontFallback(options?: ConvertOptions): void {
  const requests = parseRequests(options);
  const targets = resolveTargets(requests);
  for (const generic of GENERIC_FONT_FAMILIES) {
    rejectConflict(generic, targets[generic]);
  }
  for (const generic of GENERIC_FONT_FAMILIES) {
    const request = requests[generic];
    if (request.kind === "file") registerFace(generic, request);
  }
  for (const generic of GENERIC_FONT_FAMILIES) {
    assignFamily(generic, targets[generic], requests[generic].kind !== "automatic");
  }
}

function parseRequests(options?: ConvertOptions): Record<GenericFontFamily, Request> {
  const requested = options?.fallbackFonts ?? {};
  rejectUnknownFamilies(requested);
  const automatic = options?.systemFontFallback !== false;
  return {
    serif: parseRequest("serif", requested.serif, automatic ? CJK_SERIF_FONTS : []),
    "sans-serif": parseRequest(
      "sans-serif",
      requested["sans-serif"],
      automatic ? CJK_SANS_FONTS : [],
    ),
    monospace: parseRequest(
      "monospace",
      requested.monospace,
      automatic ? monospaceCandidates() : [],
    ),
  };
}

function rejectUnknownFamilies(requested: NonNullable<ConvertOptions["fallbackFonts"]>): void {
  for (const key of Object.keys(requested)) {
    if (!GENERIC_FONT_FAMILIES.some((family) => family === key)) {
      throw new Error(
        `Unknown fallbackFonts key "${key}". Expected serif, sans-serif, or monospace.`,
      );
    }
  }
}

// A proportional CJK sans is the stand-in when no monospace face is visible.
// Japanese glyphs in those families are full-width (about 1em), so they sit
// close to the PDF's 1000-unit advances. Latin in the same face is narrower,
// and PDF.js recenters a glyph when its measured width differs from the PDF's.
function monospaceCandidates(): readonly string[] {
  return [...CJK_MONO_FONTS, ...CJK_SANS_FONTS];
}

function parseRequest(
  generic: GenericFontFamily,
  source: FallbackFont | undefined,
  automaticCandidates: readonly string[],
): Request {
  if (source === undefined) {
    return { kind: "automatic", candidates: automaticCandidates };
  }
  const hasFamily = "family" in source;
  const hasPath = "path" in source;
  if (hasFamily === hasPath) {
    throw new Error(`fallbackFonts.${generic} must set exactly one of family or path.`);
  }
  if ("family" in source) {
    return { kind: "family", family: nonEmptyString(generic, "family", source.family) };
  }
  const faceIndex = source.faceIndex ?? 0;
  if (!Number.isInteger(faceIndex) || faceIndex < 0) {
    throw new Error(`fallbackFonts.${generic}.faceIndex must be a non-negative integer.`);
  }
  return { kind: "file", path: resolve(nonEmptyString(generic, "path", source.path)), faceIndex };
}

function nonEmptyString(generic: GenericFontFamily, field: string, value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`fallbackFonts.${generic}.${field} must be a non-empty string.`);
  }
  return value;
}

function resolveTargets(
  requests: Record<GenericFontFamily, Request>,
): Record<GenericFontFamily, string | null> {
  return {
    serif: resolveTarget("serif", requests.serif),
    "sans-serif": resolveTarget("sans-serif", requests["sans-serif"]),
    monospace: resolveTarget("monospace", requests.monospace),
  };
}

// An automatic family that is already set keeps its value. Searching again
// could find a font registered since then and report a false conflict.
function resolveTarget(generic: GenericFontFamily, request: Request): string | null {
  switch (request.kind) {
    case "automatic":
      if (request.candidates.length === 0) return null;
      return applied[generic] ?? request.candidates.find((name) => GlobalFonts.has(name)) ?? null;
    case "family":
      if (!GlobalFonts.has(request.family)) {
        throw new Error(
          `Canvas has no font family "${request.family}" for the ${generic} fallback. ` +
            `fallbackFonts.${generic}.family must be a family GlobalFonts already lists.`,
        );
      }
      return request.family;
    case "file":
      return faceRegistrationName(request.path, request.faceIndex);
  }
}

// A name only this face carries, so the alias cannot land on another installed
// face that shares the font's own family name.
function faceRegistrationName(path: string, faceIndex: number): string {
  return `pdf-fox fallback ${path}#${faceIndex}`;
}

function rejectConflict(generic: GenericFontFamily, target: string | null): void {
  const previous = applied[generic];
  if (previous === null || previous === target) return;
  const requestedText = target === null ? "leave it unset" : `set it to "${target}"`;
  throw new Error(
    `pdf-fox already set the ${generic} fallback to "${previous}" in this process, ` +
      `and this conversion would ${requestedText}. ` +
      "@napi-rs/canvas keeps a single font collection per process, and a later alias " +
      "for the same generic family does not replace the first one. " +
      "Use one systemFontFallback and fallbackFonts configuration per process.",
  );
}

function registerFace(
  generic: GenericFontFamily,
  request: Extract<Request, { kind: "file" }>,
): void {
  const name = faceRegistrationName(request.path, request.faceIndex);
  if (registeredFaces.has(name)) return;
  const face = readRequestedFace(generic, request.path, request.faceIndex);
  if (GlobalFonts.register(face.bytes, name) === null || !GlobalFonts.has(name)) {
    throw new Error(
      `Canvas could not register face ${request.faceIndex} of ${request.path} for the ${generic} fallback.`,
    );
  }
  registeredFaces.add(name);
}

function readRequestedFace(
  generic: GenericFontFamily,
  path: string,
  faceIndex: number,
): ReturnType<typeof readFontFace> {
  try {
    return readFontFace(readFileSync(path), faceIndex);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot use ${path} as the ${generic} fallback: ${detail}`);
  }
}

function assignFamily(generic: GenericFontFamily, target: string | null, explicit: boolean): void {
  if (target === null || applied[generic] === target) return;
  if (!GlobalFonts.setAlias(target, generic)) {
    if (explicit) {
      throw new Error(`Canvas could not alias "${target}" as ${generic}.`);
    }
    return;
  }
  applied[generic] = target;
}
