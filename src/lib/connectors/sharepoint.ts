import { readLocalMarkdownSnapshots } from "./confluence";
import { makeStubConnector } from "./factory";
import type { Connector } from "./types";

const stubSharepointConnector = makeStubConnector({
  source: "sharepoint",
  stage: "requirements",
  title: "Requirements document version bumped",
  detail: "The functional requirements workbook moved to a new minor version.",
  content:
    "SharePoint controlled requirements workbook update: functional requirements FR-01 through FR-12 specify schema validation, deterministic snapshot deduplication, and non-destructive ledger appends; non-functional requirements NFR-01 through NFR-05 specify atomic disk persistence, auditability, and graceful offline bridge behavior.",
  metadata: {
    library: "Requirements",
    documentVersion: "1.3",
  },
  ref: "sharepoint-doc-stub-v1.3",
  minutesAgo: 180,
});

export const sharepointConnector: Connector = {
  source: "sharepoint",
  stub: true,
  async fetchSnapshots(ctx) {
    if (ctx.binding.mode !== "local") {
      return stubSharepointConnector.fetchSnapshots(ctx);
    }
    return readLocalMarkdownSnapshots(ctx, "sharepoint", "requirements");
  },
};
