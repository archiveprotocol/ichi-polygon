"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("./constants");
const ichiBlueprint_1 = require("./ichiBlueprint");
class IchiPolygonBlueprint extends ichiBlueprint_1.IchiBlueprint {
    constructor() {
        super(...arguments);
        this.protocolKey = constants_1.blueprintKey;
        this.protocolName = 'Ichi';
        this.subgraphUrl = 'https://api.thegraph.com/subgraphs/name/ichi-org/polygon-v1';
    }
    getTestWalletAddresses() {
        return [
            '0x569a4d03a9b775a64e1e6b2928d699b345d8bdca',
            '0x0e064ea0a357d9f8bc5b74a3c57bc88b4c48a53d',
            '0x73ca04a777fd8d1681a253e8ab958b8fef1c0a24',
        ];
    }
}
exports.default = IchiPolygonBlueprint;
//# sourceMappingURL=ichiPolygonBlueprint.js.map