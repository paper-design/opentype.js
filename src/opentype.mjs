// opentype.js
// https://github.com/opentypejs/opentype.js
// (c) 2015 Frederik De Bleser
// opentype.js may be freely distributed under the MIT license.

import Font from './font.mjs';
import Glyph from './glyph.mjs';
import { CmapEncoding, GlyphNames, addGlyphNames } from './encoding.mjs';
import parse from './parse.mjs';
import BoundingBox from './bbox.mjs';
import Path from './path.mjs';
import cpal from './tables/cpal.mjs';
import colr from './tables/colr.mjs';
import cmap from './tables/cmap.mjs';
import cff from './tables/cff.mjs';
import stat from './tables/stat.mjs';
import gvar from './tables/gvar.mjs';
import cvar from './tables/cvar.mjs';
import avar from './tables/avar.mjs';
import hvar from './tables/hvar.mjs';
import glyf from './tables/glyf.mjs';
import gdef from './tables/gdef.mjs';
import hhea from './tables/hhea.mjs';
import hmtx from './tables/hmtx.mjs';
import kern from './tables/kern.mjs';
import loca from './tables/loca.mjs';
import maxp from './tables/maxp.mjs';
import meta from './tables/meta.mjs';
import gasp from './tables/gasp.mjs';
import svg from './tables/svg.mjs';
import { PaletteManager } from './palettes.mjs';
import {
    getNameByID,
    getFontFileData,
    parseFvarTable,
    parseGposTable,
    parseGsubTable,
    parseHeadTable,
    parseLtagTable,
    parseNameTable,
    parseOS2Table,
    parsePostTable,
    uncompressTable,
} from './fn/index.mjs';

/**
 * The opentype library.
 * @namespace opentype
 */

// Public API ///////////////////////////////////////////////////////////

/**
 * Parse the OpenType file data (as an ArrayBuffer) and return a Font object.
 * Throws an error if the font could not be parsed.
 * @param  {ArrayBuffer}
 * @param  {Object} opt - options for parsing
 * @return {opentype.Font}
 */
