import parse from '../parse.mjs';

// Table Directory Entries //////////////////////////////////////////////
/**
 * Parses OpenType table entries.
 * @param  {DataView}
 * @param  {Number}
 * @param  {Number} [fontOffset=0] Offset to the sfnt header. Non-zero for fonts inside a collection (ttcf).
 * @return {Object[]}
 */
export function parseOpenTypeTableEntries(data, numTables, fontOffset = 0) {
    const tableEntries = [];
    // The table directory starts 12 bytes after the sfnt header (sfntVersion, numTables, searchRange, entrySelector, rangeShift).
    let p = fontOffset + 12;
    for (let i = 0; i < numTables; i += 1) {
        const tag = parse.getTag(data, p);
        const checksum = parse.getULong(data, p + 4);
        const offset = parse.getULong(data, p + 8);
        const length = parse.getULong(data, p + 12);
        tableEntries.push({ tag: tag, checksum: checksum, offset: offset, length: length, compression: false });
        p += 16;
    }

    return tableEntries;
}
