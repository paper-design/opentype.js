// The `GPOS` table contains kerning pairs, among other things.
// https://docs.microsoft.com/en-us/typography/opentype/spec/gpos

import check from '../check.mjs';
import { Parser } from '../parse.mjs';

const subtableParsers = new Array(10);         // subtableParsers[0] is unused

// Anchor table parser (used by lookup types 3-6)
Parser.prototype.parseAnchor = function() {
    const format = this.parseUShort();
    const xCoordinate = this.parseShort();
    const yCoordinate = this.parseShort();
    const anchor = {
        format: format,
        xCoordinate: xCoordinate,
        yCoordinate: yCoordinate
    };
    if (format === 2) {
        anchor.anchorPoint = this.parseUShort();
    } else if (format === 3) {
        anchor.xDeviceOffset = this.parseOffset16();
        anchor.yDeviceOffset = this.parseOffset16();
        // Device/VariationIndex tables not parsed
    }
    return anchor;
};

// MarkArray parser (used by lookup types 4-6)
Parser.prototype.parseMarkArray = function() {
    const markArrayStart = this.offset + this.relativeOffset;
    const markCount = this.parseUShort();
    const marks = new Array(markCount);
    for (let i = 0; i < markCount; i++) {
        const markClass = this.parseUShort();
        const markAnchorOffset = this.parseOffset16();
        marks[i] = {
            markClass: markClass,
            markAnchor: markAnchorOffset > 0 ? new Parser(this.data, markArrayStart + markAnchorOffset).parseAnchor() : undefined
        };
    }
    return marks;
};

// Lookup type 1: single adjustment positioning
// https://docs.microsoft.com/en-us/typography/opentype/spec/gpos#lookup-type-1-single-adjustment-positioning-subtable
subtableParsers[1] = function parseLookup1() {
    const start = this.offset + this.relativeOffset;
    const posformat = this.parseUShort();
    if (posformat === 1) {
        return {
            posFormat: 1,
            coverage: this.parsePointer(Parser.coverage),
            value: this.parseValueRecord()
        };
    } else if (posformat === 2) {
        return {
            posFormat: 2,
            coverage: this.parsePointer(Parser.coverage),
            values: this.parseValueRecordList()
        };
    }
    check.assert(false, '0x' + start.toString(16) + ': GPOS lookup type 1 format must be 1 or 2.');
};

// Lookup type 2: pair adjustment positioning
// https://docs.microsoft.com/en-us/typography/opentype/spec/gpos#lookup-type-2-pair-adjustment-positioning-subtable
subtableParsers[2] = function parseLookup2() {
    const start = this.offset + this.relativeOffset;
    const posFormat = this.parseUShort();
    check.assert(posFormat === 1 || posFormat === 2, '0x' + start.toString(16) + ': GPOS lookup type 2 format must be 1 or 2.');
    const coverage = this.parsePointer(Parser.coverage);
    const valueFormat1 = this.parseUShort();
    const valueFormat2 = this.parseUShort();
    if (posFormat === 1) {
        // Adjustments for Glyph Pairs
        return {
            posFormat: posFormat,
            coverage: coverage,
            valueFormat1: valueFormat1,
            valueFormat2: valueFormat2,
            pairSets: this.parseList(Parser.pointer(Parser.list(function() {
                return {        // pairValueRecord
                    secondGlyph: this.parseUShort(),
                    value1: this.parseValueRecord(valueFormat1),
                    value2: this.parseValueRecord(valueFormat2)
                };
            })))
        };
    } else if (posFormat === 2) {
        const classDef1 = this.parsePointer(Parser.classDef);
        const classDef2 = this.parsePointer(Parser.classDef);
        const class1Count = this.parseUShort();
        const class2Count = this.parseUShort();
        return {
            // Class Pair Adjustment
            posFormat: posFormat,
            coverage: coverage,
            valueFormat1: valueFormat1,
            valueFormat2: valueFormat2,
            classDef1: classDef1,
            classDef2: classDef2,
            class1Count: class1Count,
            class2Count: class2Count,
            classRecords: this.parseList(class1Count, Parser.list(class2Count, function() {
                return {
                    value1: this.parseValueRecord(valueFormat1),
                    value2: this.parseValueRecord(valueFormat2)
                };
            }))
        };
    }
};

