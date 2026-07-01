// The `cmap` table stores the mappings from characters to glyphs.
// https://www.microsoft.com/typography/OTSPEC/cmap.htm

import check from '../check.mjs';
import parse from '../parse.mjs';
import { eightBitMacEncodings } from './eight-bit-mac-encodings.mjs';
import { getEncoding } from './get-encoding.mjs';

export function parseCmapTableFormat0(cmap, p, platformID, encodingID) {
    // Length in bytes of the index map
    cmap.length = p.parseUShort();
    // see https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6name.html
    // section "Macintosh Language Codes"
    cmap.language = p.parseUShort() - 1;

    const indexMap = p.parseByteList(cmap.length);
    const glyphIndexMap = Object.assign({}, indexMap);
    const encoding = getEncoding(platformID, encodingID, cmap.language);
    const decodingTable = eightBitMacEncodings[encoding];
    for (let i = 0; i < decodingTable.length; i++) {
        glyphIndexMap[decodingTable.charCodeAt(i)] = indexMap[0x80 + i];
    }
    cmap.glyphIndexMap = glyphIndexMap;
}

export function parseCmapTableFormat12or13(cmap, p, format) {
    //Skip reserved.
    p.parseUShort();

    // Length in bytes of the sub-tables.
    cmap.length = p.parseULong();
    cmap.language = p.parseULong();

    let groupCount;
    cmap.groupCount = groupCount = p.parseULong();
    cmap.glyphIndexMap = {};

    for (let i = 0; i < groupCount; i += 1) {
        const startCharCode = p.parseULong();
        const endCharCode = p.parseULong();
        let startGlyphId = p.parseULong();

        for (let c = startCharCode; c <= endCharCode; c += 1) {
            cmap.glyphIndexMap[c] = startGlyphId;
            if (format === 12) {
                startGlyphId++;
            }
        }
    }
}

function parseCmapTableFormat4(cmap, p, data, start, offset) {
    // Length in bytes of the sub-tables.
    cmap.length = p.parseUShort();
    cmap.language = p.parseUShort();

    // segCount is stored x 2.
    let segCount;
    cmap.segCount = segCount = p.parseUShort() >> 1;

    // Skip searchRange, entrySelector, rangeShift.
    p.skip('uShort', 3);

    // The "unrolled" mapping from character codes to glyph indices.
    cmap.glyphIndexMap = {};
    const endCountParser = new parse.Parser(data, start + offset + 14);
    const startCountParser = new parse.Parser(data, start + offset + 16 + segCount * 2);
    const idDeltaParser = new parse.Parser(data, start + offset + 16 + segCount * 4);
    const idRangeOffsetParser = new parse.Parser(data, start + offset + 16 + segCount * 6);
    let glyphIndexOffset = start + offset + 16 + segCount * 8;
    for (let i = 0; i < segCount - 1; i += 1) {
        let glyphIndex;
        const endCount = endCountParser.parseUShort();
        const startCount = startCountParser.parseUShort();
        const idDelta = idDeltaParser.parseShort();
        const idRangeOffset = idRangeOffsetParser.parseUShort();
        for (let c = startCount; c <= endCount; c += 1) {
            if (idRangeOffset !== 0) {
                // The idRangeOffset is relative to the current position in the idRangeOffset array.
                // Take the current offset in the idRangeOffset array.
                glyphIndexOffset = (idRangeOffsetParser.offset + idRangeOffsetParser.relativeOffset - 2);

                // Add the value of the idRangeOffset, which will move us into the glyphIndex array.
                glyphIndexOffset += idRangeOffset;

                // Then add the character index of the current segment, multiplied by 2 for USHORTs.
                glyphIndexOffset += (c - startCount) * 2;
                glyphIndex = parse.getUShort(data, glyphIndexOffset);
                if (glyphIndex !== 0) {
                    glyphIndex = (glyphIndex + idDelta) & 0xFFFF;
                }
            } else {
                glyphIndex = (c + idDelta) & 0xFFFF;
            }

            cmap.glyphIndexMap[c] = glyphIndex;
        }
    }
}

