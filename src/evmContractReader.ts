import { rpcUrls } from './constants';
import BigNumber from 'bignumber.js';
import { BlueprintContext, formatAsDecimalAwareString } from 'blueprint-lib';
import { ethers } from 'ethers';
import { executeCallOrSend } from 'web3-wrapper-library';

export class EvmContractReader {
  private readonly networkId: number;

  constructor(protected context: BlueprintContext) {
    this.networkId = context.getNetwork();
  }

  async fetchOrCachedTx(txHash): Promise<ethers.providers.TransactionResponse> {
    try {
      const tx = await executeCallOrSend(rpcUrls, this.networkId, (provider: ethers.providers.Provider) => {
        return provider.getTransaction(txHash);
      });

      if (tx) {
        return tx;
      }
      return null;
    } catch (e) {
      this.context.getLogger().error(e.message);
      return null;
    }
  }

  async fetchOrCachedTxReceipt(txHash: string): Promise<ethers.providers.TransactionReceipt> {
    try {
      const receipt = await executeCallOrSend(rpcUrls, this.networkId, (provider: ethers.providers.Provider) => {
        return provider.getTransactionReceipt(txHash);
      });

      if (receipt) {
        return receipt;
      }
      return null;
    } catch (e) {
      this.context.getLogger().error(e.message);
      return null;
    }
  }

  public async getDecimalPlaces(tokenAddrs: string): Promise<number> {
    try {
      const abi = [
        // decimals
        {
          constant: true,
          inputs: [],
          name: 'decimals',
          outputs: [{ name: '', type: 'uint8' }],
          type: 'function',
        },
      ];

      const decimalsPlaces = await executeCallOrSend(rpcUrls, this.networkId, (provider: ethers.providers.Provider) => {
        const contract = new ethers.Contract(tokenAddrs, abi, provider);
        return contract.decimals();
      });
      return decimalsPlaces;
    } catch (e) {
      this.context.getLogger().error(`Could not fetch token decimals: ${e}`);
      return 0;
    }
  }

  async fetchOrCachedGasPrice(): Promise<BigNumber> {
    try {
      const gasPrice = await executeCallOrSend(rpcUrls, this.networkId, (provider: ethers.providers.Provider) => {
        return provider.getGasPrice();
      });

      if (gasPrice) {
        return BigNumber(gasPrice.toString());
      }
      return null;
    } catch (e) {
      this.context.getLogger().error(e.message);
      return null;
    }
  }

  async fetchGasUsedInTransaction(txHash: string, decimals = 18): Promise<BigNumber> {
    const transactionReceipt = await this.fetchOrCachedTxReceipt(txHash);
    if (!transactionReceipt) {
      return BigNumber(0);
    }

    let gasPrice = BigNumber(transactionReceipt.effectiveGasPrice?.toString() || 0);
    if (gasPrice.isNaN()) gasPrice = await this.fetchOrCachedGasPrice();

    const gasUsedInNativeToken = BigNumber(transactionReceipt.gasUsed.toString()).multipliedBy(gasPrice);

    return BigNumber(formatAsDecimalAwareString(gasUsedInNativeToken, decimals));
  }
}
