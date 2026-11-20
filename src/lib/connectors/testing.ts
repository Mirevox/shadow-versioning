import { makeStubConnector } from "./factory";

export const testingConnector = makeStubConnector({
  source: "testing",
  stage: "test",
  title: "Regression suite finished",
  detail: "The nightly regression run completed with all mock checks passing.",
  ref: "test-run-stub-881",
  minutesAgo: 30,
});
