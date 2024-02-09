import { Handler } from './handler';
import { Blueprint, BlueprintContext, Classification, MetadataStore, PositionContext, PositionValue, TimeContext, TransactionDetails, UserTransactionResults } from 'blueprint-lib';
export declare abstract class IchiBlueprint implements Blueprint {
    protected context: BlueprintContext;
    readonly protocolKey: string;
    readonly protocolName: string;
    readonly subgraphUrl: string;
    protected handler: Handler;
    constructor(context: BlueprintContext);
    getTestWalletAddresses(): string[];
    syncMetadata(_metadataStore: MetadataStore, _lastSyncAt: number): Promise<number>;
    syncMetadataInterval(): number;
    getBlueprintKey(): string;
    getParentBlueprintId(): string;
    getContext(): BlueprintContext;
    getBlueprintCategory(): string;
    getUserList(fromBlock: number): Promise<string[]>;
    getContractName(): string;
    private initHandler;
    getUserTransactions(context: BlueprintContext, userAddresses: string[], fromBlock: number): Promise<UserTransactionResults>;
    classifyTransaction(context: BlueprintContext, txn: TransactionDetails): Promise<Classification[]>;
    getCurrentPositionValue({ positionSnapshots, userAddresses, positionIdentifier, }: PositionContext): Promise<PositionValue>;
    getPositionValueAt({ positionSnapshots, userAddresses, positionIdentifier }: PositionContext, { blockNumber }: TimeContext): Promise<PositionValue>;
}
