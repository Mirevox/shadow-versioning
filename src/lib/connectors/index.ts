import type { SourceKind } from "../types";
import { confluenceConnector } from "./confluence";
import { gitConnector } from "./git";
import { jiraConnector } from "./jira";
import { sharepointConnector } from "./sharepoint";
import { testingConnector } from "./testing";
import type { Connector } from "./types";

export type StageOwningConnectorSource = "confluence" | "sharepoint" | "git" | "testing";

/** Stage-owning connectors only (preserved for v0.1 contract compatibility). */
export const CONNECTORS: Record<StageOwningConnectorSource, Connector> = {
  confluence: confluenceConnector,
  sharepoint: sharepointConnector,
  git: gitConnector,
  testing: testingConnector,
};

/** Non-stage-owning supplementary connectors introduced in v0.2. */
export const EXTRA_CONNECTORS: Record<"jira", Connector> = {
  jira: jiraConnector,
};

export function getConnector(source: SourceKind): Connector | undefined {
  if (source === "stage-gate") return undefined;
  if (source === "jira") return EXTRA_CONNECTORS.jira;
  return CONNECTORS[source];
}

export { confluenceConnector, gitConnector, jiraConnector, sharepointConnector, testingConnector };
export type { Connector, ConnectorContext } from "./types";
export { STUB_LABEL } from "./types";
