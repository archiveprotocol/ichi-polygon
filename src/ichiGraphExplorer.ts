import { DepositOrWithdrawResult, Vault } from './models';
import { ApAxiosManager, ApGraphQLManager } from 'archive-axios';
import { UserAddressWithTimestamp } from 'blueprint-lib';
import { gql } from 'graphql-request';

export class IchiGraphExplorer extends ApGraphQLManager {
  constructor(axiosManager: ApAxiosManager, subgraphurl: string) {
    super(axiosManager, subgraphurl);
  }

  async fetchGraphQlData(
    query: string,
    targetAddress?: string,
    fromBlock?: number,
    createdAtTimestamp?: number,
  ): Promise<any> {
    const variables = {
      ...((fromBlock || fromBlock === 0) && { fromBlock: fromBlock }),
      ...(targetAddress && { targetAddress: targetAddress }),
      ...(createdAtTimestamp !== undefined && { createdAtTimestamp: createdAtTimestamp }),
    };

    const res = (await this.executeGraphQLQueryOrThrowError(query, variables)) as any;
    return res.data;
  }

  async queryLastSyncedBlock(): Promise<number> {
    const query = gql`
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

  async queryVaultDeposits(userAddress: string, fromBlock: number): Promise<DepositOrWithdrawResult[]> {
    const query = gql`
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

  async getUserList(createdAtTimestamp: number): Promise<UserAddressWithTimestamp[]> {
    const query = gql`
      query ($createdAtTimestamp: Int!) {
        vaultDeposits(first: 1000, where: { createdAtTimestamp_gt: $createdAtTimestamp }, orderBy: createdAtTimestamp) {
          sender
          createdAtTimestamp
        }
      }
    `;

    const data = await this.fetchGraphQlData(query, undefined, undefined, createdAtTimestamp);
    if (!data || !data.vaultDeposits) return;

    return data.vaultDeposits.map((deposit) => {
      return { sender: deposit.sender, timestamp: deposit.createdAtTimestamp } as UserAddressWithTimestamp;
    });
  }

  async queryVaultWithdraws(userAddress: string, fromBlock: number): Promise<DepositOrWithdrawResult[]> {
    const query = gql`
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

  async queryIchiVaults(): Promise<[Vault]> {
    const query = gql`
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

  private getVaultDepositsWhereClause() {
    return `{ or: [{ sender: $targetAddress }, { to: $targetAddress }] }`;
  }
}
