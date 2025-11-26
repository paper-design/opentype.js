// The `fvar` table stores font variation axes and instances.
// https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6fvar.html

import table from '../table.mjs';
import { sizeOf } from './size-of.mjs';

function makeFvarAxis(n, axis) {
    return [
        { name: 'tag_' + n, type: 'TAG', value: axis.tag },
        { name: 'minValue_' + n, type: 'FIXED', value: axis.minValue << 16 },
        { name: 'defaultValue_' + n, type: 'FIXED', value: axis.defaultValue << 16 },
        { name: 'maxValue_' + n, type: 'FIXED', value: axis.maxValue << 16 },
        { name: 'flags_' + n, type: 'USHORT', value: axis.isHidden ? 0x0001 : 0 },
        { name: 'nameID_' + n, type: 'USHORT', value: axis.axisNameID }
    ];
}

function makeFvarInstance(n, inst, axes, optionalFields = {}) {
    const fields = [
        { name: 'nameID_' + n, type: 'USHORT', value: inst.subfamilyNameID },
        { name: 'flags_' + n, type: 'USHORT', value: 0 }
    ];

    for (let i = 0; i < axes.length; ++i) {
        const axisTag = axes[i].tag;
        fields.push({
            name: 'axis_' + n + ' ' + axisTag,
            type: 'FIXED',
            value: inst.coordinates[axisTag] << 16
        });
    }

    if (optionalFields && optionalFields.postScriptNameID) {
        fields.push({
            name: 'postScriptNameID_',
            type: 'USHORT',
            value: inst.postScriptNameID !== undefined ? inst.postScriptNameID : 0xFFFF
        });
    }

    return fields;
}


export function makeFvarTable(fvar, names) {

    const result = new table.Table('fvar', [
        { name: 'version', type: 'ULONG', value: 0x10000 },
        { name: 'offsetToData', type: 'USHORT', value: 0 },
        { name: 'countSizePairs', type: 'USHORT', value: 2 },
        { name: 'axisCount', type: 'USHORT', value: fvar.axes.length },
        { name: 'axisSize', type: 'USHORT', value: 20 },
        { name: 'instanceCount', type: 'USHORT', value: fvar.instances.length },
        { name: 'instanceSize', type: 'USHORT', value: 4 + fvar.axes.length * 4 }
    ]);
    result.offsetToData = sizeOf.TABLE(result);

    for (let i = 0; i < fvar.axes.length; i++) {
        result.fields = result.fields.concat(makeFvarAxis(i, fvar.axes[i], names));
    }

    const optionalFields = {};

    // first loop over instances: find out if at least one has postScriptNameID defined
    for (let j = 0; j < fvar.instances.length; j++) {
        if (fvar.instances[j].postScriptNameID !== undefined) {
            result.instanceSize += 2;
            optionalFields.postScriptNameID = true;
            break;
        }
    }

    // second loop over instances: find out if at least one has postScriptNameID defined
    for (let j = 0; j < fvar.instances.length; j++) {
        result.fields = result.fields.concat(makeFvarInstance(
            j,
            fvar.instances[j],
            fvar.axes,
            optionalFields
        ));
    }

    return result;
}
