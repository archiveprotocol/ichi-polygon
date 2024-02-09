"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IchiPolygonBlueprint = void 0;
// import { BlueprintKey } from '../../../blueprint/blueprintRegistry';
const ichiBlueprint_1 = require("./ichiBlueprint");
class IchiPolygonBlueprint extends ichiBlueprint_1.IchiBlueprint {
    constructor() {
        super(...arguments);
        // readonly protocolKey: string = BlueprintKey.ICHI_POLYGON;
        this.protocolKey = 'ichi-polygon';
        this.protocolName = 'Ichi';
        this.subgraphUrl = 'https://api.thegraph.com/subgraphs/name/ichi-org/polygon-v1';
    }
    getTestWalletAddresses() {
        return [
            '0x569a4d03a9b775a64e1e6b2928d699b345d8bdca', // Partial exit
            '0x0e064ea0a357d9f8bc5b74a3c57bc88b4c48a53d', // Full exit
            '0x73ca04a777fd8d1681a253e8ab958b8fef1c0a24', // Re-entering after full exit
        ];
    }
}
exports.IchiPolygonBlueprint = IchiPolygonBlueprint;