export function parseCmapTableFormat14(cmap, p) {
    const varSelectorList = {};

    p.skip('uLong'); // skip length

    const numVarSelectorRecords = p.parseULong();

    for (let i = 0; i < numVarSelectorRecords; i += 1) {
        const varSelector = p.parseUInt24();
        const varSelectorRecord = {
            varSelector
        };

        const defaultUVSOffset = p.parseOffset32();
        const nonDefaultUVSOffset = p.parseOffset32();

        const currentOffset = p.relativeOffset;

        if (defaultUVSOffset) {
            p.relativeOffset = defaultUVSOffset;
            varSelectorRecord.defaultUVS = p.parseStruct({
                ranges: function () {
                    return p.parseRecordList32({
                        startUnicodeValue: p.parseUInt24,
                        additionalCount: p.parseByte
                    });
                }
            });
        }

        if (nonDefaultUVSOffset) {
            p.relativeOffset = nonDefaultUVSOffset;
            varSelectorRecord.nonDefaultUVS = p.parseStruct({
                uvsMappings: function () {
                    const map = {};
                    const list = p.parseRecordList32({
                        unicodeValue: p.parseUInt24,
                        glyphID: p.parseUShort
                    });

                    for (let i = 0; i < list.length; i += 1) {
                        map[list[i].unicodeValue] = list[i];
                    }

                    return map;
                }
            });
        }

        varSelectorList[varSelector] = varSelectorRecord;

        p.relativeOffset = currentOffset;
    }

    cmap.varSelectorList = varSelectorList;
}

// Parse the `cmap` table. This table stores the mappings from characters to glyphs.
// There are many available formats, but we only support the Windows format 4 and 12, and format 14 as a supplement if available.
// This function returns a `CmapEncoding` object or null if no supported format could be found.
export function parseCmapTable(data, start) {
    const cmap = {};
    cmap.version = parse.getUShort(data, start);
    check.argument(cmap.version === 0, 'cmap table version should be 0.');

    // The cmap table can contain many sub-tables, each with their own format.
    // We're only interested in a "platform 0" (Unicode format) and "platform 3" (Windows format) table,
    //
    cmap.numTables = parse.getUShort(data, start + 2);
    let format14Parser = null;
    let format14offset = -1;
    let offset = -1;
    let platformId = null;
    let encodingId = null;
    const platform0Encodings = [0, 1, 2, 3, 4, 6];
    const platform3Encodings = [0, 1, 10];
    for (let i = cmap.numTables - 1; i >= 0; i -= 1) {
        platformId = parse.getUShort(data, start + 4 + (i * 8));
        encodingId = parse.getUShort(data, start + 4 + (i * 8) + 2);
        if ((platformId === 3 && platform3Encodings.includes(encodingId)) ||
            (platformId === 0 && platform0Encodings.includes(encodingId)) ||
            (platformId === 1 && encodingId === 0) // MacOS <= 9
        ) {
            // only use the first supported table
            if (offset > 0) continue;
            offset = parse.getULong(data, start + 4 + (i * 8) + 4);
            // allow for early break
            if (format14Parser) {
                break;
            }
        } else if (platformId === 0 && encodingId === 5) {
            format14offset = parse.getULong(data, start + 4 + (i * 8) + 4);
            format14Parser = new parse.Parser(data, start + format14offset);
            if (format14Parser.parseUShort() !== 14) {
                format14offset = -1;
                format14Parser = null;
            } else if (offset > 0) {
                // we already got the regular table, early break
                break;
            }
        }
    }

    if (offset === -1) {
        // There is no cmap table in the font that we support.
        throw new Error('No valid cmap sub-tables found.');
    }

    const p = new parse.Parser(data, start + offset);
    cmap.format = p.parseUShort();

    if (cmap.format === 0) {
        parseCmapTableFormat0(cmap, p, platformId, encodingId);
    } else if (cmap.format === 12 || cmap.format === 13) {
        parseCmapTableFormat12or13(cmap, p, cmap.format);
    } else if (cmap.format === 4) {
        parseCmapTableFormat4(cmap, p, data, start, offset);
    } else {
        throw new Error(
            'Only format 0 (platformId 1, encodingId 0), 4, 12 and 14 cmap tables are supported ' +
            '(found format ' + cmap.format + ', platformId ' + platformId + ', encodingId ' + encodingId + ').'
        );
    }

    // format 14 is the only one that's not exclusive but can be used as a supplement.
    if (format14Parser) {
        parseCmapTableFormat14(cmap, format14Parser);
    }

    return cmap;
}
