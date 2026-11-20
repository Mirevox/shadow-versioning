import type { SourceKind } from "../types";
import { confluenceConnector } from "./confluence";
import { gitConnector } from "./git";
import { sharepointConnector } from "./sharepoint";
import { testingConnector } from "./testing";
import type { Connector } from "./types";

export const CONNECTORS: Record<Connector["source"], Connector> = {
  confluence: confluenceConnector,
  sharepoint: sharepointConnector,
  git: gitConnector,
  testing: testingConnector,
};

export function getConnector(source: SourceKind): Connector | undefined {
  return source === "stage-gate" ? undefined : CONNECTORS[source];
}

export { confluenceConnector, gitConnector, sharepointConnector, testingConnector };
export type { Connector, ConnectorContext } from "./types";
export { STUB_LABEL } from "./types";
