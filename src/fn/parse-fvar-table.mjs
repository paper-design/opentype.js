// The `fvar` table stores font variation axes and instances.
// https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6fvar.html

import check from '../check.mjs';
import parse from '../parse.mjs';
import { getNameByID } from './get-name-by-id.mjs';

function parseFvarAxis(data, start, names) {
    const axis = {};
    const p = new parse.Parser(data, start);
    axis.tag = p.parseTag();
    axis.minValue = p.parseFixed();
    axis.defaultValue = p.parseFixed();
    axis.maxValue = p.parseFixed();
    const flags = p.parseUShort();
    axis.isHidden = (flags & 0x0001) !== 0;
    const axisNameID = p.parseUShort();
    axis.axisNameID = axisNameID;
    axis.name = getNameByID(names, axisNameID);
    return axis;
}

function parseFvarInstance(data, start, axes, names, instanceSize) {
    const inst = {};
    const p = new parse.Parser(data, start);
    const subfamilyNameID = p.parseUShort();
    inst.subfamilyNameID = subfamilyNameID;
    inst.name = getNameByID(names, subfamilyNameID, [2, 17]);
    p.skip('uShort', 1);  // reserved for flags; no values defined

    inst.coordinates = {};
    for (let i = 0; i < axes.length; ++i) {
        inst.coordinates[axes[i].tag] = p.parseFixed();
    }

    if (p.relativeOffset === instanceSize) {
        inst.postScriptNameID = undefined;
        inst.postScriptName = undefined;
        return inst;
    }

    const postScriptNameID = p.parseUShort();
    inst.postScriptNameID = postScriptNameID == 0xFFFF ? undefined : postScriptNameID;
    inst.postScriptName = inst.postScriptNameID !== undefined ? getNameByID(names, postScriptNameID, [6]) : '';

    return inst;
}

export function parseFvarTable(data, start, names) {
    const p = new parse.Parser(data, start);
    const tableVersion = p.parseULong();
    check.argument(tableVersion === 0x00010000, 'Unsupported fvar table version.');
    const offsetToData = p.parseOffset16();
    // Skip countSizePairs.
    p.skip('uShort', 1);
    const axisCount = p.parseUShort();
    const axisSize = p.parseUShort();
    const instanceCount = p.parseUShort();
    const instanceSize = p.parseUShort();

    const axes = [];
    for (let i = 0; i < axisCount; i++) {
        axes.push(parseFvarAxis(data, start + offsetToData + i * axisSize, names));
    }

    const instances = [];
    const instanceStart = start + offsetToData + axisCount * axisSize;
    for (let j = 0; j < instanceCount; j++) {
        instances.push(parseFvarInstance(data, instanceStart + j * instanceSize, axes, names, instanceSize));
    }

    return { axes: axes, instances: instances };
}
