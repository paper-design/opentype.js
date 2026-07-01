import assert from 'assert';
import { readFileSync } from 'fs';
import {
    getFontFileData,
    parseNameTable,
    parseLtagTable,
    uncompressTable,
    getNameByID,
} from '../src/fn/index.mjs';

function toArrayBuffer(nodeBuffer) {
    return nodeBuffer.buffer.slice(nodeBuffer.byteOffset, nodeBuffer.byteOffset + nodeBuffer.byteLength);
}

// Reads the parsed name table from a font's table entries.
function readNames(data, tableEntries) {
    let ltag = [];
    const ltagEntry = tableEntries.find((entry) => entry.tag === 'ltag');
    if (ltagEntry) {
        const ltagTable = uncompressTable(data, ltagEntry);
        ltag = parseLtagTable(ltagTable.data, ltagTable.offset);
    }

    const nameEntry = tableEntries.find((entry) => entry.tag === 'name');
    const nameTable = uncompressTable(data, nameEntry);
    return parseNameTable(nameTable.data, nameTable.offset, ltag);
}

function postScriptName(names) {
    const names6 = getNameByID(names, 6);
    return names6.en || Object.values(names6)[0];
}

// Builds a minimal but valid TrueType Collection (ttcf) from standalone font buffers.
// Each font's sfnt directory is placed after the TTC header and its table offsets are
// relocated to absolute file offsets, as required by the collection format.
function buildCollection(fontBuffers) {
    const align = (n) => (n + 3) & ~3;
    const numFonts = fontBuffers.length;
    const headerSize = 12 + 4 * numFonts;

    const bases = [];
    let cursor = headerSize;
    const fonts = fontBuffers.map((buffer) => {
        const bytes = new Uint8Array(buffer);
        bases.push(cursor);
        cursor += align(bytes.length);
        return bytes;
    });

    const out = new Uint8Array(cursor);
    const view = new DataView(out.buffer);

    out.set([0x74, 0x74, 0x63, 0x66], 0); // 'ttcf'
    view.setUint32(4, 0x00010000, false); // version 1.0
    view.setUint32(8, numFonts, false);
    for (let i = 0; i < numFonts; i += 1) {
        view.setUint32(12 + i * 4, bases[i], false);
    }

    fonts.forEach((bytes, i) => {
        const base = bases[i];
        out.set(bytes, base);
        const numTables = view.getUint16(base + 4, false);
        for (let t = 0; t < numTables; t += 1) {
            const record = base + 12 + t * 16;
            const relativeOffset = view.getUint32(record + 8, false);
            view.setUint32(record + 8, relativeOffset + base, false);
        }
    });

    return out.buffer;
}

describe('getFontFileData collections (ttcf)', function() {
    const robotoBuffer = toArrayBuffer(readFileSync('./test/fonts/Roboto-Black.ttf'));
    const changaBuffer = toArrayBuffer(readFileSync('./test/fonts/Changa-Regular.ttf'));

    // Derive the PostScript names from the standalone fonts so the test stays self-contained.
    const roboto = getFontFileData(robotoBuffer);
    const changa = getFontFileData(changaBuffer);
    const robotoPostScriptName = postScriptName(readNames(roboto.data, roboto.tableEntries));
    const changaPostScriptName = postScriptName(readNames(changa.data, changa.tableEntries));

    const collection = buildCollection([robotoBuffer, changaBuffer]);

    it('selects the requested font by postScriptName', function() {
        const first = getFontFileData(collection, robotoPostScriptName);
        assert.equal(postScriptName(readNames(first.data, first.tableEntries)), robotoPostScriptName);

        const second = getFontFileData(collection, changaPostScriptName);
        assert.equal(postScriptName(readNames(second.data, second.tableEntries)), changaPostScriptName);
    });

    it('throws when no postScriptName is provided for a collection', function() {
        assert.throws(() => getFontFileData(collection), /postScriptName is required/);
    });

    it('throws when the requested postScriptName is not in the collection', function() {
        assert.throws(
            () => getFontFileData(collection, 'This-Font-Does-Not-Exist'),
            /No font matching/
        );
    });
});
