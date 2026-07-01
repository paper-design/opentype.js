// The `GSUB` table contains ligatures, among other things.
// https://www.microsoft.com/typography/OTSPEC/gsub.htm

import check from '../check.mjs';
import table from '../table.mjs';

// GSUB Writing //////////////////////////////////////////////
const subtableMakers = new Array(9);

subtableMakers[1] = function makeLookup1(subtable) {
    if (subtable.substFormat === 1) {
        return new table.Table('substitutionTable', [
            {name: 'substFormat', type: 'USHORT', value: 1},
            {name: 'coverage', type: 'TABLE', value: new table.Coverage(subtable.coverage)},
            {name: 'deltaGlyphID', type: 'SHORT', value: subtable.deltaGlyphId}
        ]);
    } else if (subtable.substFormat === 2) {
        return new table.Table('substitutionTable', [
            {name: 'substFormat', type: 'USHORT', value: 2},
            {name: 'coverage', type: 'TABLE', value: new table.Coverage(subtable.coverage)}
        ].concat(table.ushortList('substitute', subtable.substitute)));
    }
    check.fail('Lookup type 1 substFormat must be 1 or 2.');
};

subtableMakers[2] = function makeLookup2(subtable) {
    check.assert(subtable.substFormat === 1, 'Lookup type 2 substFormat must be 1.');
    return new table.Table('substitutionTable', [
        {name: 'substFormat', type: 'USHORT', value: 1},
        {name: 'coverage', type: 'TABLE', value: new table.Coverage(subtable.coverage)}
    ].concat(table.tableList('seqSet', subtable.sequences, function(sequenceSet) {
        return new table.Table('sequenceSetTable', table.ushortList('sequence', sequenceSet));
    })));
};

subtableMakers[3] = function makeLookup3(subtable) {
    check.assert(subtable.substFormat === 1, 'Lookup type 3 substFormat must be 1.');
    return new table.Table('substitutionTable', [
        {name: 'substFormat', type: 'USHORT', value: 1},
        {name: 'coverage', type: 'TABLE', value: new table.Coverage(subtable.coverage)}
    ].concat(table.tableList('altSet', subtable.alternateSets, function(alternateSet) {
        return new table.Table('alternateSetTable', table.ushortList('alternate', alternateSet));
    })));
};

subtableMakers[4] = function makeLookup4(subtable) {
    check.assert(subtable.substFormat === 1, 'Lookup type 4 substFormat must be 1.');
    return new table.Table('substitutionTable', [
        {name: 'substFormat', type: 'USHORT', value: 1},
        {name: 'coverage', type: 'TABLE', value: new table.Coverage(subtable.coverage)}
    ].concat(table.tableList('ligSet', subtable.ligatureSets, function(ligatureSet) {
        return new table.Table('ligatureSetTable', table.tableList('ligature', ligatureSet, function(ligature) {
            return new table.Table('ligatureTable',
                [{name: 'ligGlyph', type: 'USHORT', value: ligature.ligGlyph}]
                    .concat(table.ushortList('component', ligature.components, ligature.components.length + 1))
            );
        }));
    })));
};

subtableMakers[5] = function makeLookup5(subtable) {
    if (subtable.substFormat === 1) {
        return new table.Table('contextualSubstitutionTable', [
            {name: 'substFormat', type: 'USHORT', value: subtable.substFormat},
            {name: 'coverage', type: 'TABLE', value: new table.Coverage(subtable.coverage)}
        ].concat(table.tableList('sequenceRuleSet', subtable.ruleSets, function(sequenceRuleSet) {
            if (!sequenceRuleSet) {
                return new table.Table('NULL', null);
            }
            return new table.Table('sequenceRuleSetTable', table.tableList('sequenceRule', sequenceRuleSet, function(sequenceRule) {
                let tableData = table.ushortList('seqLookup', [], sequenceRule.lookupRecords.length)
                    .concat(table.ushortList('inputSequence', sequenceRule.input, sequenceRule.input.length + 1));

                // swap the first two elements, because inputSequenceCount
                // ("glyphCount" in the spec) comes before seqLookupCount
                [tableData[0], tableData[1]] = [tableData[1], tableData[0]];

                for(let i = 0; i < sequenceRule.lookupRecords.length; i++) {
                    const record = sequenceRule.lookupRecords[i];
                    tableData = tableData
                        .concat({name: 'sequenceIndex' + i, type: 'USHORT', value: record.sequenceIndex})
                        .concat({name: 'lookupListIndex' + i, type: 'USHORT', value: record.lookupListIndex});
                }
                return new table.Table('sequenceRuleTable', tableData);
            }));
        })));
    } else if (subtable.substFormat === 2) {
        return new table.Table('contextualSubstitutionTable', [
            {name: 'substFormat', type: 'USHORT', value: subtable.substFormat},
            {name: 'coverage', type: 'TABLE', value: new table.Coverage(subtable.coverage)},
            {name: 'classDef', type: 'TABLE', value: new table.ClassDef(subtable.classDef)}
        ].concat(table.tableList('classSeqRuleSet', subtable.classSets, function(classSeqRuleSet) {
            if (!classSeqRuleSet) {
                return new table.Table('NULL', null);
            }
            return new table.Table('classSeqRuleSetTable', table.tableList('classSeqRule', classSeqRuleSet, function(classSeqRule) {
                let tableData = table.ushortList('classes', classSeqRule.classes, classSeqRule.classes.length + 1)
                    .concat(table.ushortList('seqLookupCount', [], classSeqRule.lookupRecords.length));
                for(let i = 0; i < classSeqRule.lookupRecords.length; i++) {
                    const record = classSeqRule.lookupRecords[i];
                    tableData = tableData
                        .concat({name: 'sequenceIndex' + i, type: 'USHORT', value: record.sequenceIndex})
                        .concat({name: 'lookupListIndex' + i, type: 'USHORT', value: record.lookupListIndex});
                }
                return new table.Table('classSeqRuleTable', tableData);
            }));
        })));
    } else if (subtable.substFormat === 3) {
        let tableData = [
            {name: 'substFormat', type: 'USHORT', value: subtable.substFormat},
        ];

        tableData.push({name: 'inputGlyphCount', type: 'USHORT', value: subtable.coverages.length});
        tableData.push({name: 'substitutionCount', type: 'USHORT', value: subtable.lookupRecords.length});
        for(let i = 0; i < subtable.coverages.length; i++) {
            const coverage = subtable.coverages[i];
            tableData.push({name: 'inputCoverage' + i, type: 'TABLE', value: new table.Coverage(coverage)});
        }

        for(let i = 0; i < subtable.lookupRecords.length; i++) {
            const record = subtable.lookupRecords[i];
            tableData = tableData
                .concat({name: 'sequenceIndex' + i, type: 'USHORT', value: record.sequenceIndex})
                .concat({name: 'lookupListIndex' + i, type: 'USHORT', value: record.lookupListIndex});
        }

        let returnTable = new table.Table('contextualSubstitutionTable', tableData);

        return returnTable;
    }

    check.assert(false, 'lookup type 5 format must be 1, 2 or 3.');
};

