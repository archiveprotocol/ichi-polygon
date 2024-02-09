"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IchiGraphExplorer = void 0;
const archive_axios_1 = require("archive-axios");
const graphql_request_1 = require("graphql-request");
class IchiGraphExplorer extends archive_axios_1.ApGraphQLManager {
    constructor(axiosManager, subgraphurl) {
        super(axiosManager, subgraphurl);
    }
    async fetchGraphQlData(query, targetAddress, fromBlock, createdAtTimestamp) {
        const variables = {
            ...((fromBlock || fromBlock === 0) && { fromBlock: fromBlock }),
            ...(targetAddress && { targetAddress: targetAddress }),
            ...(createdAtTimestamp !== undefined && { createdAtTimestamp: createdAtTimestamp }),
        };
        const res = (await this.executeGraphQLQueryOrThrowError(query, variables));
        return res.data;
    }
    async queryLastSyncedBlock() {
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
        const data = await this.fetchGraphQlData(query);
        return parseInt(data._meta.block.number);
    }
    async queryVaultDeposits(userAddress, fromBlock) {
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
        const data = await this.fetchGraphQlData(query, userAddress, fromBlock);
        return data.vaultDeposits;
    }
    async getUserList(createdAtTimestamp) {
        const query = (0, graphql_request_1.gql) `
      query ($createdAtTimestamp: Int!) {
        vaultDeposits(first: 1000, where: { createdAtTimestamp_gt: $createdAtTimestamp }, orderBy: createdAtTimestamp) {
          sender
          createdAtTimestamp
        }
      }
    `;
        const data = await this.fetchGraphQlData(query, undefined, undefined, createdAtTimestamp);
        if (!data || !data.vaultDeposits)
            return;
        return data.vaultDeposits.map((deposit) => {
            return { sender: deposit.sender, timestamp: deposit.createdAtTimestamp };
        });
    }
    async queryVaultWithdraws(userAddress, fromBlock) {
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
        const data = await this.fetchGraphQlData(query, userAddress, fromBlock);
        return data.vaultWithdraws;
    }
    async queryIchiVaults() {
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
        const data = await this.fetchGraphQlData(query);
        return data.ichiVaults;
    }
    getVaultDepositsWhereClause() {
        return `{ or: [{ sender: $targetAddress }, { to: $targetAddress }] }`;
    }
}
exports.IchiGraphExplorer = IchiGraphExplorer;
//# sourceMappingURL=ichiGraphExplorer.js.map