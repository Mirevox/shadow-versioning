import { readLocalMarkdownSnapshots } from "./confluence";
import { makeStubConnector } from "./factory";
import type { Connector } from "./types";

const stubSharepointConnector = makeStubConnector({
  source: "sharepoint",
  stage: "requirements",
  title: "Requirements document version bumped",
  detail: "The functional requirements workbook moved to a new minor version.",
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
