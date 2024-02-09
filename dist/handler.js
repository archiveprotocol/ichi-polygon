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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Handler = void 0;
const positionShares_1 = require("../../blueprint/dto/positionShares");
const positionValue_1 = require("../../blueprint/dto/positionValue");
const tokenInfo_1 = require("../../blueprint/dto/tokenInfo");
const transactionDetails_1 = require("../../blueprint/dto/transactionDetails");
const userTransactionResults_1 = require("../../blueprint/dto/userTransactionResults");
const utils_1 = require("../../common/lib/utils");
const constants_1 = require("../../constants");
const utils_2 = require("../common/utils");
const abi_1 = require("./abi");
const ichiGraphExplorer_1 = require("./ichiGraphExplorer");
const blueprintRegistry_1 = require("@src/blueprint/blueprintRegistry");
const classification_1 = require("@src/blueprint/dto/classification");
const operation_1 = require("@src/blueprint/dto/operation");
const visionCache_1 = require("@src/common/visionCache");
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const ethers_1 = require("ethers");
const web3_wrapper_library_1 = require("web3-wrapper-library");
const ICHI_LP_SOURCE = 'ichi-pool';
class Handler {
    constructor(context, subgraph_url, blueprintKey) {
        this.context = context;
        this.blueprintKey = blueprintKey;
        this._vaults = new Map();
        this.logger = this.context.getLogger();
        this._subgraphResults = new Map();
        this.contractReader = this.context.getContractReader();
        this.subgraphUrl = subgraph_url;
    }
    get vaults() {
        return this._vaults;
    }
    get subgraphResults() {
        return this._subgraphResults;
    }
    initSubgraph() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.subgraph)
                this.subgraph = new ichiGraphExplorer_1.IchiGraphExplorer(yield this.context.getAxiosManager(), this.subgraphUrl);
        });
    }
    getUserTransactions(userAddresses, fromBlock) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.initSubgraph();
            const lastSyncedBlock = yield this.subgraph.queryLastSyncedBlock();
            yield Promise.all([
                this.fetchAndSetDepositsIntoMap(userAddresses, fromBlock),
                this.fetchAndSetWithdrawalsIntoMap(userAddresses, fromBlock),
                this.fetchAndSetVaultsIntoMap(),
            ]);
            const filteredTxns = Array.from(this._subgraphResults).filter(([, value]) => userAddresses.includes(value.sender) && value.blockNumber >= fromBlock);
            const transactionDetails = filteredTxns.map(([txnHash, value]) => new transactionDetails_1.TransactionDetails(txnHash, Number(value.blockNumber), Number(value.createdAtTimestamp)));
            transactionDetails.sort((a, b) => a.blockNumber - b.blockNumber);
            return new userTransactionResults_1.UserTransactionResults(transactionDetails, lastSyncedBlock);
        });
    }
    fetchAndSetDepositsIntoMap(userAddresses, fromBlock) {
        return __awaiter(this, void 0, void 0, function* () {
            yield Promise.all(userAddresses.map((userAddress) => __awaiter(this, void 0, void 0, function* () {
                const deposits = yield this.subgraph.queryVaultDeposits(userAddress, fromBlock);
                for (const deposit of deposits) {
                    const txHash = deposit.id.split('-')[0];
                    deposit.operation = constants_1.OperationType.DEPOSIT;
                    deposit.sender = userAddress;
                    const tx = yield this.context.getContractReader().fetchOrCachedTx(txHash);
                    deposit['blockNumber'] = tx.blockNumber;
                    this._subgraphResults.set(txHash, deposit);
                }
            })));
        });
    }
    fetchAndSetWithdrawalsIntoMap(userAddresses, fromBlock) {
        return __awaiter(this, void 0, void 0, function* () {
            yield Promise.all(userAddresses.map((userAddress) => __awaiter(this, void 0, void 0, function* () {
                const withdraws = yield this.subgraph.queryVaultWithdraws(userAddress, fromBlock);
                for (const withdraw of withdraws) {
                    const txHash = withdraw.id.split('-')[0];
                    withdraw.operation = constants_1.OperationType.WITHDRAW;
                    withdraw.sender = userAddress;
                    const tx = yield this.context.getContractReader().fetchOrCachedTx(txHash);
                    withdraw['blockNumber'] = tx.blockNumber;
                    this._subgraphResults.set(txHash, withdraw);
                }
            })));
        });
    }
    classifyTx(txn) {
        return __awaiter(this, void 0, void 0, function* () {
            const txnHash = txn.txHash;
            const inputTokens = [];
            const outputTokens = [];
            if (!this.subgraphResults.has(txnHash)) {
                this.logger.log(`TxHash ${txnHash} not found in subgraph results`);
                return [];
            }
            const subgraphResult = this.subgraphResults.get(txnHash);
            const operationType = subgraphResult.operation;
            const positionIdentifier = subgraphResult.vault;
            const [gasTokenAmount, { token0, token1, lpToken }] = yield Promise.all([
                this.contractReader.fetchGasUsedInTransaction(txnHash),
                this.getTokenInfosFromDepositOrWithdraw(subgraphResult),
            ]);
            switch (operationType) {
                case constants_1.OperationType.DEPOSIT:
                    // for bril we need to use the wrapper address to get the shares of the user
                    // so we need to fetch the wrapper address from the logs and set it into the vault map
                    yield this.maybeSetWrapperAddressIntoVault(txnHash, positionIdentifier);
                    // Deposited token is partially swapped to the paired token in the vault automatically.
                    // So, put both token0 and token1 into inputTokens, even if that amount is 0 to show them as an underlying token.
                    inputTokens.push(token0);
                    inputTokens.push(token1);
                    outputTokens.push(lpToken);
                    break;
                case constants_1.OperationType.WITHDRAW:
                    if (!token0.amount.eq(0))
                        outputTokens.push(token0);
                    if (!token1.amount.eq(0))
                        outputTokens.push(token1);
                    inputTokens.push(lpToken);
                    break;
                default:
                    break;
            }
            const operations = [new operation_1.Operation(operationType, inputTokens, outputTokens)];
            return [
                new classification_1.Classification(operations, positionIdentifier, (0, bignumber_js_1.default)(gasTokenAmount), [
                    new positionShares_1.PositionShares(positionIdentifier, operationType === constants_1.OperationType.WITHDRAW ? lpToken.amount.negated() : lpToken.amount, lpToken.priceUsd),
                ]),
            ];
        });
    }
    maybeSetWrapperAddressIntoVault(txnHash, positionIdentifier) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isBrilPancakeswapBsc()) {
                const vault = this.vaults.get(positionIdentifier);
                if (!vault.wrapper) {
                    const txReceipt = yield this.context.getContractReader().fetchOrCachedTxReceipt(txnHash);
                    const wrapperAddress = yield this.fetchWrapperAddressFromLogs(txReceipt);
                    vault.wrapper = wrapperAddress;
                }
            }
        });
    }
    fetchWrapperAddressFromLogs(txReceipt) {
        return __awaiter(this, void 0, void 0, function* () {
            const logs = txReceipt.logs;
            const wrapperAddress = logs[logs.length - 1].address;
            return wrapperAddress;
        });
    }
    fetchAndSetVaultsIntoMap() {
        return __awaiter(this, void 0, void 0, function* () {
            const vaults = yield this.subgraph.queryIchiVaults();
            for (const vault of vaults) {
                this.vaults.set(vault.id, vault);
            }
        });
    }
    getTokenInfosFromDepositOrWithdraw(depositOrWithdraw) {
        return __awaiter(this, void 0, void 0, function* () {
            const vault = this.vaults.get(depositOrWithdraw.vault);
            const [priceToken0, priceToken1, tokenADecimals, tokenBDecimals] = yield Promise.all([
                this.context.getExchangePrice().getGenericPriceOfAt(vault.tokenA, depositOrWithdraw.blockNumber),
                this.context.getExchangePrice().getGenericPriceOfAt(vault.tokenB, depositOrWithdraw.blockNumber),
                this.context.getContractReader().getDecimalPlaces(vault.tokenA),
                this.context.getContractReader().getDecimalPlaces(vault.tokenB),
            ]);
            const priceLPToken = yield this.fetchLPTokenPriceFromPool(vault, priceToken0.price, priceToken1.price, depositOrWithdraw.blockNumber);
            const token0 = new tokenInfo_1.TokenInfo(vault.tokenA, priceToken0.price, (0, bignumber_js_1.default)((0, utils_1.formatAsDecimalAwareString)(depositOrWithdraw.amount0, tokenADecimals)), priceToken0.source);
            const token1 = new tokenInfo_1.TokenInfo(vault.tokenB, priceToken1.price, (0, bignumber_js_1.default)((0, utils_1.formatAsDecimalAwareString)(depositOrWithdraw.amount1, tokenBDecimals)), priceToken1.source);
            const formattedUserLpShares = (0, bignumber_js_1.default)(ethers_1.ethers.utils.formatEther(depositOrWithdraw.shares.toString()));
            const lpToken = new tokenInfo_1.TokenInfo(vault.id, priceLPToken, formattedUserLpShares, ICHI_LP_SOURCE);
            return {
                token0: token0,
                token1: token1,
                lpToken: lpToken,
            };
        });
    }
    fetchLPTokenPriceFromPool(vault, priceToken0, priceToken1, block) {
        return __awaiter(this, void 0, void 0, function* () {
            const ttl = block > 0 ? visionCache_1.VisionCache.PERM_CACHE_DURATION : visionCache_1.VisionCache.SHORT_CACHE_DURATION;
            return yield this.context.cacheOrPerform(`ICHI_LP_PRICE_${vault.id}_${block}`, ttl, () => __awaiter(this, void 0, void 0, function* () {
                try {
                    const [totalSupply, [totalAmountToken0, totalAmountToken1], token0Decimal, token1Decimal] = yield Promise.all([
                        this.getTotalSupply(vault.id, block),
                        this.getTotalAmounts(vault.id, block),
                        this.context.getContractReader().getDecimalPlaces(vault.tokenA),
                        this.context.getContractReader().getDecimalPlaces(vault.tokenB),
                    ]);
                    // calculate LP token price as (tokenA TVL + tokenB TVL) / LP token totalSupply() after formatted by decimals
                    // Ichi LP token decimal is always 18, so we don't need to fetch it
                    const totalTokenAAmountUSD = new bignumber_js_1.default(totalAmountToken0.toString())
                        .div(new bignumber_js_1.default(10).exponentiatedBy(token0Decimal))
                        .multipliedBy(priceToken0);
                    const totalTokenBAmountUSD = new bignumber_js_1.default(totalAmountToken1.toString())
                        .div(new bignumber_js_1.default(10).exponentiatedBy(token1Decimal))
                        .multipliedBy(priceToken1);
                    const tvlUsd = totalTokenAAmountUSD.plus(totalTokenBAmountUSD);
                    const totalSupplyDecimalFormatted = (0, bignumber_js_1.default)(ethers_1.ethers.utils.formatEther(totalSupply.toString()));
                    const pricePerShare = tvlUsd.dividedBy(totalSupplyDecimalFormatted);
                    return pricePerShare.toNumber();
                }
                catch (e) {
                    const msg = `Could not fetch LP price from ICHI vault for block ${block}`;
                    this.context.getLogger().error(`${msg}: ${e.message}`, constants_1.STACKTRACE_KEY, e.trace);
                    throw new Error(msg);
                }
            }));
        });
    }
    getTotalAmounts(lpTokenAddress, block) {
        return __awaiter(this, void 0, void 0, function* () {
            const ttl = block > 0 ? visionCache_1.VisionCache.PERM_CACHE_DURATION : visionCache_1.VisionCache.SHORT_CACHE_DURATION;
            return yield this.context.cacheOrPerform(`ICHI_TOTAL_AMOUNTS_${lpTokenAddress}_${block}`, ttl, () => __awaiter(this, void 0, void 0, function* () {
                try {
                    return (0, web3_wrapper_library_1.executeCallOrSend)(this.context.getNetwork(), (provider) => __awaiter(this, void 0, void 0, function* () {
                        const lpContract = new ethers_1.ethers.Contract(lpTokenAddress, abi_1.vaultAbi, provider);
                        return yield lpContract.getTotalAmounts((0, utils_2.getBlockTag)(block));
                    }));
                }
                catch (e) {
                    const msg = `Could not fetch total amounts for LP ${lpTokenAddress} at block ${block}`;
                    this.context.getLogger().error(`${msg}: ${e.message}`, constants_1.STACKTRACE_KEY, e.trace);
                    throw new Error(msg);
                }
            }));
        });
    }
    getTotalSupply(lpTokenAddress, block) {
        return __awaiter(this, void 0, void 0, function* () {
            const ttl = block > 0 ? visionCache_1.VisionCache.PERM_CACHE_DURATION : visionCache_1.VisionCache.SHORT_CACHE_DURATION;
            return yield this.context.cacheOrPerform(`ICHI_TOTAL_SUPPLY_${lpTokenAddress}_${block}`, ttl, () => __awaiter(this, void 0, void 0, function* () {
                try {
                    return (0, web3_wrapper_library_1.executeCallOrSend)(this.context.getNetwork(), (provider) => __awaiter(this, void 0, void 0, function* () {
                        const lpContract = new ethers_1.ethers.Contract(lpTokenAddress, abi_1.vaultAbi, provider);
                        return yield lpContract.totalSupply((0, utils_2.getBlockTag)(block));
                    }));
                }
                catch (e) {
                    const msg = `Could not fetch total supply for LP ${lpTokenAddress} at block ${block}`;
                    this.context.getLogger().error(`${msg}: ${e.message}`, constants_1.STACKTRACE_KEY, e.trace);
                    throw new Error(msg);
                }
            }));
        });
    }
    fetchAmountsWithoutFeesFromIchi(lpTokenAddress, block) {
        return __awaiter(this, void 0, void 0, function* () {
            const [tokenAmount0, tokenAmount1] = yield this.getTotalAmounts(lpTokenAddress, block);
            return [new bignumber_js_1.default(tokenAmount0.toString()), new bignumber_js_1.default(tokenAmount1.toString())];
        });
    }
    isBrilPancakeswapBsc() {
        return this.blueprintKey === blueprintRegistry_1.BlueprintKey.BRIL_PANCAKESWAP_BSC;
    }
    fetchUserSharesData(vaultId, userAddress, block) {
        return __awaiter(this, void 0, void 0, function* () {
            const fetchStrategy = this.isBrilPancakeswapBsc()
                ? this.fetchDataFromWrapperContract.bind(this, vaultId, userAddress, block)
                : this.fetchDataFromPool.bind(this, vaultId, userAddress, block);
            return this.fetchUserSharesDataCommon(vaultId, userAddress, block, fetchStrategy);
        });
    }
    fetchUserSharesDataCommon(vaultId, userAddress, block, fetchData) {
        return __awaiter(this, void 0, void 0, function* () {
            const ttl = block > 0 ? visionCache_1.VisionCache.PERM_CACHE_DURATION : visionCache_1.VisionCache.SHORT_CACHE_DURATION;
            return yield this.context.cacheOrPerform(`ICHI_USER_SHARES_${vaultId}_${userAddress}_${block}`, ttl, () => __awaiter(this, void 0, void 0, function* () {
                try {
                    return yield (0, web3_wrapper_library_1.executeCallOrSend)(this.context.getNetwork(), fetchData);
                }
                catch (e) {
                    const errorMsg = `Could not get shares for user ${userAddress}, vault ${vaultId} at block ${block}: ${e.message}`;
                    this.context.getLogger().error(errorMsg, constants_1.STACKTRACE_KEY, e.trace);
                    throw new Error(errorMsg);
                }
            }));
        });
    }
    fetchDataFromWrapperContract(vaultId, userAddress, block, provider) {
        return __awaiter(this, void 0, void 0, function* () {
            const vault = this.vaults.get(vaultId);
            if (!vault.wrapper)
                return [(0, bignumber_js_1.default)(0), (0, bignumber_js_1.default)(0)];
            const vaultContract = new ethers_1.ethers.Contract(vaultId, abi_1.vaultAbi, provider);
            const wrapperContract = new ethers_1.ethers.Contract(vault.wrapper, abi_1.wrapperAbi, provider);
            const [userInfo, totalSupply] = yield Promise.all([
                wrapperContract.userInfo(userAddress, (0, utils_2.getBlockTag)(block)),
                vaultContract.totalSupply((0, utils_2.getBlockTag)(block)),
            ]);
            const shares = userInfo[0];
            const sharePercentage = (0, bignumber_js_1.default)(shares.toString()).dividedBy((0, bignumber_js_1.default)(totalSupply.toString()));
            return [shares, sharePercentage];
        });
    }
    fetchDataFromPool(vaultId, userAddress, block, provider) {
        return __awaiter(this, void 0, void 0, function* () {
            const vaultContract = new ethers_1.ethers.Contract(vaultId, abi_1.vaultAbi, provider);
            const [shares, totalSupply] = yield Promise.all([
                vaultContract.balanceOf(userAddress, (0, utils_2.getBlockTag)(block)),
                vaultContract.totalSupply((0, utils_2.getBlockTag)(block)),
            ]);
            const sharePercentage = (0, bignumber_js_1.default)(shares.toString()).dividedBy((0, bignumber_js_1.default)(totalSupply.toString()));
            return [shares, sharePercentage];
        });
    }
    getPositionValue(positionIdentifier, userAddresses, blockNumber = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.initSubgraph();
            if (this.vaults.size === 0) {
                yield this.fetchAndSetVaultsIntoMap();
            }
            const vault = this.vaults.get(positionIdentifier);
            const tokenAmounts = [];
            let positionValueUsd = 0;
            let priceLPToken = 0;
            let lpAmount;
            const [token0price, token1price] = yield Promise.all([
                this.context.getExchangePrice().getGenericPriceOfAt(vault.tokenA, blockNumber),
                this.context.getExchangePrice().getGenericPriceOfAt(vault.tokenB, blockNumber),
            ]);
            try {
                for (const userAddress of userAddresses) {
                    const [[amountWithoutFees0, amountWithoutFees1], [share, sharePercentage], tokenAdecimals, tokenBdecimals] = yield Promise.all([
                        this.fetchAmountsWithoutFeesFromIchi(vault.id, blockNumber),
                        this.fetchUserSharesData(vault.id, userAddress, blockNumber),
                        this.context.getContractReader().getDecimalPlaces(vault.tokenA),
                        this.context.getContractReader().getDecimalPlaces(vault.tokenB),
                    ]);
                    const amountWithoutFees0User = amountWithoutFees0.multipliedBy(sharePercentage);
                    const amountWithoutFees1User = amountWithoutFees1.multipliedBy(sharePercentage);
                    const token0Amount = amountWithoutFees0User.dividedBy((0, bignumber_js_1.default)(10).exponentiatedBy(tokenAdecimals));
                    const token1Amount = amountWithoutFees1User.dividedBy((0, bignumber_js_1.default)(10).exponentiatedBy(tokenBdecimals));
                    const token0Info = new tokenInfo_1.TokenInfo(vault.tokenA, token0price.price, token0Amount, token0price.source);
                    const token1Info = new tokenInfo_1.TokenInfo(vault.tokenB, token1price.price, token1Amount, token1price.source);
                    priceLPToken = yield this.fetchLPTokenPriceFromPool(vault, token0price.price, token1price.price, blockNumber);
                    lpAmount = (0, bignumber_js_1.default)(ethers_1.ethers.utils.formatEther(share.toString()));
                    const LPtokenInfo = new tokenInfo_1.TokenInfo(vault.id, priceLPToken, lpAmount, ICHI_LP_SOURCE);
                    tokenAmounts.push(token0Info, token1Info, LPtokenInfo);
                    const positionValueUsdForAddress = token0Amount
                        .multipliedBy(token0price.price)
                        .plus(token1Amount.multipliedBy(token1price.price));
                    positionValueUsd += positionValueUsdForAddress.toNumber();
                }
            }
            catch (e) {
                const msg = `Could not fetch information from ICHI vault for block ${blockNumber}`;
                this.context.getLogger().error(`${msg}: ${e.message}`, constants_1.STACKTRACE_KEY, e.trace);
                throw new Error(msg);
            }
            const positionShare = new positionShares_1.PositionShares(positionIdentifier, (0, bignumber_js_1.default)(0), priceLPToken);
            return new positionValue_1.PositionValue(positionValueUsd, [positionShare], [], tokenAmounts);
        });
    }
    getUserList(fromBlock) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.initSubgraph();
            const getUserListFn = this.subgraph.getUserList.bind(this.subgraph);
            return (0, utils_2.populateUserListFromSubgraph)(getUserListFn, this.blueprintKey);
        });
    }
}
exports.Handler = Handler;