function parseBuffer(buffer, opt = {}) {
    let indexToLocFormat;
    let ltagTable;

    // Since the constructor can also be called to create new fonts from scratch, we indicate this
    // should be an empty font that we'll fill with our own data.
    const font = new Font({ empty: true });

    const { data, outlinesFormat, tableEntries } = getFontFileData(buffer);
    const numTables = tableEntries.length;
    font.outlinesFormat = outlinesFormat;

    let cffTableEntry;
    let cff2TableEntry;
    let fvarTableEntry;
    let statTableEntry;
    let gvarTableEntry;
    let cvarTableEntry;
    let avarTableEntry;
    let glyfTableEntry;
    let gdefTableEntry;
    let gposTableEntry;
    let gsubTableEntry;
    let hmtxTableEntry;
    let hvarTableEntry;
    let kernTableEntry;
    let locaTableEntry;
    let nameTableEntry;
    let metaTableEntry;
    let p;

    for (let i = 0; i < numTables; i += 1) {
        const tableEntry = tableEntries[i];
        let table;
        switch (tableEntry.tag) {
            case 'avar':
                avarTableEntry = tableEntry;
                break;
            case 'cmap':
                table = uncompressTable(data, tableEntry);
                font.tables.cmap = cmap.parse(table.data, table.offset);
                font.encoding = new CmapEncoding(font.tables.cmap);
                break;
            case 'cvt ':
                table = uncompressTable(data, tableEntry);
                p = new parse.Parser(table.data, table.offset);
                font.tables.cvt = p.parseShortList(tableEntry.length / 2);
                break;
            case 'fvar':
                fvarTableEntry = tableEntry;
                break;
            case 'STAT':
                statTableEntry = tableEntry;
                break;
            case 'gvar':
                gvarTableEntry = tableEntry;
                break;
            case 'cvar':
                cvarTableEntry = tableEntry;
                break;
            case 'fpgm':
                table = uncompressTable(data, tableEntry);
                p = new parse.Parser(table.data, table.offset);
                font.tables.fpgm = p.parseByteList(tableEntry.length);
                break;
            case 'head':
                table = uncompressTable(data, tableEntry);
                font.tables.head = parseHeadTable(table.data, table.offset);
                font.unitsPerEm = font.tables.head.unitsPerEm;
                indexToLocFormat = font.tables.head.indexToLocFormat;
                break;
            case 'hhea':
                table = uncompressTable(data, tableEntry);
                font.tables.hhea = hhea.parse(table.data, table.offset);
                font.ascender = font.tables.hhea.ascender;
                font.descender = font.tables.hhea.descender;
                font.numberOfHMetrics = font.tables.hhea.numberOfHMetrics;
                break;
            case 'HVAR':
                hvarTableEntry = tableEntry;
                break;
            case 'hmtx':
                hmtxTableEntry = tableEntry;
                break;
            case 'ltag':
                table = uncompressTable(data, tableEntry);
                ltagTable = parseLtagTable(table.data, table.offset);
                break;
            case 'COLR':
                table = uncompressTable(data, tableEntry);
                font.tables.colr = colr.parse(table.data, table.offset);
                break;
            case 'CPAL':
                table = uncompressTable(data, tableEntry);
                font.tables.cpal = cpal.parse(table.data, table.offset);
                break;
            case 'maxp':
                table = uncompressTable(data, tableEntry);
                font.tables.maxp = maxp.parse(table.data, table.offset);
                font.numGlyphs = font.tables.maxp.numGlyphs;
                break;
            case 'name':
                nameTableEntry = tableEntry;
                break;
            case 'OS/2':
                table = uncompressTable(data, tableEntry);
                font.tables.os2 = parseOS2Table(table.data, table.offset);
                break;
            case 'post':
                table = uncompressTable(data, tableEntry);
                font.tables.post = parsePostTable(table.data, table.offset);
                font.glyphNames = new GlyphNames(font.tables.post);
                break;
            case 'prep':
                table = uncompressTable(data, tableEntry);
                p = new parse.Parser(table.data, table.offset);
                font.tables.prep = p.parseByteList(tableEntry.length);
                break;
            case 'glyf':
                glyfTableEntry = tableEntry;
                break;
            case 'loca':
                locaTableEntry = tableEntry;
                break;
            case 'CFF ':
                cffTableEntry = tableEntry;
                break;
            case 'CFF2':
                cff2TableEntry = tableEntry;
                break;
            case 'kern':
                kernTableEntry = tableEntry;
                break;
            case 'GDEF':
                gdefTableEntry = tableEntry;
                break;
            case 'GPOS':
                gposTableEntry = tableEntry;
                break;
            case 'GSUB':
                gsubTableEntry = tableEntry;
                break;
            case 'meta':
                metaTableEntry = tableEntry;
                break;
            case 'gasp':
                try {
                    table = uncompressTable(data, tableEntry);
                    font.tables.gasp = gasp.parse(table.data, table.offset);
                } catch (e) {
                    console.warn('Failed to parse gasp table, skipping.');
                    console.warn(e);
                }
                break;
            case 'SVG ':
                table = uncompressTable(data, tableEntry);
                font.tables.svg = svg.parse(table.data, table.offset);
                break;
            default:
                // console.info(`Skipping unsupported table ${tableEntry.tag}`);
                break;
        }
    }

    const nameTable = uncompressTable(data, nameTableEntry);
    font.tables.name = parseNameTable(nameTable.data, nameTable.offset, ltagTable);
    font.names = font.tables.name;

    if (glyfTableEntry && locaTableEntry) {
        const shortVersion = indexToLocFormat === 0;
        const locaTable = uncompressTable(data, locaTableEntry);
        const locaOffsets = loca.parse(locaTable.data, locaTable.offset, font.numGlyphs, shortVersion);
        const glyfTable = uncompressTable(data, glyfTableEntry);
        font.glyphs = glyf.parse(glyfTable.data, glyfTable.offset, locaOffsets, font, opt);
    } else if (cffTableEntry) {
        const cffTable = uncompressTable(data, cffTableEntry);
        cff.parse(cffTable.data, cffTable.offset, font, opt);
    } else if (cff2TableEntry) {
        const cffTable2 = uncompressTable(data, cff2TableEntry);
        cff.parse(cffTable2.data, cffTable2.offset, font, opt);
    } else {
        throw new Error('Font doesn\'t contain TrueType, CFF or CFF2 outlines.');
    }

    const hmtxTable = uncompressTable(data, hmtxTableEntry);
    hmtx.parse(font, hmtxTable.data, hmtxTable.offset, font.numberOfHMetrics, font.numGlyphs, font.glyphs, opt);
    addGlyphNames(font, opt);

    if (kernTableEntry) {
        const kernTable = uncompressTable(data, kernTableEntry);
        font.kerningPairs = kern.parse(kernTable.data, kernTable.offset);
    } else {
        font.kerningPairs = {};
    }

    if (gdefTableEntry) {
        const gdefTable = uncompressTable(data, gdefTableEntry);
        font.tables.gdef = gdef.parse(gdefTable.data, gdefTable.offset);
    }

    if (gposTableEntry) {
        const gposTable = uncompressTable(data, gposTableEntry);
        font.tables.gpos = parseGposTable(gposTable.data, gposTable.offset);
        font.position.init();
    }

    if (gsubTableEntry) {
        const gsubTable = uncompressTable(data, gsubTableEntry);
        font.tables.gsub = parseGsubTable(gsubTable.data, gsubTable.offset);
        for (const f of font.tables.gsub.features) {
            // Match `ss01` to `ss20`
            if (f.tag.match(/ss(?:0[1-9]|1\d|20)/)) {
                if (f.feature.featureParamsTable && f.feature.featureParamsTable.uiNameId !== undefined) {
                    const uiNameObj = getNameByID(font.tables.name, f.feature.featureParamsTable.uiNameId);
                    if (uiNameObj) {
                        // Get the first available name from any platform/language
                        for (const platform in uiNameObj) {
                            const translations = uiNameObj[platform];
                            for (const lang in translations) {
                                f.feature.uiName = translations[lang];
                                break;
                            }
                            if (f.feature.uiName) break;
                        }
                    }
                }
            }
            // Match `cv01` to `cv99`
            else if (f.tag.match(/cv(?:0[1-9]|[1-9]\d)/)) {
                if (f.feature.featureParamsTable && f.feature.featureParamsTable.featUiLabelNameId !== undefined) {
                    const featUiLabelNameObj = getNameByID(font.tables.name, f.feature.featureParamsTable.featUiLabelNameId);
                    if (featUiLabelNameObj) {
                        // Get the first available name from any platform/language
                        for (const platform in featUiLabelNameObj) {
                            const translations = featUiLabelNameObj[platform];
                            for (const lang in translations) {
                                f.feature.featUiLabelName = translations[lang];
                                break;
                            }
                            if (f.feature.featUiLabelName) break;
                        }
                    }
                }
            }
        }
    }

    if (fvarTableEntry) {
        const fvarTable = uncompressTable(data, fvarTableEntry);
        font.tables.fvar = parseFvarTable(fvarTable.data, fvarTable.offset, font.names);
    }

    if (statTableEntry) {
        const statTable = uncompressTable(data, statTableEntry);
        font.tables.stat = stat.parse(statTable.data, statTable.offset, font.tables.fvar);
    }

    if (gvarTableEntry) {
        if (!fvarTableEntry) {
            console.warn('This font provides a gvar table, but no fvar table, which is required for variable fonts.');
        }
        if (!glyfTableEntry) {
            console.warn('This font provides a gvar table, but no glyf table. Glyph variation only works with TrueType outlines.');
        }
        const gvarTable = uncompressTable(data, gvarTableEntry);
        font.tables.gvar = gvar.parse(gvarTable.data, gvarTable.offset, font.tables.fvar, font.glyphs);
    }

    if (cvarTableEntry) {
        if (!fvarTableEntry) {
            console.warn('This font provides a cvar table, but no fvar table, which is required for variable fonts.');
        }
        if (!font.tables.cvt) {
            console.warn('This font provides a cvar table, but no cvt table which could be made variable.');
        }
        if (!glyfTableEntry) {
            console.warn('This font provides a gvar table, but no glyf table. Glyph variation only works with TrueType outlines.');
        }
        const cvarTable = uncompressTable(data, cvarTableEntry);
        font.tables.cvar = cvar.parse(cvarTable.data, cvarTable.offset, font.tables.fvar, font.tables.cvt || []);
    }

    if (avarTableEntry) {
        if (!fvarTableEntry) {
            console.warn('This font provides an avar table, but no fvar table, which is required for variable fonts.');
        }
        const avarTable = uncompressTable(data, avarTableEntry);
        font.tables.avar = avar.parse(avarTable.data, avarTable.offset, font.tables.fvar);
    }

    if (hvarTableEntry) {
        if (!fvarTableEntry) {
            console.warn('This font provides an HVAR table, but no fvar table, which is required for variable fonts.');
        }

        if (!hmtxTableEntry) {
            console.warn('This font provides an HVAR table, but no hmtx table to vary.');
        }

        const hvarTable = uncompressTable(data, hvarTableEntry);
        font.tables.hvar = hvar.parse(hvarTable.data, hvarTable.offset, font.tables.fvar);
    }

    if (metaTableEntry) {
        const metaTable = uncompressTable(data, metaTableEntry);
        font.tables.meta = meta.parse(metaTable.data, metaTable.offset);
        font.metas = font.tables.meta;
    }

    font.palettes = new PaletteManager(font);

    return font;
}

/**
 * Asynchronously load the font from a URL or a filesystem. When done, call the callback
 * with two arguments `(err, font)`. The `err` will be null on success,
 * the `font` is a Font object.
 * We use the node.js callback convention so that
 * opentype.js can integrate with frameworks like async.js.
 * @alias opentype.load
 * @deprecated
 */
function load() {
    console.error('DEPRECATED! migrate to: opentype.parse(buffer, opt) See: https://github.com/opentypejs/opentype.js/issues/675');
}

/**
 * Synchronously load the font from a URL or file.
 * When done, returns the font object or throws an error.
 * @alias opentype.loadSync
 * @deprecated
 */
function loadSync() {
    console.error('DEPRECATED! migrate to: opentype.parse(require("fs").readFileSync(url), opt)');
}

export {
    Font,
    Glyph,
    Path,
    BoundingBox,
    parse as _parse,
    parseBuffer as parse,
    load,
    loadSync
};
