import { describe, expect, it } from "vitest";

import { pendingMilestone, reachedMilestone } from "./useStreakMilestone";

describe("streak milestones", () => {
  it("owes nothing below the first milestone", () => {
    expect(pendingMilestone(2, 0)).toBeNull();
    expect(reachedMilestone(2)).toBe(0);
  });

  it("owes the milestone the streak just reached", () => {
    expect(pendingMilestone(3, 0)).toBe(3);
    expect(pendingMilestone(7, 3)).toBe(7);
  });

  it("owes the highest one passed, not every one in between", () => {
    expect(pendingMilestone(30, 0)).toBe(30);
  });

  it("fires once per milestone", () => {
    expect(pendingMilestone(7, 7)).toBeNull();
    expect(pendingMilestone(9, 7)).toBeNull();
  });

  it("earns milestones again after a broken streak", () => {
    expect(pendingMilestone(0, 30)).toBeNull();
    expect(pendingMilestone(3, 30)).toBe(3);
  });
});
