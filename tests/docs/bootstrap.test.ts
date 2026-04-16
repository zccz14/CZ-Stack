import { describe, expect, it } from "vitest";

import { createSelectionRequestTracker } from "../../modules/docs/src/runtime/bootstrap.js";

describe("docs runtime bootstrap request tracking", () => {
  it("invalidates older requests when a newer selection starts", () => {
    const tracker = createSelectionRequestTracker();

    const firstRequest = tracker.begin();
    const secondRequest = tracker.begin();

    expect(tracker.isCurrent(firstRequest)).toBe(false);
    expect(tracker.isCurrent(secondRequest)).toBe(true);
  });
});
