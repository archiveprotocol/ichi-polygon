import IchiPolygonBlueprint from '../src/ichiPolygonBlueprint';
import { AbstractLoggingContext, BlueprintContext } from 'blueprint-lib';
import { blueprintKey, chainId } from './constants';

const context = new BlueprintContext(blueprintKey, chainId, new AbstractLoggingContext());
const myBlueprint = new IchiPolygonBlueprint(context);


(async function () {
  const fromBlock = 1;
  try {
    const users = await myBlueprint.getUserList(fromBlock);
    console.log(users);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
