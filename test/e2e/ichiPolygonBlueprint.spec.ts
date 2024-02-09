import { blueprintKey, chainId } from '../../src/constants';
import IchiPolygonBlueprint from '../../src/ichiPolygonBlueprint';
import { AbstractLoggingContext, Blueprint, BlueprintContext, UserTransactionResults } from 'blueprint-lib';

jest.setTimeout(15000);

describe('Ichi Polygon Blueprint e2e', () => {
  let blueprint: Blueprint;
  let context;
  const userAddress = '0x569a4d03a9b775a64e1e6b2928d699b345d8bdca';
  const fromBlock = 1;

  beforeAll(async () => {
    context = new BlueprintContext(blueprintKey, chainId, new AbstractLoggingContext());
    blueprint = new IchiPolygonBlueprint(context);
  });

  afterEach(() => jest.clearAllMocks());

  it('should return getUserTransaction', async () => {
    const txns = await blueprint.getUserTransactions(context, [userAddress], fromBlock);
    expect(txns).toBeInstanceOf(UserTransactionResults);
  });
});
