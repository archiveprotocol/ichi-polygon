import { blueprintKey, chainId } from '../src/constants';
import IchiPolygonBlueprint from '../src/ichiPolygonBlueprint';
import { AbstractLoggingContext, BlueprintContext } from 'blueprint-lib';
import { config } from 'dotenv';

config();

const context = new BlueprintContext(blueprintKey, chainId, new AbstractLoggingContext());
const myBlueprint = new IchiPolygonBlueprint(context);

(async function () {
  const userAddress = '0x569a4d03a9b775a64e1e6b2928d699b345d8bdca';
  const fromBlock = 1;
  try {
    const txns = await myBlueprint.getUserTransactions(context, [userAddress], fromBlock);

    // This is supposed to be called on platform side
    myBlueprint.getContext().initialize([userAddress]);

    // sample call to getWalletAddresses()
    console.log('user wallet addresses: ', myBlueprint.getContext().getWalletAddresses());

    // Please modify the second parameter to TransactionDetail data you want to check
    const classifications = await myBlueprint.classifyTransaction(context, txns.userTransactions[0]);
    console.log(JSON.stringify(classifications, null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
