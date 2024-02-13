import { vaultAbi, wrapperAbi } from './abi';
import { rpcUrls } from './constants';
import { IchiGraphExplorer } from './ichiGraphExplorer';
import { DepositOrWithdrawResult, Vault } from './models';
import { ApAxiosManager } from 'archive-axios';
import BigNumber from 'bignumber.js';
import {
  BlueprintContext,
  Classification,
  EvmContractReader,
  Operation,
  OperationType,
  PositionShares,
  PositionValue,
  STACKTRACE_KEY,
  TokenInfo,
  TransactionDetails,
  UserTransactionResults,
  formatAsDecimalAwareString,
  getBlockTag,
  populateUserListFromSubgraph,
} from 'blueprint-lib';
import { ethers } from 'ethers';
import { Logger } from 'log4js';
import { KafkaManager } from 'logging-library';
import { executeCallOrSend } from 'web3-wrapper-library';

const ICHI_LP_SOURCE = 'ichi-pool';

export class Handler {
  private logger: Logger;
  private contractReader: EvmContractReader;
  private axiosManager: ApAxiosManager;
  private _vaults: Map<string, Vault>;
  private subgraphUrl;
  private subgraph: IchiGraphExplorer;
  private readonly rpcUrl: string;

  constructor(
    private context: BlueprintContext,
    subgraph_url: string,
    private readonly blueprintKey: string,
  ) {
    this._vaults = new Map();
    this.logger = this.context.getLogger();
    this._subgraphResults = new Map();
    this.axiosManager = new ApAxiosManager(blueprintKey, KafkaManager.getInstance());
    this.contractReader = new EvmContractReader(this.context);
    this.subgraphUrl = subgraph_url;
    this.axiosManager.setup({
      headers: {
        'Accept-Encoding': '*',
      },
      timeout: 1000 * 60, // one minute in milliseconds
    });
  }

  public get vaults(): Map<string, Vault> {
    return this._vaults;
  }

  private _subgraphResults: Map<string, DepositOrWithdrawResult>;
  public get subgraphResults(): Map<string, DepositOrWithdrawResult> {
    return this._subgraphResults;
  }

  async initSubgraph() {
    if (!this.subgraph) this.subgraph = new IchiGraphExplorer(this.axiosManager, this.subgraphUrl);
  }

  async getUserTransactions(userAddresses: string[], fromBlock: number): Promise<UserTransactionResults> {
    await this.initSubgraph();

    const lastSyncedBlock = await this.subgraph.queryLastSyncedBlock();

    await Promise.all([
      this.fetchAndSetDepositsIntoMap(userAddresses, fromBlock),
      this.fetchAndSetWithdrawalsIntoMap(userAddresses, fromBlock),
      this.fetchAndSetVaultsIntoMap(),
    ]);

    const filteredTxns = Array.from(this._subgraphResults).filter(
      ([, value]) => userAddresses.includes(value.sender) && value.blockNumber >= fromBlock,
    );

    const transactionDetails = filteredTxns.map(
      ([txnHash, value]) =>
        new TransactionDetails(txnHash, Number(value.blockNumber), Number(value.createdAtTimestamp)),
    );
    transactionDetails.sort((a, b) => a.blockNumber - b.blockNumber);

    return new UserTransactionResults(transactionDetails, lastSyncedBlock);
  }

  private async fetchAndSetDepositsIntoMap(userAddresses: string[], fromBlock: number): Promise<void> {
    await Promise.all(
      userAddresses.map(async (userAddress) => {
        const deposits = await this.subgraph.queryVaultDeposits(userAddress, fromBlock);

        for (const deposit of deposits) {
          const txHash = deposit.id.split('-')[0];
          deposit.operation = OperationType.DEPOSIT;
          deposit.sender = userAddress;
          const tx = await this.contractReader.fetchOrCachedTx(txHash);
          deposit['blockNumber'] = tx?.blockNumber || 0;

          this._subgraphResults.set(txHash, deposit);
        }
      }),
    );
  }

  private async fetchAndSetWithdrawalsIntoMap(userAddresses: string[], fromBlock: number): Promise<void> {
    await Promise.all(
      userAddresses.map(async (userAddress) => {
        const withdraws = await this.subgraph.queryVaultWithdraws(userAddress, fromBlock);

        for (const withdraw of withdraws) {
          const txHash = withdraw.id.split('-')[0];
          withdraw.operation = OperationType.WITHDRAW;
          withdraw.sender = userAddress;
          const tx = await this.contractReader.fetchOrCachedTx(txHash);
          withdraw['blockNumber'] = tx?.blockNumber || 0;

          this._subgraphResults.set(txHash, withdraw);
        }
      }),
    );
  }

