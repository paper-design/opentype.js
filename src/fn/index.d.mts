export interface FontFileData {
  data: DataView;
  tableEntries: TableEntry[];
  outlinesFormat: string;
}

export interface TableEntry {
  tag: string;
  checksum: number;
  offset: number;
  length: number;
  compression: boolean;
}

export interface TableData {
  data: DataView;
  offset: number;
}

export interface OS2Table {
  version: number;
  xAvgCharWidth: number;
  usWeightClass: number;
  usWidthClass: number;
  fsType: number;
  ySubscriptXSize: number;
  ySubscriptYSize: number;
  ySubscriptXOffset: number;
  ySubscriptYOffset: number;
  ySuperscriptXSize: number;
  ySuperscriptYSize: number;
  ySuperscriptXOffset: number;
  ySuperscriptYOffset: number;
  yStrikeoutSize: number;
  yStrikeoutPosition: number;
  sFamilyClass: number;
  panose: number[];
  ulUnicodeRange1: number;
  ulUnicodeRange2: number;
  ulUnicodeRange3: number;
  ulUnicodeRange4: number;
  achVendID: string;
  fsSelection: number;
  usFirstCharIndex: number;
  usLastCharIndex: number;
  sTypoAscender: number;
  sTypoDescender: number;
  sTypoLineGap: number;
  usWinAscent: number;
  usWinDescent: number;
  ulCodePageRange1?: number;
  ulCodePageRange2?: number;
  sxHeight?: number;
  sCapHeight?: number;
  usDefaultChar?: number;
  usBreakChar?: number;
  usMaxContent?: number;
}

export type Platform = "unicode" | "macintosh" | "reserved" | "windows";

export type NameTable = {
  [key in Platform]?: Record<string, Record<string, string>>;
};

export interface FvarAxis {
  tag: string;
  minValue: number;
  defaultValue: number;
  maxValue: number;
  axisNameID: number;
  name: Record<string, string>;
  isHidden?: boolean;
}

export interface FvarInstance {
  subfamilyNameID: number;
  name: Record<string, string>;
  coordinates: Record<string, number>;
  postScriptNameID: number;
  postScriptName: Record<string, string>;
}

export interface FvarTable {
  axes: FvarAxis[];
  instances: FvarInstance[];
}

export interface PostTable {
  isFixedPitch: number;
  italicAngle: number;
  maxMemType1: number;
  maxMemType42: number;
  minMemType1: number;
  minMemType42: number;
  underlinePosition: number;
  underlineThickness: number;
  version: number;
}
export interface HeadTable {
  version: number
  fontRevision: number
  checkSumAdjustment: number
  magicNumber: 0x5F0F3CF5
  flags: number
  unitsPerEm: number
  created: number
  modified: number
  xMin: number
  yMin: number
  xMax: number
  yMax: number
  macStyle: number
  lowestRecPPEM: number
  fontDirectionHint: number
  indexToLocFormat: number
  glyphDataFormat: number
}

export function uncompressTable(
  data: DataView,
  tableEntry: TableEntry
): TableData;

export function getFontFileData(buffer: ArrayBuffer): FontFileData;
export function parseHeadTable(data: DataView, offset: number): HeadTable;
export function parseLtagTable(data: DataView, offset: number): string[];
export function parseOS2Table(data: DataView, offset: number): OS2Table;
export function parsePostTable(data: DataView, offset: number): PostTable;

export function parseNameTable(
  data: DataView,
  offset: number,
  ltag: string[]
): NameTable;

export function parseFvarTable(
  data: DataView,
  offset: number,
  names: NameTable
): FvarTable;
