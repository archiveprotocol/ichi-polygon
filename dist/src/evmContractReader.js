"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvmContractReader = void 0;
const constants_1 = require("./constants");
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const blueprint_lib_1 = require("blueprint-lib");
const ethers_1 = require("ethers");
const web3_wrapper_library_1 = require("web3-wrapper-library");
class EvmContractReader {
    constructor(context) {
        this.context = context;
        this.networkId = context.getNetwork();
    }
    async fetchOrCachedTx(txHash) {
        try {
            const tx = await (0, web3_wrapper_library_1.executeCallOrSend)(constants_1.rpcUrls, this.networkId, (provider) => {
                return provider.getTransaction(txHash);
            });
            if (tx) {
                return tx;
            }
            return null;
        }
        catch (e) {
            this.context.getLogger().error(e.message);
            return null;
        }
    }
    async fetchOrCachedTxReceipt(txHash) {
        try {
            const receipt = await (0, web3_wrapper_library_1.executeCallOrSend)(constants_1.rpcUrls, this.networkId, (provider) => {
                return provider.getTransactionReceipt(txHash);
            });
            if (receipt) {
                return receipt;
            }
            return null;
        }
        catch (e) {
            this.context.getLogger().error(e.message);
            return null;
        }
    }
    async getDecimalPlaces(tokenAddrs) {
        try {
            const abi = [
                {
                    constant: true,
                    inputs: [],
                    name: 'decimals',
                    outputs: [{ name: '', type: 'uint8' }],
                    type: 'function',
                },
            ];
            const decimalsPlaces = await (0, web3_wrapper_library_1.executeCallOrSend)(constants_1.rpcUrls, this.networkId, (provider) => {
                const contract = new ethers_1.ethers.Contract(tokenAddrs, abi, provider);
                return contract.decimals();
            });
            return decimalsPlaces;
        }
        catch (e) {
            this.context.getLogger().error(`Could not fetch token decimals: ${e}`);
            return 0;
        }
    }
    async fetchOrCachedGasPrice() {
        try {
            const gasPrice = await (0, web3_wrapper_library_1.executeCallOrSend)(constants_1.rpcUrls, this.networkId, (provider) => {
                return provider.getGasPrice();
            });
            if (gasPrice) {
                return (0, bignumber_js_1.default)(gasPrice.toString());
            }
            return null;
        }
        catch (e) {
            this.context.getLogger().error(e.message);
            return null;
        }
    }
    async fetchGasUsedInTransaction(txHash, decimals = 18) {
        var _a;
        const transactionReceipt = await this.fetchOrCachedTxReceipt(txHash);
        if (!transactionReceipt) {
            return (0, bignumber_js_1.default)(0);
        }
        let gasPrice = (0, bignumber_js_1.default)(((_a = transactionReceipt.effectiveGasPrice) === null || _a === void 0 ? void 0 : _a.toString()) || 0);
        if (gasPrice.isNaN())
            gasPrice = await this.fetchOrCachedGasPrice();
        const gasUsedInNativeToken = (0, bignumber_js_1.default)(transactionReceipt.gasUsed.toString()).multipliedBy(gasPrice);
        return (0, bignumber_js_1.default)((0, blueprint_lib_1.formatAsDecimalAwareString)(gasUsedInNativeToken, decimals));
    }
}
exports.EvmContractReader = EvmContractReader;
//# sourceMappingURL=evmContractReader.js.map