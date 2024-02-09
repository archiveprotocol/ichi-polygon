"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ichiPolygonBlueprint_1 = __importDefault(require("../src/ichiPolygonBlueprint"));
const blueprint_lib_1 = require("blueprint-lib");
const constants_1 = require("./constants");
const context = new blueprint_lib_1.BlueprintContext(constants_1.blueprintKey, constants_1.chainId, new blueprint_lib_1.AbstractLoggingContext());
const myBlueprint = new ichiPolygonBlueprint_1.default(context);
(async function () {
    const userAddress = '0x569a4d03a9b775a64e1e6b2928d699b345d8bdca';
    const fromBlock = 1;
    try {
        const txns = await myBlueprint.getUserTransactions(context, [userAddress], fromBlock);
        console.log(txns);
    }
    catch (error) {
        console.error(error);
        process.exitCode = 1;
    }
})();
//# sourceMappingURL=getUserTransactions.js.map