import { blueprintKey, chainId } from '../../src/constants';
import { IchiGraphExplorer } from '../../src/ichiGraphExplorer';
import IchiPolygonBlueprint from '../../src/ichiPolygonBlueprint';
import { Vault } from '../../src/models';
import { AbstractLoggingContext, Blueprint, BlueprintCategory, BlueprintContext } from 'blueprint-lib';

jest.setTimeout(15000);

describe('Ichi Polygon Blueprint', () => {
  let blueprint: Blueprint;
  const fromBlock = 16341180;

  beforeAll(async () => {
    const context = new BlueprintContext(blueprintKey, chainId, new AbstractLoggingContext());
    blueprint = new IchiPolygonBlueprint(context);

    jest.spyOn(IchiGraphExplorer.prototype, 'getUserList').mockImplementation(async () => []);
    jest.spyOn(IchiGraphExplorer.prototype, 'queryIchiVaults').mockImplementation(async () => [
      {
        id: '0x683f081dbc729dbd34abac708fa0b390d49f1c39',
        sender: '0xff7b5e167c9877f2b9f65d19d9c8c9aa651fe19f',
        tokenA: '0x111111517e4929d3dcbdfa7cce55d30d4b6bc4d6',
        tokenB: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      } as Vault,
    ]);
  });

  afterEach(() => jest.clearAllMocks());

  describe('Instance', () => {
    it('should be defined', () => {
      expect(blueprint).toBeDefined();
    });

    it('should return correct contract name', async () => {
      const name = blueprint.getContractName();
      expect(name).toEqual(expect.any(String));
    });

    it('should return a parent blueprint id', async () => {
      const parentBlueprintId = blueprint.getParentBlueprintId();
      expect(parentBlueprintId).toEqual('');
    });

    it('should return the blueprint key', async () => {
      const blueprintKey = blueprint.getBlueprintKey();
      expect(blueprintKey).toEqual(blueprintKey);
    });

    it('should be called with a context', async () => {
      const blueprintContext = blueprint.getContext();
      expect(blueprintContext).toBeInstanceOf(BlueprintContext);
    });

    it('should return the blueprint category', async () => {
      const blueprintCategory = blueprint.getBlueprintCategory();
      expect(blueprintCategory).toEqual(BlueprintCategory.LIQUIDITY_MANAGER);
    });

    it('should return a list of users', async () => {
      const userList = await blueprint.getUserList(fromBlock);
      expect(userList).toBeInstanceOf(Array);
    });
  });
});
