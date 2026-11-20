import { makeStubConnector } from "./factory";

export const gitConnector = makeStubConnector({
  source: "git",
  stage: "build",
  title: "Build snapshot: default branch advanced",
  detail: "Implementation work was recorded on the service repository (stub; no network).",
  ref: "git-stub-ref-3f9c2ab",
  minutesAgo: 90,
});