// Lookup type 3: cursive attachment positioning
// https://docs.microsoft.com/en-us/typography/opentype/spec/gpos#lookup-type-3-cursive-attachment-positioning-subtable
subtableParsers[3] = function parseLookup3() {
    const start = this.offset + this.relativeOffset;
    const posFormat = this.parseUShort();
    check.argument(posFormat === 1, '0x' + start.toString(16) + ': GPOS lookup type 3 format must be 1.');
    const coverage = this.parsePointer(Parser.coverage);
    const entryExitCount = this.parseUShort();
    const entryExitRecords = new Array(entryExitCount);
    for (let i = 0; i < entryExitCount; i++) {
        const entryAnchorOffset = this.parseOffset16();
        const exitAnchorOffset = this.parseOffset16();
        entryExitRecords[i] = {
            entryAnchor: entryAnchorOffset > 0 ? new Parser(this.data, start + entryAnchorOffset).parseAnchor() : undefined,
            exitAnchor: exitAnchorOffset > 0 ? new Parser(this.data, start + exitAnchorOffset).parseAnchor() : undefined
        };
    }
    return {
        posFormat: posFormat,
        coverage: coverage,
        entryExitRecords: entryExitRecords
    };
};

// Lookup type 4: mark to base attachment positioning
// https://docs.microsoft.com/en-us/typography/opentype/spec/gpos#lookup-type-4-mark-to-base-attachment-positioning-subtable
subtableParsers[4] = function parseLookup4() {
    const start = this.offset + this.relativeOffset;
    const posFormat = this.parseUShort();
    check.argument(posFormat === 1, '0x' + start.toString(16) + ': GPOS lookup type 4 format must be 1.');
    const markCoverage = this.parsePointer(Parser.coverage);
    const baseCoverage = this.parsePointer(Parser.coverage);
    const markClassCount = this.parseUShort();
    const markArrayOffset = this.parseOffset16();
    const baseArrayOffset = this.parseOffset16();
    const markArray = markArrayOffset > 0 ? new Parser(this.data, start + markArrayOffset).parseMarkArray() : undefined;
    let baseArray;
    if (baseArrayOffset > 0) {
        const baseArrayParser = new Parser(this.data, start + baseArrayOffset);
        const baseArrayStart = baseArrayParser.offset + baseArrayParser.relativeOffset;
        const baseCount = baseArrayParser.parseUShort();
        baseArray = new Array(baseCount);
        for (let i = 0; i < baseCount; i++) {
            const baseAnchors = new Array(markClassCount);
            for (let j = 0; j < markClassCount; j++) {
                const baseAnchorOffset = baseArrayParser.parseOffset16();
                baseAnchors[j] = baseAnchorOffset > 0 ? new Parser(this.data, baseArrayStart + baseAnchorOffset).parseAnchor() : undefined;
            }
            baseArray[i] = baseAnchors;
        }
    } else {
        baseArray = undefined;
    }
    return {
        posFormat: posFormat,
        markCoverage: markCoverage,
        baseCoverage: baseCoverage,
        markClassCount: markClassCount,
        markArray: markArray,
        baseArray: baseArray
    };
};

// Lookup type 5: mark to ligature attachment positioning
// https://docs.microsoft.com/en-us/typography/opentype/spec/gpos#lookup-type-5-mark-to-ligature-attachment-positioning-subtable
subtableParsers[5] = function parseLookup5() {
    const start = this.offset + this.relativeOffset;
    const posFormat = this.parseUShort();
    check.argument(posFormat === 1, '0x' + start.toString(16) + ': GPOS lookup type 5 format must be 1.');
    const markCoverage = this.parsePointer(Parser.coverage);
    const ligatureCoverage = this.parsePointer(Parser.coverage);
    const markClassCount = this.parseUShort();
    const markArrayOffset = this.parseOffset16();
    const ligatureArrayOffset = this.parseOffset16();
    const markArray = markArrayOffset > 0 ? new Parser(this.data, start + markArrayOffset).parseMarkArray() : undefined;
    let ligatureArray;
    if (ligatureArrayOffset > 0) {
        const ligatureArrayParser = new Parser(this.data, start + ligatureArrayOffset);
        const ligatureArrayStart = ligatureArrayParser.offset + ligatureArrayParser.relativeOffset;
        const ligatureCount = ligatureArrayParser.parseUShort();
        ligatureArray = new Array(ligatureCount);
        for (let i = 0; i < ligatureCount; i++) {
            const ligatureAttachOffset = ligatureArrayParser.parseOffset16();
            if (ligatureAttachOffset > 0) {
                const ligatureAttachStart = ligatureArrayStart + ligatureAttachOffset;
                const ligatureAttachParser = new Parser(this.data, ligatureAttachStart);
                const componentCount = ligatureAttachParser.parseUShort();
                const components = new Array(componentCount);
                for (let j = 0; j < componentCount; j++) {
                    const componentAnchors = new Array(markClassCount);
                    for (let k = 0; k < markClassCount; k++) {
                        const ligatureAnchorOffset = ligatureAttachParser.parseOffset16();
                        componentAnchors[k] = ligatureAnchorOffset > 0 ? new Parser(this.data, ligatureAttachStart + ligatureAnchorOffset).parseAnchor() : undefined;
                    }
                    components[j] = componentAnchors;
                }
                ligatureArray[i] = components;
            } else {
                ligatureArray[i] = undefined;
            }
        }
    } else {
        ligatureArray = undefined;
    }
    return {
        posFormat: posFormat,
        markCoverage: markCoverage,
        ligatureCoverage: ligatureCoverage,
        markClassCount: markClassCount,
        markArray: markArray,
        ligatureArray: ligatureArray
    };
};

