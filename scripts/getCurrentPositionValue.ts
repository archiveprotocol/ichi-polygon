import IchiPolygonBlueprint from '../src/ichiPolygonBlueprint';
import { blueprintKey, chainId } from './constants';
import { AbstractLoggingContext, BlueprintContext, PositionContext, UserProtocolPositionSnapshot } from 'blueprint-lib';
import { config } from 'dotenv';

config();

const context = new BlueprintContext(blueprintKey, chainId, new AbstractLoggingContext());
const myBlueprint = new IchiPolygonBlueprint(context);
const mockPositionContext = new PositionContext(
  context,
  [mockSnapshot()],
  ['0x569a4d03a9b775a64e1e6b2928d699b345d8bdca'],
  '0x9ff3c1390300918b40714fd464a39699ddd9fe00',
);

function mockSnapshot(isNewSession = false): UserProtocolPositionSnapshot {
  const snapshot = {} as any;
  snapshot.isNewSession = isNewSession;
  return snapshot;
}

(async function () {
  try {
    const positionValue = await myBlueprint.getCurrentPositionValue(mockPositionContext);
    console.log(JSON.stringify(positionValue, null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