  async classifyTx(txn: TransactionDetails): Promise<Classification[]> {
    const txnHash = txn.txHash;
    const inputTokens: TokenInfo[] = [];
    const outputTokens: TokenInfo[] = [];

    if (!this.subgraphResults.has(txnHash)) {
      this.logger.log(`TxHash ${txnHash} not found in subgraph results`);
      return [];
    }

    const subgraphResult = this.subgraphResults.get(txnHash);
    const operationType = subgraphResult.operation;

    const positionIdentifier = subgraphResult.vault;

    const [gasTokenAmount, { token0, token1, lpToken }] = await Promise.all([
      this.contractReader.fetchGasUsedInTransaction(txnHash),
      this.getTokenInfosFromDepositOrWithdraw(subgraphResult),
    ]);

    switch (operationType) {
      case OperationType.DEPOSIT:
        // for bril we need to use the wrapper address to get the shares of the user
        // so we need to fetch the wrapper address from the logs and set it into the vault map
        // await this.maybeSetWrapperAddressIntoVault(txnHash, positionIdentifier);
        // Deposited token is partially swapped to the paired token in the vault automatically.
        // So, put both token0 and token1 into inputTokens, even if that amount is 0 to show them as an underlying token.
        inputTokens.push(token0);
        inputTokens.push(token1);
        outputTokens.push(lpToken);
        break;
      case OperationType.WITHDRAW:
        if (!token0.amount.eq(0)) outputTokens.push(token0);
        if (!token1.amount.eq(0)) outputTokens.push(token1);
        inputTokens.push(lpToken);
        break;
      default:
        break;
    }

    const operations = [new Operation(operationType, inputTokens, outputTokens)];

    return [
      new Classification(operations, positionIdentifier, BigNumber(gasTokenAmount), [
        new PositionShares(
          positionIdentifier,
          operationType === OperationType.WITHDRAW ? lpToken.amount.negated() : lpToken.amount,
          lpToken.priceUsd,
        ),
      ]),
    ];
  }

  async fetchWrapperAddressFromLogs(txReceipt: ethers.providers.TransactionReceipt): Promise<string> {
    const logs = txReceipt.logs;
    const wrapperAddress = logs[logs.length - 1].address;
    return wrapperAddress;
  }

  private async fetchAndSetVaultsIntoMap(): Promise<void> {
    const vaults = await this.subgraph.queryIchiVaults();
    for (const vault of vaults) {
      this.vaults.set(vault.id, vault);
    }
  }

  async getTokenInfosFromDepositOrWithdraw(
    depositOrWithdraw: DepositOrWithdrawResult,
  ): Promise<{ token0: TokenInfo; token1: TokenInfo; lpToken: TokenInfo }> {
    const vault = this.vaults.get(depositOrWithdraw.vault);

    const [priceToken0, priceToken1, tokenADecimals, tokenBDecimals] = await Promise.all([
      this.context.getExchangePrice().getGenericPriceOfAt(vault.tokenA, depositOrWithdraw.blockNumber),
      this.context.getExchangePrice().getGenericPriceOfAt(vault.tokenB, depositOrWithdraw.blockNumber),
      this.contractReader.getDecimalPlaces(vault.tokenA),
      this.contractReader.getDecimalPlaces(vault.tokenB),
    ]);

    const priceLPToken = await this.fetchLPTokenPriceFromPool(
      vault,
      priceToken0.price,
      priceToken1.price,
      depositOrWithdraw.blockNumber,
    );

    const token0 = new TokenInfo(
      vault.tokenA,
      priceToken0.price,
      BigNumber(formatAsDecimalAwareString(depositOrWithdraw.amount0, tokenADecimals)),
      priceToken0.source,
    );
    const token1 = new TokenInfo(
      vault.tokenB,
      priceToken1.price,
      BigNumber(formatAsDecimalAwareString(depositOrWithdraw.amount1, tokenBDecimals)),
      priceToken1.source,
    );

    const formattedUserLpShares = BigNumber(ethers.utils.formatEther(depositOrWithdraw.shares.toString()));

    const lpToken = new TokenInfo(vault.id, priceLPToken, formattedUserLpShares, ICHI_LP_SOURCE);
    return {
      token0: token0,
      token1: token1,
      lpToken: lpToken,
    };
  }