// Lookup type 6: mark to mark attachment positioning
// https://docs.microsoft.com/en-us/typography/opentype/spec/gpos#lookup-type-6-mark-to-mark-attachment-positioning-subtable
subtableParsers[6] = function parseLookup6() {
    const start = this.offset + this.relativeOffset;
    const posFormat = this.parseUShort();
    check.argument(posFormat === 1, '0x' + start.toString(16) + ': GPOS lookup type 6 format must be 1.');
    const mark1Coverage = this.parsePointer(Parser.coverage);
    const mark2Coverage = this.parsePointer(Parser.coverage);
    const markClassCount = this.parseUShort();
    const mark1ArrayOffset = this.parseOffset16();
    const mark2ArrayOffset = this.parseOffset16();
    const mark1Array = mark1ArrayOffset > 0 ? new Parser(this.data, start + mark1ArrayOffset).parseMarkArray() : undefined;
    let mark2Array;
    if (mark2ArrayOffset > 0) {
        const mark2ArrayParser = new Parser(this.data, start + mark2ArrayOffset);
        const mark2ArrayStart = mark2ArrayParser.offset + mark2ArrayParser.relativeOffset;
        const mark2Count = mark2ArrayParser.parseUShort();
        mark2Array = new Array(mark2Count);
        for (let i = 0; i < mark2Count; i++) {
            const mark2Anchors = new Array(markClassCount);
            for (let j = 0; j < markClassCount; j++) {
                const mark2AnchorOffset = mark2ArrayParser.parseOffset16();
                mark2Anchors[j] = mark2AnchorOffset > 0 ? new Parser(this.data, mark2ArrayStart + mark2AnchorOffset).parseAnchor() : undefined;
            }
            mark2Array[i] = mark2Anchors;
        }
    } else {
        mark2Array = undefined;
    }
    return {
        posFormat: posFormat,
        mark1Coverage: mark1Coverage,
        mark2Coverage: mark2Coverage,
        markClassCount: markClassCount,
        mark1Array: mark1Array,
        mark2Array: mark2Array
    };
};

const lookupRecordDesc = {
    sequenceIndex: Parser.uShort,
    lookupListIndex: Parser.uShort
};

// Lookup type 7: contextual positioning
// https://docs.microsoft.com/en-us/typography/opentype/spec/gpos#lookup-type-7-contextual-positioning-subtable
subtableParsers[7] = function parseLookup7() {
    const start = this.offset + this.relativeOffset;
    const posFormat = this.parseUShort();
    if (posFormat === 1) {
        return {
            posFormat: 1,
            coverage: this.parsePointer(Parser.coverage),
            seqRuleSets: this.parseListOfLists(function() {
                const glyphCount = this.parseUShort();
                const seqLookupCount = this.parseUShort();
                return {
                    inputSequence: this.parseUShortList(glyphCount - 1),
                    seqLookupRecords: this.parseRecordList(seqLookupCount, lookupRecordDesc)
                };
            })
        };
    } else if (posFormat === 2) {
        return {
            posFormat: 2,
            coverage: this.parsePointer(Parser.coverage),
            classDef: this.parsePointer(Parser.classDef),
            classSeqRuleSets: this.parseListOfLists(function() {
                const glyphCount = this.parseUShort();
                const seqLookupCount = this.parseUShort();
                return {
                    inputClassSequence: this.parseUShortList(glyphCount - 1),
                    seqLookupRecords: this.parseRecordList(seqLookupCount, lookupRecordDesc)
                };
            })
        };
    } else if (posFormat === 3) {
        const glyphCount = this.parseUShort();
        const seqLookupCount = this.parseUShort();
        return {
            posFormat: 3,
            coverages: this.parseList(glyphCount, Parser.pointer(Parser.coverage)),
            seqLookupRecords: this.parseRecordList(seqLookupCount, lookupRecordDesc)
        };
    }
    check.assert(false, '0x' + start.toString(16) + ': GPOS lookup type 7 format must be 1, 2 or 3.');
};

