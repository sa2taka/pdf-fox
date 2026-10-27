// A TrueType Collection (ttcf) packs several faces in one file. Table offsets
// inside a face are from the start of the collection, so a face is not a
// contiguous slice. @napi-rs/canvas loads only face 0, and the name passed to
// registerFromPath is an extra family name for that face, not a face selector.

const TTC_TAG = 0x74746366;
const TABLE_DIRECTORY_ENTRY_SIZE = 16;
const SFNT_HEADER_SIZE = 12;

export interface FontFace {
  /** Standalone sfnt bytes for this face. Safe to pass to GlobalFonts.register. */
  readonly bytes: Buffer;
  readonly faceCount: number;
  readonly faceIndex: number;
}

export function readFontFace(file: Buffer, faceIndex: number): FontFace {
  if (!Number.isInteger(faceIndex) || faceIndex < 0) {
    throw new Error("faceIndex must be a non-negative integer.");
  }
  if (file.length < SFNT_HEADER_SIZE) {
    throw new Error("Font file is too small.");
  }
  if (file.readUInt32BE(0) === TTC_TAG) {
    return readCollectionFace(file, faceIndex);
  }
  if (faceIndex !== 0) {
    throw new Error(`faceIndex ${faceIndex} is out of range. This font file has 1 face.`);
  }
  return { bytes: file, faceCount: 1, faceIndex: 0 };
}

function readCollectionFace(file: Buffer, faceIndex: number): FontFace {
  if (file.length < 12) {
    throw new Error("Font collection is too small.");
  }
  const faceCount = file.readUInt32BE(8);
  if (faceCount < 1 || 12 + faceCount * 4 > file.length) {
    throw new Error("Font collection header is invalid.");
  }
  if (faceIndex >= faceCount) {
    throw new Error(
      `faceIndex ${faceIndex} is out of range. This font collection has ${faceCount} faces.`,
    );
  }
  const faceOffset = file.readUInt32BE(12 + faceIndex * 4);
  return { bytes: extractSfnt(file, faceOffset), faceCount, faceIndex };
}

interface SfntTable {
  readonly tag: Buffer;
  readonly checksum: number;
  readonly offset: number;
  readonly length: number;
}

function extractSfnt(file: Buffer, faceOffset: number): Buffer {
  if (faceOffset < 0 || faceOffset + SFNT_HEADER_SIZE > file.length) {
    throw new Error("Font collection face offset is outside the file.");
  }
  const numTables = file.readUInt16BE(faceOffset + 4);
  const directoryEnd = faceOffset + SFNT_HEADER_SIZE + numTables * TABLE_DIRECTORY_ENTRY_SIZE;
  if (directoryEnd > file.length) {
    throw new Error("Font collection face directory is outside the file.");
  }

  const tables: SfntTable[] = [];
  for (let index = 0; index < numTables; index++) {
    const entry = faceOffset + SFNT_HEADER_SIZE + index * TABLE_DIRECTORY_ENTRY_SIZE;
    const offset = file.readUInt32BE(entry + 8);
    const length = file.readUInt32BE(entry + 12);
    if (offset + length > file.length) {
      throw new Error("A font table extends past the end of the collection.");
    }
    tables.push({
      tag: file.subarray(entry, entry + 4),
      checksum: file.readUInt32BE(entry + 4),
      offset,
      length,
    });
  }

  let cursor = SFNT_HEADER_SIZE + numTables * TABLE_DIRECTORY_ENTRY_SIZE;
  const placed = tables.map((table) => {
    cursor = align4(cursor);
    const start = cursor;
    cursor += table.length;
    return start;
  });

  const bytes = Buffer.alloc(cursor);
  file.copy(bytes, 0, faceOffset, faceOffset + SFNT_HEADER_SIZE);
  tables.forEach((table, index) => {
    const entry = SFNT_HEADER_SIZE + index * TABLE_DIRECTORY_ENTRY_SIZE;
    table.tag.copy(bytes, entry);
    bytes.writeUInt32BE(table.checksum, entry + 4);
    bytes.writeUInt32BE(placed[index], entry + 8);
    bytes.writeUInt32BE(table.length, entry + 12);
    file.copy(bytes, placed[index], table.offset, table.offset + table.length);
  });
  // Table bytes are unchanged, so their checksums stay valid. The font-level
  // checkSumAdjustment is not recomputed; Canvas loads the face without it.
  return bytes;
}

function align4(offset: number): number {
  return (offset + 3) & ~3;
}
