import { DepositOrWithdrawResult, Vault } from './models';
import { ApAxiosManager, ApGraphQLManager } from 'archive-axios';
import { UserAddressWithTimestamp } from 'blueprint-lib';
export declare class IchiGraphExplorer extends ApGraphQLManager {
    constructor(axiosManager: ApAxiosManager, subgraphurl: string);
    fetchGraphQlData(query: string, targetAddress?: string, fromBlock?: number, createdAtTimestamp?: number): Promise<any>;
    queryLastSyncedBlock(): Promise<number>;
    queryVaultDeposits(userAddress: string, fromBlock: number): Promise<DepositOrWithdrawResult[]>;
    getUserList(createdAtTimestamp: number): Promise<UserAddressWithTimestamp[]>;
    queryVaultWithdraws(userAddress: string, fromBlock: number): Promise<DepositOrWithdrawResult[]>;
    queryIchiVaults(): Promise<[Vault]>;
    private getVaultDepositsWhereClause;
}