// Lookup type 8: chained contexts positioning
// https://docs.microsoft.com/en-us/typography/opentype/spec/gpos#lookup-type-8-chained-contexts-positioning-subtable
subtableParsers[8] = function parseLookup8() {
    const start = this.offset + this.relativeOffset;
    const posFormat = this.parseUShort();
    if (posFormat === 1) {
        return {
            posFormat: 1,
            coverage: this.parsePointer(Parser.coverage),
            chainSeqRuleSets: this.parseListOfLists(function() {
                return {
                    backtrackSequence: this.parseUShortList(),
                    inputSequence: this.parseUShortList(this.parseShort() - 1),
                    lookaheadSequence: this.parseUShortList(),
                    seqLookupRecords: this.parseRecordList(lookupRecordDesc)
                };
            })
        };
    } else if (posFormat === 2) {
        return {
            posFormat: 2,
            coverage: this.parsePointer(Parser.coverage),
            backtrackClassDef: this.parsePointer(Parser.classDef),
            inputClassDef: this.parsePointer(Parser.classDef),
            lookaheadClassDef: this.parsePointer(Parser.classDef),
            chainClassSeqRuleSets: this.parseListOfLists(function() {
                return {
                    backtrackSequence: this.parseUShortList(),
                    inputSequence: this.parseUShortList(this.parseShort() - 1),
                    lookaheadSequence: this.parseUShortList(),
                    seqLookupRecords: this.parseRecordList(lookupRecordDesc)
                };
            })
        };
    } else if (posFormat === 3) {
        return {
            posFormat: 3,
            backtrackCoverage: this.parseList(Parser.pointer(Parser.coverage)),
            inputCoverage: this.parseList(Parser.pointer(Parser.coverage)),
            lookaheadCoverage: this.parseList(Parser.pointer(Parser.coverage)),
            seqLookupRecords: this.parseRecordList(lookupRecordDesc)
        };
    }
    check.assert(false, '0x' + start.toString(16) + ': GPOS lookup type 8 format must be 1, 2 or 3.');
};

// Lookup type 9: positioning extension
// https://docs.microsoft.com/en-us/typography/opentype/spec/gpos#lookup-type-9-positioning-extension-subtable
subtableParsers[9] = function parseLookup9() {
    const start = this.offset + this.relativeOffset;
    const posFormat = this.parseUShort();
    check.argument(posFormat === 1, '0x' + start.toString(16) + ': GPOS lookup type 9 format must be 1.');
    const extensionLookupType = this.parseUShort();
    const extensionOffset = this.parseULong();
    const extensionParser = new Parser(this.data, start + extensionOffset);
    return {
        posFormat: 1,
        extensionLookupType: extensionLookupType,
        extension: subtableParsers[extensionLookupType].call(extensionParser)
    };
};

// https://docs.microsoft.com/en-us/typography/opentype/spec/gpos
export function parseGposTable(data, start) {
    start = start || 0;
    const p = new Parser(data, start);
    const tableVersion = p.parseVersion(1);
    check.argument(tableVersion === 1 || tableVersion === 1.1, 'Unsupported GPOS table version ' + tableVersion);

    if (tableVersion === 1) {
        return {
            version: tableVersion,
            scripts: p.parseScriptList(),
            features: p.parseFeatureList(),
            lookups: p.parseLookupList(subtableParsers)
        };
    } else {
        return {
            version: tableVersion,
            scripts: p.parseScriptList(),
            features: p.parseFeatureList(),
            lookups: p.parseLookupList(subtableParsers),
            variations: p.parseFeatureVariationsList()
        };
    }
}