  async fetchLPTokenPriceFromPool(
    vault: Vault,
    priceToken0: number,
    priceToken1: number,
    block: number,
  ): Promise<number> {
    // const ttl = block > 0 ? VisionCache.PERM_CACHE_DURATION : VisionCache.SHORT_CACHE_DURATION;
    // return await this.context.cacheOrPerform(`ICHI_LP_PRICE_${vault.id}_${block}`, ttl, async () => {
    try {
      const [totalSupply, [totalAmountToken0, totalAmountToken1], token0Decimal, token1Decimal] = await Promise.all([
        this.getTotalSupply(vault.id, block),
        this.getTotalAmounts(vault.id, block),
        this.contractReader.getDecimalPlaces(vault.tokenA),
        this.contractReader.getDecimalPlaces(vault.tokenB),
      ]);

      // calculate LP token price as (tokenA TVL + tokenB TVL) / LP token totalSupply() after formatted by decimals
      // Ichi LP token decimal is always 18, so we don't need to fetch it
      const totalTokenAAmountUSD = new BigNumber(totalAmountToken0.toString())
        .div(new BigNumber(10).exponentiatedBy(token0Decimal))
        .multipliedBy(priceToken0);
      const totalTokenBAmountUSD = new BigNumber(totalAmountToken1.toString())
        .div(new BigNumber(10).exponentiatedBy(token1Decimal))
        .multipliedBy(priceToken1);
      const tvlUsd = totalTokenAAmountUSD.plus(totalTokenBAmountUSD);
      const totalSupplyDecimalFormatted = BigNumber(ethers.utils.formatEther(totalSupply.toString()));
      const pricePerShare = tvlUsd.dividedBy(totalSupplyDecimalFormatted);
      return pricePerShare.toNumber();
    } catch (e) {
      const msg = `Could not fetch LP price from ICHI vault for block ${block}`;
      this.context.getLogger().error(`${msg}: ${e.message}`, STACKTRACE_KEY, e.trace);
      throw new Error(msg);
    }
    // });
  }

  async getTotalAmounts(lpTokenAddress, block) {
    try {
      return executeCallOrSend(rpcUrls, this.context.getNetwork(), async (provider: ethers.providers.Provider) => {
        const lpContract = new ethers.Contract(lpTokenAddress, vaultAbi, provider);
        return await lpContract.getTotalAmounts(getBlockTag(block));
      });
    } catch (e) {
      const msg = `Could not fetch total amounts for LP ${lpTokenAddress} at block ${block}`;
      this.context.getLogger().error(`${msg}: ${e.message}`, STACKTRACE_KEY, e.trace);
      throw new Error(msg);
    }
  }

  async getTotalSupply(lpTokenAddress, block) {
    try {
      return executeCallOrSend(rpcUrls, this.context.getNetwork(), async (provider: ethers.providers.Provider) => {
        const lpContract = new ethers.Contract(lpTokenAddress, vaultAbi, provider);
        return await lpContract.totalSupply(getBlockTag(block));
      });
    } catch (e) {
      const msg = `Could not fetch total supply for LP ${lpTokenAddress} at block ${block}`;
      this.context.getLogger().error(`${msg}: ${e.message}`, STACKTRACE_KEY, e.trace);
      throw new Error(msg);
    }
  }

  async fetchAmountsWithoutFeesFromIchi(lpTokenAddress: string, block: number): Promise<[BigNumber, BigNumber]> {
    const [tokenAmount0, tokenAmount1] = await this.getTotalAmounts(lpTokenAddress, block);
    return [new BigNumber(tokenAmount0.toString()), new BigNumber(tokenAmount1.toString())];
  }

  async fetchUserSharesData(vaultId: string, userAddress: string, block: number): Promise<[BigNumber, BigNumber]> {
    const fetchStrategy = this.fetchDataFromPool.bind(this, vaultId, userAddress, block);
    return this.fetchUserSharesDataCommon(vaultId, userAddress, block, fetchStrategy);
  }

  async fetchUserSharesDataCommon(
    vaultId: string,
    userAddress: string,
    block: number,
    fetchData: (provider: ethers.providers.Provider) => Promise<[BigNumber, BigNumber]>,
  ): Promise<[BigNumber, BigNumber]> {
    try {
      return await executeCallOrSend(rpcUrls, this.context.getNetwork(), fetchData);
    } catch (e) {
      const errorMsg = `Could not get shares for user ${userAddress}, vault ${vaultId} at block ${block}: ${e.message}`;
      this.context.getLogger().error(errorMsg, STACKTRACE_KEY, e.trace);
      throw new Error(errorMsg);
    }
  }

