import BigNumber from 'bignumber.js';
import { BlueprintContext } from 'blueprint-lib';
import { ethers } from 'ethers';
export declare class EvmContractReader {
    protected context: BlueprintContext;
    private readonly networkId;
    constructor(context: BlueprintContext);
    fetchOrCachedTx(txHash: any): Promise<ethers.providers.TransactionResponse>;
    fetchOrCachedTxReceipt(txHash: string): Promise<ethers.providers.TransactionReceipt>;
    getDecimalPlaces(tokenAddrs: string): Promise<number>;
    fetchOrCachedGasPrice(): Promise<BigNumber>;
    fetchGasUsedInTransaction(txHash: string, decimals?: number): Promise<BigNumber>;
}
