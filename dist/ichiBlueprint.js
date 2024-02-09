"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IchiBlueprint = void 0;
// import { PositionContext } from '../../blueprint/dto/positionContext';
// import { PositionValue } from '../../blueprint/dto/positionValue';
// import { TransactionDetails } from '../../blueprint/dto/transactionDetails';
// import { UserTransactionResults } from '../../blueprint/dto/userTransactionResults';
// import { createNilPositionShares } from '../common/utils';
// import { Handler } from './handler';
// import { Blueprint } from '@src/blueprint/blueprintInterface';
// import { BlueprintCategory } from '@src/blueprint/blueprintRegistry';
// import { Classification } from '@src/blueprint/dto/classification';
// import { TimeContext } from '@src/blueprint/dto/timeContext';
// import { BlueprintContext } from '@src/common/blueprintContext';
// import { MetadataStore } from '@src/meta/metadataStore';
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
        return this.context.getComposedBlueprintKey() || this.protocolKey;
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
    getUserList(fromBlock) {
        return __awaiter(this, void 0, void 0, function* () {
            this.initHandler();
            return this.handler.getUserList(fromBlock);
        });
    }
    getContractName() {
        return this.protocolName;
    }
    initHandler() {
        if (!this.handler) {
            this.handler = new handler_1.Handler(this.context, this.subgraphUrl, this.getBlueprintKey());
        }
    }
    getUserTransactions(context, userAddresses, fromBlock) {
        return __awaiter(this, void 0, void 0, function* () {
            this.initHandler();
            return this.handler.getUserTransactions(userAddresses, fromBlock);
        });
    }
    classifyTransaction(context, txn) {
        return __awaiter(this, void 0, void 0, function* () {
            this.initHandler();
            return this.handler.classifyTx(txn);
        });
    }
    getCurrentPositionValue({ positionSnapshots, userAddresses, positionIdentifier, }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (positionSnapshots.length == 0) {
                return new blueprint_lib_1.PositionValue(0, (0, blueprint_lib_1.createNilPositionShares)());
            }
            this.initHandler();
            return this.handler.getPositionValue(positionIdentifier, userAddresses);
        });
    }
    getPositionValueAt({ positionSnapshots, userAddresses, positionIdentifier }, { blockNumber }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (positionSnapshots.length == 0) {
                return new blueprint_lib_1.PositionValue(0, (0, blueprint_lib_1.createNilPositionShares)());
            }
            this.initHandler();
            return this.handler.getPositionValue(positionIdentifier, userAddresses, blockNumber);
        });
    }
}
exports.IchiBlueprint = IchiBlueprint;