  async fetchDataFromWrapperContract(
    vaultId: string,
    userAddress: string,
    block: number,
    provider: ethers.providers.Provider,
  ): Promise<[BigNumber, BigNumber]> {
    const vault = this.vaults.get(vaultId);
    if (!vault.wrapper) return [BigNumber(0), BigNumber(0)];

    const vaultContract = new ethers.Contract(vaultId, vaultAbi, provider);
    const wrapperContract = new ethers.Contract(vault.wrapper, wrapperAbi, provider);
    const [userInfo, totalSupply] = await Promise.all([
      wrapperContract.userInfo(userAddress, getBlockTag(block)),
      vaultContract.totalSupply(getBlockTag(block)),
    ]);

    const shares = userInfo[0];

    const sharePercentage = BigNumber(shares.toString()).dividedBy(BigNumber(totalSupply.toString()));

    return [shares, sharePercentage];
  }

  async fetchDataFromPool(
    vaultId: string,
    userAddress: string,
    block: number,
    provider: ethers.providers.Provider,
  ): Promise<[BigNumber, BigNumber]> {
    const vaultContract = new ethers.Contract(vaultId, vaultAbi, provider);
    const [shares, totalSupply] = await Promise.all([
      vaultContract.balanceOf(userAddress, getBlockTag(block)),
      vaultContract.totalSupply(getBlockTag(block)),
    ]);

    const sharePercentage = BigNumber(shares.toString()).dividedBy(BigNumber(totalSupply.toString()));

    return [shares, sharePercentage];
  }

  async getPositionValue(
    positionIdentifier: string,
    userAddresses: string[],
    blockNumber: number = 0,
  ): Promise<PositionValue> {
    await this.initSubgraph();

    if (this.vaults.size === 0) {
      await this.fetchAndSetVaultsIntoMap();
    }

    const vault = this.vaults.get(positionIdentifier);

    const tokenAmounts: TokenInfo[] = [];
    let positionValueUsd = 0;
    let priceLPToken = 0;
    let lpAmount;

    const [token0price, token1price] = await Promise.all([
      this.context.getExchangePrice().getGenericPriceOfAt(vault.tokenA, blockNumber),
      this.context.getExchangePrice().getGenericPriceOfAt(vault.tokenB, blockNumber),
    ]);
    try {
      for (const userAddress of userAddresses) {
        const [[amountWithoutFees0, amountWithoutFees1], [share, sharePercentage], tokenAdecimals, tokenBdecimals] =
          await Promise.all([
            this.fetchAmountsWithoutFeesFromIchi(vault.id, blockNumber),
            this.fetchUserSharesData(vault.id, userAddress, blockNumber),
            this.contractReader.getDecimalPlaces(vault.tokenA),
            this.contractReader.getDecimalPlaces(vault.tokenB),
          ]);

        const amountWithoutFees0User = amountWithoutFees0.multipliedBy(sharePercentage);
        const amountWithoutFees1User = amountWithoutFees1.multipliedBy(sharePercentage);

        const token0Amount = amountWithoutFees0User.dividedBy(BigNumber(10).exponentiatedBy(tokenAdecimals));
        const token1Amount = amountWithoutFees1User.dividedBy(BigNumber(10).exponentiatedBy(tokenBdecimals));
        const token0Info = new TokenInfo(vault.tokenA, token0price.price, token0Amount, token0price.source);

        const token1Info = new TokenInfo(vault.tokenB, token1price.price, token1Amount, token1price.source);

        priceLPToken = await this.fetchLPTokenPriceFromPool(vault, token0price.price, token1price.price, blockNumber);

        lpAmount = BigNumber(ethers.utils.formatEther(share.toString()));

        const LPtokenInfo = new TokenInfo(vault.id, priceLPToken, lpAmount, ICHI_LP_SOURCE);
        tokenAmounts.push(token0Info, token1Info, LPtokenInfo);

        const positionValueUsdForAddress = token0Amount
          .multipliedBy(token0price.price)
          .plus(token1Amount.multipliedBy(token1price.price));
        positionValueUsd += positionValueUsdForAddress.toNumber();
      }
    } catch (e) {
      const msg = `Could not fetch information from ICHI vault for block ${blockNumber}`;
      this.context.getLogger().error(`${msg}: ${e.message}`, STACKTRACE_KEY, e.trace);
      throw new Error(msg);
    }

    const positionShare = new PositionShares(positionIdentifier, BigNumber(0), priceLPToken);

    return new PositionValue(positionValueUsd, [positionShare], [], tokenAmounts);
  }

  async getUserList(fromBlock: number): Promise<string[]> {
    await this.initSubgraph();
    const getUserListFn = this.subgraph.getUserList.bind(this.subgraph);
    return populateUserListFromSubgraph(getUserListFn, this.blueprintKey);
  }
}
