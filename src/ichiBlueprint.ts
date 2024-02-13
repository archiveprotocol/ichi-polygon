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
    return [
      '0x569a4d03a9b775a64e1e6b2928d699b345d8bdca', // Partial exit
      '0x0e064ea0a357d9f8bc5b74a3c57bc88b4c48a53d', // Full exit
      '0x73ca04a777fd8d1681a253e8ab958b8fef1c0a24', // Re-entering after full exit
    ];
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