subtableMakers[6] = function makeLookup6(subtable) {
    if (subtable.substFormat === 1) {
        let returnTable = new table.Table('chainContextTable', [
            {name: 'substFormat', type: 'USHORT', value: subtable.substFormat},
            {name: 'coverage', type: 'TABLE', value: new table.Coverage(subtable.coverage)}
        ].concat(table.tableList('chainRuleSet', subtable.chainRuleSets, function(chainRuleSet) {
            return new table.Table('chainRuleSetTable', table.tableList('chainRule', chainRuleSet, function(chainRule) {
                let tableData = table.ushortList('backtrackGlyph', chainRule.backtrack, chainRule.backtrack.length)
                    .concat(table.ushortList('inputGlyph', chainRule.input, chainRule.input.length + 1))
                    .concat(table.ushortList('lookaheadGlyph', chainRule.lookahead, chainRule.lookahead.length))
                    .concat(table.ushortList('substitution', [], chainRule.lookupRecords.length));

                for(let i = 0; i < chainRule.lookupRecords.length; i++) {
                    const record = chainRule.lookupRecords[i];
                    tableData = tableData
                        .concat({name: 'sequenceIndex' + i, type: 'USHORT', value: record.sequenceIndex})
                        .concat({name: 'lookupListIndex' + i, type: 'USHORT', value: record.lookupListIndex});
                }
                return new table.Table('chainRuleTable', tableData);
            }));
        })));
        return returnTable;
    } else if (subtable.substFormat === 2) {
        check.assert(false, 'lookup type 6 format 2 is not yet supported.');
    } else if (subtable.substFormat === 3) {
        let tableData = [
            {name: 'substFormat', type: 'USHORT', value: subtable.substFormat},
        ];

        tableData.push({name: 'backtrackGlyphCount', type: 'USHORT', value: subtable.backtrackCoverage.length});
        for(let i = 0; i < subtable.backtrackCoverage.length; i++) {
            const coverage = subtable.backtrackCoverage[i];
            tableData.push({name: 'backtrackCoverage' + i, type: 'TABLE', value: new table.Coverage(coverage)});
        }
        tableData.push({name: 'inputGlyphCount', type: 'USHORT', value: subtable.inputCoverage.length});
        
        for(let i = 0; i < subtable.inputCoverage.length; i++) {
            const coverage = subtable.inputCoverage[i];
            tableData.push({name: 'inputCoverage' + i, type: 'TABLE', value: new table.Coverage(coverage)});
        }
        tableData.push({name: 'lookaheadGlyphCount', type: 'USHORT', value: subtable.lookaheadCoverage.length});
        
        for(let i = 0; i < subtable.lookaheadCoverage.length; i++) {
            const coverage = subtable.lookaheadCoverage[i];
            tableData.push({name: 'lookaheadCoverage' + i, type: 'TABLE', value: new table.Coverage(coverage)});
        }

        tableData.push({name: 'substitutionCount', type: 'USHORT', value: subtable.lookupRecords.length});
        for(let i = 0; i < subtable.lookupRecords.length; i++) {
            const record = subtable.lookupRecords[i];
            tableData = tableData
                .concat({name: 'sequenceIndex' + i, type: 'USHORT', value: record.sequenceIndex})
                .concat({name: 'lookupListIndex' + i, type: 'USHORT', value: record.lookupListIndex});
        }

        let returnTable = new table.Table('chainContextTable', tableData);

        return returnTable;
    }

    check.assert(false, 'lookup type 6 format must be 1, 2 or 3.');
};

export function makeGsubTable(gsub) {
    return new table.Table('GSUB', [
        {name: 'version', type: 'ULONG', value: 0x10000},
        {name: 'scripts', type: 'TABLE', value: new table.ScriptList(gsub.scripts)},
        {name: 'features', type: 'TABLE', value: new table.FeatureList(gsub.features)},
        {name: 'lookups', type: 'TABLE', value: new table.LookupList(gsub.lookups, subtableMakers)}
    ]);
}
