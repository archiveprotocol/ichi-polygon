import { OperationType } from 'blueprint-lib';
export interface DepositOrWithdrawResult {
    id: string;
    vault: string;
    operation: OperationType;
    sender: string;
    shares: string;
    amount0: string;
    amount1: string;
    createdAtTimestamp: number;
    blockNumber: number;
}
export interface Vault {
    id: string;
    sender: string;
    tokenA: string;
    tokenB: string;
    wrapper?: string;
}
