import { makeStubConnector } from "./factory";

export const confluenceConnector = makeStubConnector({
  source: "confluence",
  stage: "pre-requirements",
  title: "Discovery page revised",
  detail: "Problem statement and stakeholder notes were edited in the discovery space.",
  ref: "confluence-page-stub-1042",
  minutesAgo: 240,
});
