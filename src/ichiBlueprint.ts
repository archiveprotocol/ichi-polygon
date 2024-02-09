import { Handler } from './handler';
import {
  Blueprint,
  BlueprintCategory,
  BlueprintContext,
  Classification,
  MetadataStore,
  PositionContext,
  PositionValue,
  TimeContext,
  TransactionDetails,
  UserTransactionResults,
  createNilPositionShares,
} from 'blueprint-lib';

export abstract class IchiBlueprint implements Blueprint {
  readonly protocolKey: string;
  readonly protocolName: string;
  readonly subgraphUrl: string;
  protected handler: Handler;

  constructor(protected context: BlueprintContext) {}

  getTestWalletAddresses(): string[] {
    return [''];
  }

  syncMetadata(_metadataStore: MetadataStore, _lastSyncAt: number): Promise<number> {
    return Promise.resolve(0);
  }

  syncMetadataInterval(): number {
    return 0;
  }

  getBlueprintKey(): string {
    return this.protocolKey;
  }

  getParentBlueprintId(): string {
    return '';
  }

  getContext(): BlueprintContext {
    return this.context;
  }

  getBlueprintCategory(): string {
    return BlueprintCategory.LIQUIDITY_MANAGER;
  }

  async getUserList(fromBlock: number): Promise<string[]> {
    this.initHandler();
    return this.handler.getUserList(fromBlock);
  }

  getContractName(): string {
    return this.protocolName;
  }

  private initHandler() {
    if (!this.handler) {
      this.handler = new Handler(this.context, this.subgraphUrl, this.getBlueprintKey());
    }
  }

  async getUserTransactions(
    context: BlueprintContext,
    userAddresses: string[],
    fromBlock: number,
  ): Promise<UserTransactionResults> {
    this.initHandler();
    return this.handler.getUserTransactions(userAddresses, fromBlock);
  }

  async classifyTransaction(context: BlueprintContext, txn: TransactionDetails): Promise<Classification[]> {
    this.initHandler();
    return this.handler.classifyTx(txn);
  }

  async getCurrentPositionValue({
    positionSnapshots,
    userAddresses,
    positionIdentifier,
  }: PositionContext): Promise<PositionValue> {
    if (positionSnapshots.length == 0) {
      return new PositionValue(0, createNilPositionShares());
    }

    this.initHandler();
    return this.handler.getPositionValue(positionIdentifier, userAddresses);
  }

  async getPositionValueAt(
    { positionSnapshots, userAddresses, positionIdentifier }: PositionContext,
    { blockNumber }: TimeContext,
  ): Promise<PositionValue> {
    if (positionSnapshots.length == 0) {
      return new PositionValue(0, createNilPositionShares());
    }

    this.initHandler();
    return this.handler.getPositionValue(positionIdentifier, userAddresses, blockNumber);
  }
}
