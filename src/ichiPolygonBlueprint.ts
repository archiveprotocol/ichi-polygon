import { blueprintKey } from './constants';
import { IchiBlueprint } from './ichiBlueprint';

export default class IchiPolygonBlueprint extends IchiBlueprint {
  readonly protocolKey: string = blueprintKey;
  readonly protocolName = 'Ichi';
  readonly subgraphUrl: string = 'https://api.thegraph.com/subgraphs/name/ichi-org/polygon-v1';
  getTestWalletAddresses(): string[] {
    return [
      '0x569a4d03a9b775a64e1e6b2928d699b345d8bdca', // Partial exit
      '0x0e064ea0a357d9f8bc5b74a3c57bc88b4c48a53d', // Full exit
      '0x73ca04a777fd8d1681a253e8ab958b8fef1c0a24', // Re-entering after full exit
    ];
  }
}
