import { makeStubConnector } from "./factory";

export const sharepointConnector = makeStubConnector({
  source: "sharepoint",
  stage: "requirements",
  title: "Requirements document version bumped",
  detail: "The functional requirements workbook moved to a new minor version.",
  ref: "sharepoint-doc-stub-v1.3",
  minutesAgo: 180,
});
