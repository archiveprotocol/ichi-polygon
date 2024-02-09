import IchiPolygonBlueprint from '../src/ichiPolygonBlueprint';
import { AbstractLoggingContext, BlueprintContext } from 'blueprint-lib';
import { blueprintKey, chainId } from './constants';

const context = new BlueprintContext(blueprintKey, chainId, new AbstractLoggingContext());
const myBlueprint = new IchiPolygonBlueprint(context);

(async function () {
  const userAddress = '0x569a4d03a9b775a64e1e6b2928d699b345d8bdca';
  const fromBlock = 1;
  try {
    const txns = await myBlueprint.getUserTransactions(context, [userAddress], fromBlock);
    console.log(txns);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
