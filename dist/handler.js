"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Handler = void 0;
const abi_1 = require("./abi");
const constants_1 = require("./constants");
const ichiGraphExplorer_1 = require("./ichiGraphExplorer");
const archive_axios_1 = require("archive-axios");
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const blueprint_lib_1 = require("blueprint-lib");
const ethers_1 = require("ethers");
const logging_library_1 = require("logging-library");
const web3_wrapper_library_1 = require("web3-wrapper-library");
const ICHI_LP_SOURCE = 'ichi-pool';
class Handler {
    constructor(context, subgraph_url, blueprintKey) {
        this.context = context;
        this.blueprintKey = blueprintKey;
        this._vaults = new Map();
        this.logger = this.context.getLogger();
        this._subgraphResults = new Map();
        this.axiosManager = new archive_axios_1.ApAxiosManager(blueprintKey, logging_library_1.KafkaManager.getInstance());
        this.contractReader = new blueprint_lib_1.EvmContractReader(this.context);
        this.subgraphUrl = subgraph_url;
        this.axiosManager.setup({
            headers: {
                'Accept-Encoding': '*',
            },
            timeout: 1000 * 60,
        });
    }
    get vaults() {
        return this._vaults;
    }
    get subgraphResults() {
        return this._subgraphResults;
    }
    async initSubgraph() {
        if (!this.subgraph)
            this.subgraph = new ichiGraphExplorer_1.IchiGraphExplorer(this.axiosManager, this.subgraphUrl);
    }
    async getUserTransactions(userAddresses, fromBlock) {
        await this.initSubgraph();
        const lastSyncedBlock = await this.subgraph.queryLastSyncedBlock();
        await Promise.all([
            this.fetchAndSetDepositsIntoMap(userAddresses, fromBlock),
            this.fetchAndSetWithdrawalsIntoMap(userAddresses, fromBlock),
            this.fetchAndSetVaultsIntoMap(),
        ]);
        const filteredTxns = Array.from(this._subgraphResults).filter(([, value]) => userAddresses.includes(value.sender) && value.blockNumber >= fromBlock);
        const transactionDetails = filteredTxns.map(([txnHash, value]) => new blueprint_lib_1.TransactionDetails(txnHash, Number(value.blockNumber), Number(value.createdAtTimestamp)));
        transactionDetails.sort((a, b) => a.blockNumber - b.blockNumber);
        return new blueprint_lib_1.UserTransactionResults(transactionDetails, lastSyncedBlock);
    }
    async fetchAndSetDepositsIntoMap(userAddresses, fromBlock) {
        await Promise.all(userAddresses.map(async (userAddress) => {
            const deposits = await this.subgraph.queryVaultDeposits(userAddress, fromBlock);
            for (const deposit of deposits) {
                const txHash = deposit.id.split('-')[0];
                deposit.operation = blueprint_lib_1.OperationType.DEPOSIT;
                deposit.sender = userAddress;
                const tx = await this.contractReader.fetchOrCachedTx(txHash);
                deposit['blockNumber'] = (tx === null || tx === void 0 ? void 0 : tx.blockNumber) || 0;
                this._subgraphResults.set(txHash, deposit);
            }
        }));
    }
    async fetchAndSetWithdrawalsIntoMap(userAddresses, fromBlock) {
        await Promise.all(userAddresses.map(async (userAddress) => {
            const withdraws = await this.subgraph.queryVaultWithdraws(userAddress, fromBlock);
            for (const withdraw of withdraws) {
                const txHash = withdraw.id.split('-')[0];
                withdraw.operation = blueprint_lib_1.OperationType.WITHDRAW;
                withdraw.sender = userAddress;
                const tx = await this.contractReader.fetchOrCachedTx(txHash);
                withdraw['blockNumber'] = (tx === null || tx === void 0 ? void 0 : tx.blockNumber) || 0;
                this._subgraphResults.set(txHash, withdraw);
            }
        }));
    }
    async classifyTx(txn) {
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
        const [gasTokenAmount, { token0, token1, lpToken }] = await Promise.all([
            this.contractReader.fetchGasUsedInTransaction(txnHash),
            this.getTokenInfosFromDepositOrWithdraw(subgraphResult),
        ]);
        switch (operationType) {
            case blueprint_lib_1.OperationType.DEPOSIT:
                inputTokens.push(token0);
                inputTokens.push(token1);
                outputTokens.push(lpToken);
                break;
            case blueprint_lib_1.OperationType.WITHDRAW:
                if (!token0.amount.eq(0))
                    outputTokens.push(token0);
                if (!token1.amount.eq(0))
                    outputTokens.push(token1);
                inputTokens.push(lpToken);
                break;
            default:
                break;
        }
        const operations = [new blueprint_lib_1.Operation(operationType, inputTokens, outputTokens)];
        return [
            new blueprint_lib_1.Classification(operations, positionIdentifier, (0, bignumber_js_1.default)(gasTokenAmount), [
                new blueprint_lib_1.PositionShares(positionIdentifier, operationType === blueprint_lib_1.OperationType.WITHDRAW ? lpToken.amount.negated() : lpToken.amount, lpToken.priceUsd),
            ]),
        ];
    }
    async fetchWrapperAddressFromLogs(txReceipt) {
        const logs = txReceipt.logs;
        const wrapperAddress = logs[logs.length - 1].address;
        return wrapperAddress;
    }
    async fetchAndSetVaultsIntoMap() {
        const vaults = await this.subgraph.queryIchiVaults();
        for (const vault of vaults) {
            this.vaults.set(vault.id, vault);
        }
    }
    async getTokenInfosFromDepositOrWithdraw(depositOrWithdraw) {
        const vault = this.vaults.get(depositOrWithdraw.vault);
        const [priceToken0, priceToken1, tokenADecimals, tokenBDecimals] = await Promise.all([
            this.context.getExchangePrice().getGenericPriceOfAt(vault.tokenA, depositOrWithdraw.blockNumber),
            this.context.getExchangePrice().getGenericPriceOfAt(vault.tokenB, depositOrWithdraw.blockNumber),
            this.contractReader.getDecimalPlaces(vault.tokenA),
            this.contractReader.getDecimalPlaces(vault.tokenB),
        ]);
        const priceLPToken = await this.fetchLPTokenPriceFromPool(vault, priceToken0.price, priceToken1.price, depositOrWithdraw.blockNumber);
        const token0 = new blueprint_lib_1.TokenInfo(vault.tokenA, priceToken0.price, (0, bignumber_js_1.default)((0, blueprint_lib_1.formatAsDecimalAwareString)(depositOrWithdraw.amount0, tokenADecimals)), priceToken0.source);
        const token1 = new blueprint_lib_1.TokenInfo(vault.tokenB, priceToken1.price, (0, bignumber_js_1.default)((0, blueprint_lib_1.formatAsDecimalAwareString)(depositOrWithdraw.amount1, tokenBDecimals)), priceToken1.source);
        const formattedUserLpShares = (0, bignumber_js_1.default)(ethers_1.ethers.utils.formatEther(depositOrWithdraw.shares.toString()));
        const lpToken = new blueprint_lib_1.TokenInfo(vault.id, priceLPToken, formattedUserLpShares, ICHI_LP_SOURCE);
        return {
            token0: token0,
            token1: token1,
            lpToken: lpToken,
        };
    }
    async fetchLPTokenPriceFromPool(vault, priceToken0, priceToken1, block) {
        try {
            const [totalSupply, [totalAmountToken0, totalAmountToken1], token0Decimal, token1Decimal] = await Promise.all([
                this.getTotalSupply(vault.id, block),
                this.getTotalAmounts(vault.id, block),
                this.contractReader.getDecimalPlaces(vault.tokenA),
                this.contractReader.getDecimalPlaces(vault.tokenB),
            ]);
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
            this.context.getLogger().error(`${msg}: ${e.message}`, blueprint_lib_1.STACKTRACE_KEY, e.trace);
            throw new Error(msg);
        }
    }
    async getTotalAmounts(lpTokenAddress, block) {
        try {
            return (0, web3_wrapper_library_1.executeCallOrSend)(constants_1.rpcUrls, this.context.getNetwork(), async (provider) => {
                const lpContract = new ethers_1.ethers.Contract(lpTokenAddress, abi_1.vaultAbi, provider);
                return await lpContract.getTotalAmounts((0, blueprint_lib_1.getBlockTag)(block));
            });
        }
        catch (e) {
            const msg = `Could not fetch total amounts for LP ${lpTokenAddress} at block ${block}`;
            this.context.getLogger().error(`${msg}: ${e.message}`, blueprint_lib_1.STACKTRACE_KEY, e.trace);
            throw new Error(msg);
        }
    }
    async getTotalSupply(lpTokenAddress, block) {
        try {
            return (0, web3_wrapper_library_1.executeCallOrSend)(constants_1.rpcUrls, this.context.getNetwork(), async (provider) => {
                const lpContract = new ethers_1.ethers.Contract(lpTokenAddress, abi_1.vaultAbi, provider);
                return await lpContract.totalSupply((0, blueprint_lib_1.getBlockTag)(block));
            });
        }
        catch (e) {
            const msg = `Could not fetch total supply for LP ${lpTokenAddress} at block ${block}`;
            this.context.getLogger().error(`${msg}: ${e.message}`, blueprint_lib_1.STACKTRACE_KEY, e.trace);
            throw new Error(msg);
        }
    }
    async fetchAmountsWithoutFeesFromIchi(lpTokenAddress, block) {
        const [tokenAmount0, tokenAmount1] = await this.getTotalAmounts(lpTokenAddress, block);
        return [new bignumber_js_1.default(tokenAmount0.toString()), new bignumber_js_1.default(tokenAmount1.toString())];
    }
    async fetchUserSharesData(vaultId, userAddress, block) {
        const fetchStrategy = this.fetchDataFromPool.bind(this, vaultId, userAddress, block);
        return this.fetchUserSharesDataCommon(vaultId, userAddress, block, fetchStrategy);
    }
    async fetchUserSharesDataCommon(vaultId, userAddress, block, fetchData) {
        try {
            return await (0, web3_wrapper_library_1.executeCallOrSend)(constants_1.rpcUrls, this.context.getNetwork(), fetchData);
        }
        catch (e) {
            const errorMsg = `Could not get shares for user ${userAddress}, vault ${vaultId} at block ${block}: ${e.message}`;
            this.context.getLogger().error(errorMsg, blueprint_lib_1.STACKTRACE_KEY, e.trace);
            throw new Error(errorMsg);
        }
    }
    async fetchDataFromWrapperContract(vaultId, userAddress, block, provider) {
        const vault = this.vaults.get(vaultId);
        if (!vault.wrapper)
            return [(0, bignumber_js_1.default)(0), (0, bignumber_js_1.default)(0)];
        const vaultContract = new ethers_1.ethers.Contract(vaultId, abi_1.vaultAbi, provider);
        const wrapperContract = new ethers_1.ethers.Contract(vault.wrapper, abi_1.wrapperAbi, provider);
        const [userInfo, totalSupply] = await Promise.all([
            wrapperContract.userInfo(userAddress, (0, blueprint_lib_1.getBlockTag)(block)),
            vaultContract.totalSupply((0, blueprint_lib_1.getBlockTag)(block)),
        ]);
        const shares = userInfo[0];
        const sharePercentage = (0, bignumber_js_1.default)(shares.toString()).dividedBy((0, bignumber_js_1.default)(totalSupply.toString()));
        return [shares, sharePercentage];
    }
    async fetchDataFromPool(vaultId, userAddress, block, provider) {
        const vaultContract = new ethers_1.ethers.Contract(vaultId, abi_1.vaultAbi, provider);
        const [shares, totalSupply] = await Promise.all([
            vaultContract.balanceOf(userAddress, (0, blueprint_lib_1.getBlockTag)(block)),
            vaultContract.totalSupply((0, blueprint_lib_1.getBlockTag)(block)),
        ]);
        const sharePercentage = (0, bignumber_js_1.default)(shares.toString()).dividedBy((0, bignumber_js_1.default)(totalSupply.toString()));
        return [shares, sharePercentage];
    }
    async getPositionValue(positionIdentifier, userAddresses, blockNumber = 0) {
        await this.initSubgraph();
        if (this.vaults.size === 0) {
            await this.fetchAndSetVaultsIntoMap();
        }
        const vault = this.vaults.get(positionIdentifier);
        const tokenAmounts = [];
        let positionValueUsd = 0;
        let priceLPToken = 0;
        let lpAmount;
        const [token0price, token1price] = await Promise.all([
            this.context.getExchangePrice().getGenericPriceOfAt(vault.tokenA, blockNumber),
            this.context.getExchangePrice().getGenericPriceOfAt(vault.tokenB, blockNumber),
        ]);
        try {
            for (const userAddress of userAddresses) {
                const [[amountWithoutFees0, amountWithoutFees1], [share, sharePercentage], tokenAdecimals, tokenBdecimals] = await Promise.all([
                    this.fetchAmountsWithoutFeesFromIchi(vault.id, blockNumber),
                    this.fetchUserSharesData(vault.id, userAddress, blockNumber),
                    this.contractReader.getDecimalPlaces(vault.tokenA),
                    this.contractReader.getDecimalPlaces(vault.tokenB),
                ]);
                const amountWithoutFees0User = amountWithoutFees0.multipliedBy(sharePercentage);
                const amountWithoutFees1User = amountWithoutFees1.multipliedBy(sharePercentage);
                const token0Amount = amountWithoutFees0User.dividedBy((0, bignumber_js_1.default)(10).exponentiatedBy(tokenAdecimals));
                const token1Amount = amountWithoutFees1User.dividedBy((0, bignumber_js_1.default)(10).exponentiatedBy(tokenBdecimals));
                const token0Info = new blueprint_lib_1.TokenInfo(vault.tokenA, token0price.price, token0Amount, token0price.source);
                const token1Info = new blueprint_lib_1.TokenInfo(vault.tokenB, token1price.price, token1Amount, token1price.source);
                priceLPToken = await this.fetchLPTokenPriceFromPool(vault, token0price.price, token1price.price, blockNumber);
                lpAmount = (0, bignumber_js_1.default)(ethers_1.ethers.utils.formatEther(share.toString()));
                const LPtokenInfo = new blueprint_lib_1.TokenInfo(vault.id, priceLPToken, lpAmount, ICHI_LP_SOURCE);
                tokenAmounts.push(token0Info, token1Info, LPtokenInfo);
                const positionValueUsdForAddress = token0Amount
                    .multipliedBy(token0price.price)
                    .plus(token1Amount.multipliedBy(token1price.price));
                positionValueUsd += positionValueUsdForAddress.toNumber();
            }
        }
        catch (e) {
            const msg = `Could not fetch information from ICHI vault for block ${blockNumber}`;
            this.context.getLogger().error(`${msg}: ${e.message}`, blueprint_lib_1.STACKTRACE_KEY, e.trace);
            throw new Error(msg);
        }
        const positionShare = new blueprint_lib_1.PositionShares(positionIdentifier, (0, bignumber_js_1.default)(0), priceLPToken);
        return new blueprint_lib_1.PositionValue(positionValueUsd, [positionShare], [], tokenAmounts);
    }
    async getUserList(fromBlock) {
        await this.initSubgraph();
        const getUserListFn = this.subgraph.getUserList.bind(this.subgraph);
        return (0, blueprint_lib_1.populateUserListFromSubgraph)(getUserListFn, this.blueprintKey);
    }
}
exports.Handler = Handler;
//# sourceMappingURL=handler.js.map