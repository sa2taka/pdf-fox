import { readFileSync } from "fs";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import { readFontFace } from "../src/font-face.js";

// Face 0 is proportional "Test Sans JP". Face 1 is "Test Mono JP" (advance 1000).
const collectionPath = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures/fonts/collection.ttc");

describe("readFontFace", () => {
  it("loads the first collection face from a path and a later face by index", () => {
    expect(GlobalFonts.registerFromPath(collectionPath, "CollectionAlias")).not.toBeNull();
    expect(GlobalFonts.has("Test Sans JP")).toBe(true);
    expect(GlobalFonts.has("Test Mono JP")).toBe(false);
    expect(GlobalFonts.has("CollectionAlias")).toBe(true);

    const face = readFontFace(readFileSync(collectionPath), 1);

    expect(face.faceCount).toBe(2);
    expect(GlobalFonts.register(face.bytes)).not.toBeNull();
    expect(GlobalFonts.has("Test Mono JP")).toBe(true);
    expect(textWidth("Test Mono JP")).toBeCloseTo(40, 0);
  });

  it("rejects a face index past the end of a collection", () => {
    expect(() => readFontFace(readFileSync(collectionPath), 2)).toThrow(/2 faces/);
  });
});

function textWidth(family: string): number {
  const canvas = createCanvas(10, 10);
  const context = canvas.getContext("2d");
  context.font = `40px "${family}"`;
  return context.measureText("あ").width;
}
