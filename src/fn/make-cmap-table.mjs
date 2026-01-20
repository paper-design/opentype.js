import table from '../table.mjs';

function addSegment(t, code, glyphIndex) {
    t.segments.push({
        end: code,
        start: code,
        delta: -(code - glyphIndex),
        offset: 0,
        glyphIndex: glyphIndex
    });
}

function addTerminatorSegment(t) {
    t.segments.push({
        end: 0xFFFF,
        start: 0xFFFF,
        delta: 1,
        offset: 0
    });
}

// Make cmap table, format 4 by default, 12 if needed only
export function makeCmapTable(glyphs) {
    // Plan 0 is the base Unicode Plan but emojis, for example are on another plan, and needs cmap 12 format (with 32bit)
    let isPlan0Only = true;
    let i;

    // Check if we need to add cmap format 12 or if format 4 only is fine
    for (i = glyphs.length - 1; i > 0; i -= 1) {
        const g = glyphs.get(i);
        if (g.unicode > 65535) {
            console.log('Adding CMAP format 12 (needed!)');
            isPlan0Only = false;
            break;
        }
    }

    let cmapTable = [
        { name: 'version', type: 'USHORT', value: 0 },
        { name: 'numTables', type: 'USHORT', value: isPlan0Only ? 1 : 2 },

        // CMAP 4 header
        { name: 'platformID', type: 'USHORT', value: 3 },
        { name: 'encodingID', type: 'USHORT', value: 1 },
        { name: 'offset', type: 'ULONG', value: isPlan0Only ? 12 : (12 + 8) }
    ];

    if (!isPlan0Only)
        cmapTable.push(...[
            // CMAP 12 header
            { name: 'cmap12PlatformID', type: 'USHORT', value: 3 }, // We encode only for PlatformID = 3 (Windows) because it is supported everywhere
            { name: 'cmap12EncodingID', type: 'USHORT', value: 10 },
            { name: 'cmap12Offset', type: 'ULONG', value: 0 }
        ]);

    cmapTable.push(...[
        // CMAP 4 Subtable
        { name: 'format', type: 'USHORT', value: 4 },
        { name: 'cmap4Length', type: 'USHORT', value: 0 },
        { name: 'language', type: 'USHORT', value: 0 },
        { name: 'segCountX2', type: 'USHORT', value: 0 },
        { name: 'searchRange', type: 'USHORT', value: 0 },
        { name: 'entrySelector', type: 'USHORT', value: 0 },
        { name: 'rangeShift', type: 'USHORT', value: 0 }
    ]);

    const t = new table.Table('cmap', cmapTable);

    t.segments = [];
    for (i = 0; i < glyphs.length; i += 1) {
        const glyph = glyphs.get(i);
        for (let j = 0; j < glyph.unicodes.length; j += 1) {
            addSegment(t, glyph.unicodes[j], i);
        }
    }
    t.segments.sort(function (a, b) {
        return a.start - b.start;
    });

    addTerminatorSegment(t);

    const segCount = t.segments.length;
    let segCountToRemove = 0;

    // CMAP 4
    // Set up parallel segment arrays.
    let endCounts = [];
    let startCounts = [];
    let idDeltas = [];
    let idRangeOffsets = [];
    let glyphIds = [];

    // CMAP 12
    let cmap12Groups = [];

    // Reminder this loop is not following the specification at 100%
    // The specification -> find suites of characters and make a group
    // Here we're doing one group for each letter
    // Doing as the spec can save 8 times (or more) space
    for (i = 0; i < segCount; i += 1) {
        const segment = t.segments[i];

        // CMAP 4
        if (segment.end <= 65535 && segment.start <= 65535) {
            endCounts.push({ name: 'end_' + i, type: 'USHORT', value: segment.end });
            startCounts.push({ name: 'start_' + i, type: 'USHORT', value: segment.start });
            idDeltas.push({ name: 'idDelta_' + i, type: 'SHORT', value: segment.delta });
            idRangeOffsets.push({ name: 'idRangeOffset_' + i, type: 'USHORT', value: segment.offset });
            if (segment.glyphId !== undefined) {
                glyphIds.push({ name: 'glyph_' + i, type: 'USHORT', value: segment.glyphId });
            }
        } else {
            // Skip Unicode > 65535 (16bit unsigned max) for CMAP 4, will be added in CMAP 12
            segCountToRemove += 1;
        }

        // CMAP 12
        // Skip Terminator Segment
        if (!isPlan0Only && segment.glyphIndex !== undefined) {
            cmap12Groups.push({ name: 'cmap12Start_' + i, type: 'ULONG', value: segment.start });
            cmap12Groups.push({ name: 'cmap12End_' + i, type: 'ULONG', value: segment.end });
            cmap12Groups.push({ name: 'cmap12Glyph_' + i, type: 'ULONG', value: segment.glyphIndex });
        }
    }

    // CMAP 4 Subtable
    t.segCountX2 = (segCount - segCountToRemove) * 2;
    t.searchRange = Math.pow(2, Math.floor(Math.log((segCount - segCountToRemove)) / Math.log(2))) * 2;
    t.entrySelector = Math.log(t.searchRange / 2) / Math.log(2);
    t.rangeShift = t.segCountX2 - t.searchRange;

    for (let i = 0; i < endCounts.length; i++) {
        t.fields.push(endCounts[i]);
    }
    t.fields.push({ name: 'reservedPad', type: 'USHORT', value: 0 });
    for (let i = 0; i < startCounts.length; i++) {
        t.fields.push(startCounts[i]);
    }
    for (let i = 0; i < idDeltas.length; i++) {
        t.fields.push(idDeltas[i]);
    }
    for (let i = 0; i < idRangeOffsets.length; i++) {
        t.fields.push(idRangeOffsets[i]);
    }
    for (let i = 0; i < glyphIds.length; i++) {
        t.fields.push(glyphIds[i]);
    }

    t.cmap4Length = 14 + // Subtable header
        endCounts.length * 2 +
        2 + // reservedPad
        startCounts.length * 2 +
        idDeltas.length * 2 +
        idRangeOffsets.length * 2 +
        glyphIds.length * 2;

    if (!isPlan0Only) {
        // CMAP 12 Subtable
        const cmap12Length = 16 + // Subtable header
            cmap12Groups.length * 4;

        t.cmap12Offset = 12 + (2 * 2) + 4 + t.cmap4Length;
        t.fields.push(...[
            { name: 'cmap12Format', type: 'USHORT', value: 12 },
            { name: 'cmap12Reserved', type: 'USHORT', value: 0 },
            { name: 'cmap12Length', type: 'ULONG', value: cmap12Length },
            { name: 'cmap12Language', type: 'ULONG', value: 0 },
            { name: 'cmap12nGroups', type: 'ULONG', value: cmap12Groups.length / 3 }
        ]);

        for (let i = 0; i < cmap12Groups.length; i++) {
            t.fields.push(cmap12Groups[i]);
        }

    }

    return t;
}
