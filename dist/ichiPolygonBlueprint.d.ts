import { IchiBlueprint } from './ichiBlueprint';
export default class IchiPolygonBlueprint extends IchiBlueprint {
    readonly protocolKey: string;
    readonly protocolName = "Ichi";
    readonly subgraphUrl: string;
    getTestWalletAddresses(): string[];
}
