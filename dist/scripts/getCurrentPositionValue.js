"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ichiPolygonBlueprint_1 = __importDefault(require("../src/ichiPolygonBlueprint"));
const constants_1 = require("./constants");
const blueprint_lib_1 = require("blueprint-lib");
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const context = new blueprint_lib_1.BlueprintContext(constants_1.blueprintKey, constants_1.chainId, new blueprint_lib_1.AbstractLoggingContext());
const myBlueprint = new ichiPolygonBlueprint_1.default(context);
const mockPositionContext = new blueprint_lib_1.PositionContext(context, [mockSnapshot()], ['0x569a4d03a9b775a64e1e6b2928d699b345d8bdca'], '0x9ff3c1390300918b40714fd464a39699ddd9fe00');
function mockSnapshot(isNewSession = false) {
    const snapshot = {};
    snapshot.isNewSession = isNewSession;
    return snapshot;
}
(async function () {
    try {
        const positionValue = await myBlueprint.getCurrentPositionValue(mockPositionContext);
        console.log(JSON.stringify(positionValue, null, 2));
    }
    catch (error) {
        console.error(error);
        process.exitCode = 1;
    }
})();
//# sourceMappingURL=getCurrentPositionValue.js.map