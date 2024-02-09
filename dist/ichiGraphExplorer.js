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
exports.IchiGraphExplorer = void 0;
// import { BlueprintKey } from '@src/blueprint/blueprintRegistry';
const archive_axios_1 = require("archive-axios");
const graphql_request_1 = require("graphql-request");
class IchiGraphExplorer extends archive_axios_1.ApGraphQLManager {
    constructor(axiosManager, subgraphurl) {
        super(axiosManager, subgraphurl);
    }
    fetchGraphQlData(query, targetAddress, fromBlock, createdAtTimestamp) {
        return __awaiter(this, void 0, void 0, function* () {
            const variables = Object.assign(Object.assign(Object.assign({}, ((fromBlock || fromBlock === 0) && { fromBlock: fromBlock })), (targetAddress && { targetAddress: targetAddress })), (createdAtTimestamp !== undefined && { createdAtTimestamp: createdAtTimestamp }));
            const res = (yield this.executeGraphQLQueryOrThrowError(query, variables));
            return res.data;
        });
    }
    queryLastSyncedBlock() {
        return __awaiter(this, void 0, void 0, function* () {
            const query = (0, graphql_request_1.gql) `
      query {
        _meta {
          block {
            hash
            timestamp
            number
          }
        }
      }
    `;
            const data = yield this.fetchGraphQlData(query);
            return parseInt(data._meta.block.number);
        });
    }
    queryVaultDeposits(userAddress, fromBlock) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = (0, graphql_request_1.gql) `
      query ($fromBlock: Int!, $targetAddress: Bytes!) {
        vaultDeposits(
          where: ${this.getVaultDepositsWhereClause()}
          block: { number_gte: $fromBlock }
        ) {
          id
          vault
          shares
          amount0
          amount1
          createdAtTimestamp
        }
      }
    `;
            const data = yield this.fetchGraphQlData(query, userAddress, fromBlock);
            return data.vaultDeposits;
        });
    }
    getUserList(createdAtTimestamp) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = (0, graphql_request_1.gql) `
      query ($createdAtTimestamp: Int!) {
        vaultDeposits(first: 1000, where: { createdAtTimestamp_gt: $createdAtTimestamp }, orderBy: createdAtTimestamp) {
          sender
          createdAtTimestamp
        }
      }
    `;
            const data = yield this.fetchGraphQlData(query, undefined, undefined, createdAtTimestamp);
            if (!data || !data.vaultDeposits)
                return;
            return data.vaultDeposits.map((deposit) => {
                return { sender: deposit.sender, timestamp: deposit.createdAtTimestamp };
            });
        });
    }
    queryVaultWithdraws(userAddress, fromBlock) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = (0, graphql_request_1.gql) `
      query ($fromBlock: Int!, $targetAddress: Bytes!) {
        vaultWithdraws(where: { sender: $targetAddress }, block: { number_gte: $fromBlock }) {
          id
          vault
          shares
          amount0
          amount1
          createdAtTimestamp
        }
      }
    `;
            const data = yield this.fetchGraphQlData(query, userAddress, fromBlock);
            return data.vaultWithdraws;
        });
    }
    queryIchiVaults() {
        return __awaiter(this, void 0, void 0, function* () {
            const query = (0, graphql_request_1.gql) `
      query {
        ichiVaults {
          id
          sender
          tokenA
          tokenB
        }
      }
    `;
            const data = yield this.fetchGraphQlData(query);
            return data.ichiVaults;
        });
    }
    getVaultDepositsWhereClause() {
        return `{ or: [{ sender: $targetAddress }, { to: $targetAddress }] }`;
    }
}
exports.IchiGraphExplorer = IchiGraphExplorer;
