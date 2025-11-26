import assert from 'assert';
import { hex, unhex } from '../testutil.mjs';
import { Font, parse } from '../../src/opentype.mjs';
import { readFileSync } from 'fs';
import { makeFvarTable, parseFvarTable } from '../../src/fn/index.mjs';
import { encode } from '../../src/fn/encode.mjs';
const loadSync = (url, opt) => parse(readFileSync(url), opt);

describe('tables/fvar.mjs', function() {
    const testFont = loadSync('./test/fonts/VARTest.ttf');

    const data =
        '00 01 00 00 00 10 00 02 00 02 00 14 00 02 00 0C ' +
        '77 67 68 74 00 64 00 00 01 90 00 00 03 84 00 00 00 00 01 01 ' +
        '77 64 74 68 00 32 00 00 00 64 00 00 00 C8 00 00 00 00 01 02 ' +
        '01 03 00 00 01 2C 00 00 00 64 00 00 ' +
        '01 04 00 00 01 2C 00 00 00 4B 00 00';

    const table = {
        axes: [
            {
                tag: 'wght',
                minValue: 100,
                defaultValue: 400,
                maxValue: 900,
                isHidden: false,
                axisNameID: 257,
                name: {en: 'Weight', ja: 'ウエイト'}
            },
            {
                tag: 'wdth',
                minValue: 50,
                defaultValue: 100,
                maxValue: 200,
                isHidden: false,
                axisNameID: 258,
                name: {en: 'Width', ja: '幅'}
            }
        ],
        instances: [
            {
                name: {en: 'Regular', ja: 'レギュラー'},
                subfamilyNameID: 259,
                postScriptName: undefined,
                postScriptNameID: undefined,
                coordinates: {wght: 300, wdth: 100}
            },
            {
                name: {en: 'Condensed', ja: 'コンデンス'},
                subfamilyNameID: 260,
                postScriptName: undefined,
                postScriptNameID: undefined,
                coordinates: {wght: 300, wdth: 75}
            }
        ]
    };

    const names = {
        macintosh: {
            257: {en: 'Weight', ja: 'ウエイト'},
            258: {en: 'Width', ja: '幅'},
            259: {en: 'Regular', ja: 'レギュラー'},
            260: {en: 'Condensed', ja: 'コンデンス'}
        }
    };

    it('can parse a font variations table', function() {
        assert.deepEqual(table, parseFvarTable(unhex(data), 0, names));
    });

    it('can parse and write the HIDDEN_AXIS flag', function() {
        // Same data as above, but with flags set to 0x0001 for the second axis (wdth)
        const dataWithHidden =
            '00 01 00 00 00 10 00 02 00 02 00 14 00 02 00 0C ' +
            '77 67 68 74 00 64 00 00 01 90 00 00 03 84 00 00 00 00 01 01 ' +
            '77 64 74 68 00 32 00 00 00 64 00 00 00 C8 00 00 00 01 01 02 ' +  // flags changed from 00 00 to 00 01
            '01 03 00 00 01 2C 00 00 00 64 00 00 ' +
            '01 04 00 00 01 2C 00 00 00 4B 00 00';

        const parsed = parseFvarTable(unhex(dataWithHidden), 0, names);
        assert.equal(parsed.axes[0].isHidden, false);
        assert.equal(parsed.axes[1].isHidden, true);

        // Round-trip: make a table from the parsed data and verify it matches
        const roundTripped = hex(encode.TABLE(makeFvarTable(parsed, names)));
        assert.deepEqual(dataWithHidden, roundTripped);
    });

    it('parses nameIDs 2 and 17 and postScriptNameID 6 correctly', function() {
        assert.equal(testFont.tables.fvar.instances[0].name.en, 'Regular');
        assert.equal(testFont.tables.fvar.instances[0].subfamilyNameID, 2);
        assert.equal(testFont.tables.fvar.instances[0].postScriptName.en, 'VARTestVF-Regular');
        assert.equal(testFont.tables.fvar.instances[0].postScriptNameID, 6);
        assert.equal(testFont.tables.fvar.instances[0].postScriptName.en, 'VARTestVF-Regular');

        const font = new Font({
            familyName: 'TestFont',
            styleName: 'Medium',
            unitsPerEm: 1000,
            ascender: 800,
            descender: -200,
            glyphs: []
        });
        font.tables.fvar = JSON.parse(JSON.stringify(table));
        font.names.unicode.fontSubfamily = {en: 'Font Subfamily name'};
        font.names.unicode.preferredSubfamily = {en: 'Typographic Subfamily name'};
        font.tables.fvar.instances[0].subfamilyNameID = 2;
        font.tables.fvar.instances[1].subfamilyNameID = 17;

        let parsedFont = parse(font.toArrayBuffer());
        assert.deepEqual(parsedFont.tables.fvar.instances[0].name, font.names.unicode.fontSubfamily);
        assert.deepEqual(parsedFont.tables.fvar.instances[1].name, font.names.unicode.preferredSubfamily);
    });

    it('can make a font variations table', function() {
        const names = {
            macintosh: {
                // When assigning name IDs, numbers below 256 should be ignored,
                // as these are not valid IDs of ‘fvar’ axis or instance names.
                111: {en: 'Name #111'},

                // Existing names with ID 256 or higher should be left untouched,
                // as these can be valid names of font features.
                256: {en: 'Ligatures', ja: 'リガチャ'},

                // Existing names with ID 256 or higher should be re-used.
                257: {en: 'Weight', ja: 'ウエイト'}
            }
        };
        assert.deepEqual(data, hex(encode.TABLE(makeFvarTable(table, names))));
    });

    it('writes postScriptNameID optionally', function() {
        let parsedFont = parse(testFont.toArrayBuffer());
        let makeTable = makeFvarTable(parsedFont.tables.fvar, parsedFont.names);
        assert.equal(parsedFont.tables.fvar.instances[0].postScriptNameID, 6);
        assert.equal(parsedFont.tables.fvar.instances[0].postScriptName.en, 'VARTestVF-Regular');

        assert.equal(makeTable.instanceSize, 10);

        parsedFont.tables.fvar.instances =
            parsedFont.tables.fvar.instances.map(i => { i.postScriptNameID = undefined; return i; });

        parsedFont = parse(parsedFont.toArrayBuffer());
        makeTable = makeFvarTable(parsedFont.tables.fvar, parsedFont.names);

        assert.equal(makeTable.instanceSize, 8);

        assert.equal(parsedFont.tables.fvar.instances[0].postScriptNameID, undefined);
        assert.equal(parsedFont.tables.fvar.instances[1].postScriptNameID, undefined);
    });
});
