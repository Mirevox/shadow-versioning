import { makeStubConnector } from "./factory";

export const gitConnector = makeStubConnector({
  source: "git",
  stage: "build",
  title: "Commit landed on main",
  detail: "A change to the sync module was merged to the default branch.",
  ref: "git-sha-stub-3f9c2ab",
  minutesAgo: 90,
});
