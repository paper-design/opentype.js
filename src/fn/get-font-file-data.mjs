import parse from '../parse.mjs';
import { parseOpenTypeTableEntries } from './parse-opentype-table-entries.mjs';
import { parseWOFFTableEntries } from './parse-woff-table-entries.mjs';
import { parseNameTable } from './parse-name-table.mjs';
import { parseLtagTable } from './parse-ltag-table.mjs';
import { uncompressTable } from './uncompress-table.mjs';
import { getNameByID } from './get-name-by-id.mjs';

const TRUETYPE_SIGNATURE = String.fromCharCode(0, 1, 0, 0);

// Reads the sfnt table directory of a single font that begins at `fontOffset`.
// `fontOffset` is 0 for a standalone font, or the font's offset within a collection (ttcf).
function parseSfntFont(data, fontOffset) {
    const signature = parse.getTag(data, fontOffset);
    let outlinesFormat;
    if (signature === TRUETYPE_SIGNATURE || signature === 'true' || signature === 'typ1') {
        outlinesFormat = 'truetype';
    } else if (signature === 'OTTO') {
        outlinesFormat = 'cff';
    } else {
        throw new Error('Unsupported OpenType signature ' + signature);
    }

    const numTables = parse.getUShort(data, fontOffset + 4);
    const tableEntries = parseOpenTypeTableEntries(data, numTables, fontOffset);
    return { tableEntries, outlinesFormat };
}

// Reads the PostScript name (name ID 6) of a font from its parsed table entries.
// Returns a map of language code to name, or undefined when the font has no name table.
function getPostScriptNames(data, tableEntries) {
    const nameTableEntry = tableEntries.find((entry) => entry.tag === 'name');
    if (!nameTableEntry) {
        return undefined;
    }

    let ltag = [];
    const ltagTableEntry = tableEntries.find((entry) => entry.tag === 'ltag');
    if (ltagTableEntry) {
        const ltagTable = uncompressTable(data, ltagTableEntry);
        ltag = parseLtagTable(ltagTable.data, ltagTable.offset);
    }

    const nameTable = uncompressTable(data, nameTableEntry);
    const names = parseNameTable(nameTable.data, nameTable.offset, ltag);
    return getNameByID(names, 6);
}

// Selects a single font from a TrueType/OpenType Collection (ttcf) by its PostScript name.
// This mirrors fontkit's TrueTypeCollection#getFont(name): the collection bundles several fonts
// that share tables, so the caller must specify which face they want.
function selectCollectionFont(data, postScriptName) {
    if (!postScriptName) {
        throw new Error('A postScriptName is required to select a font from a collection (ttcf)');
    }

    // ttcf header: tag (4), version (4), numFonts (4), then numFonts × uint32 font offsets.
    const numFonts = parse.getULong(data, 8);
    for (let i = 0; i < numFonts; i += 1) {
        const fontOffset = parse.getULong(data, 12 + i * 4);
        const font = parseSfntFont(data, fontOffset);
        const postScriptNames = getPostScriptNames(data, font.tableEntries);
        if (postScriptNames && Object.values(postScriptNames).includes(postScriptName)) {
            return font;
        }
    }

    throw new Error('No font matching postScriptName "' + postScriptName + '" found in collection (ttcf)');
}

/**
 * @param {ArrayBuffer}
 * @param {string} [postScriptName] PostScript name of the font to select from a collection (ttcf).
 */
export function getFontFileData(buffer, postScriptName) {
    let outlinesFormat = '';

    if (buffer.constructor !== ArrayBuffer) { // convert node Buffer
        buffer = new Uint8Array(buffer).buffer;
    }
    // OpenType fonts use big endian byte ordering.
    // We can't rely on typed array view types, because they operate with the endianness of the host computer.
    // Instead we use DataViews where we can specify endianness.
    const data = new DataView(buffer, 0);
    let numTables;
    let tableEntries = [];
    const signature = parse.getTag(data, 0);
    if (signature === TRUETYPE_SIGNATURE || signature === 'true' || signature === 'typ1') {
        outlinesFormat = 'truetype';
        numTables = parse.getUShort(data, 4);
        tableEntries = parseOpenTypeTableEntries(data, numTables);
    } else if (signature === 'OTTO') {
        outlinesFormat = 'cff';
        numTables = parse.getUShort(data, 4);
        tableEntries = parseOpenTypeTableEntries(data, numTables);
    } else if (signature === 'ttcf') {
        // TrueType/OpenType Collection: multiple fonts bundled in one file, selected by PostScript name.
        const font = selectCollectionFont(data, postScriptName);
        outlinesFormat = font.outlinesFormat;
        tableEntries = font.tableEntries;
    } else if (signature === 'wOFF') {
        const flavor = parse.getTag(data, 4);
        if (flavor === TRUETYPE_SIGNATURE) {
            outlinesFormat = 'truetype';
        } else if (flavor === 'OTTO') {
            outlinesFormat = 'cff';
        } else {
            throw new Error('Unsupported OpenType flavor ' + signature);
        }

        numTables = parse.getUShort(data, 12);
        tableEntries = parseWOFFTableEntries(data, numTables);
    } else if (signature === 'wOF2') {
        var issue = 'https://github.com/opentypejs/opentype.js/issues/183#issuecomment-1147228025';
        throw new Error('WOFF2 require an external decompressor library, see examples at: ' + issue);
    } else {
        throw new Error('Unsupported OpenType signature ' + signature);
    }

    return { data, tableEntries, outlinesFormat };
}
