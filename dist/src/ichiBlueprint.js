"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IchiBlueprint = void 0;
const handler_1 = require("./handler");
const blueprint_lib_1 = require("blueprint-lib");
class IchiBlueprint {
    constructor(context) {
        this.context = context;
    }
    getTestWalletAddresses() {
        return [''];
    }
    syncMetadata(_metadataStore, _lastSyncAt) {
        return Promise.resolve(0);
    }
    syncMetadataInterval() {
        return 0;
    }
    getBlueprintKey() {
        return this.protocolKey;
    }
    getParentBlueprintId() {
        return '';
    }
    getContext() {
        return this.context;
    }
    getBlueprintCategory() {
        return blueprint_lib_1.BlueprintCategory.LIQUIDITY_MANAGER;
    }
    async getUserList(fromBlock) {
        this.initHandler();
        return this.handler.getUserList(fromBlock);
    }
    getContractName() {
        return this.protocolName;
    }
    initHandler() {
        if (!this.handler) {
            this.handler = new handler_1.Handler(this.context, this.subgraphUrl, this.getBlueprintKey());
        }
    }
    async getUserTransactions(context, userAddresses, fromBlock) {
        this.initHandler();
        return this.handler.getUserTransactions(userAddresses, fromBlock);
    }
    async classifyTransaction(context, txn) {
        this.initHandler();
        return this.handler.classifyTx(txn);
    }
    async getCurrentPositionValue({ positionSnapshots, userAddresses, positionIdentifier, }) {
        if (positionSnapshots.length == 0) {
            return new blueprint_lib_1.PositionValue(0, (0, blueprint_lib_1.createNilPositionShares)());
        }
        this.initHandler();
        return this.handler.getPositionValue(positionIdentifier, userAddresses);
    }
    async getPositionValueAt({ positionSnapshots, userAddresses, positionIdentifier }, { blockNumber }) {
        if (positionSnapshots.length == 0) {
            return new blueprint_lib_1.PositionValue(0, (0, blueprint_lib_1.createNilPositionShares)());
        }
        this.initHandler();
        return this.handler.getPositionValue(positionIdentifier, userAddresses, blockNumber);
    }
}
exports.IchiBlueprint = IchiBlueprint;
//# sourceMappingURL=ichiBlueprint.js.map