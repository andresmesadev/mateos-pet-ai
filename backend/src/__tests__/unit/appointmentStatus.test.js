const {
  isValidStatus,
  isAllowedTransition,
  autoTimestamps,
  TRANSITIONS,
} = require("../../services/appointment-status.service");

describe("isValidStatus", () => {
  test.each(["pending", "confirmed", "arrived", "in_progress", "completed", "no_show", "cancelled"])(
    "accepts '%s'",
    (s) => expect(isValidStatus(s)).toBe(true)
  );

  test("rejects unknown status", () => {
    expect(isValidStatus("done")).toBe(false);
    expect(isValidStatus("")).toBe(false);
    expect(isValidStatus(null)).toBe(false);
  });
});

describe("isAllowedTransition", () => {
  test("allows all documented forward transitions", () => {
    expect(isAllowedTransition("pending", "confirmed")).toBe(true);
    expect(isAllowedTransition("pending", "cancelled")).toBe(true);
    expect(isAllowedTransition("confirmed", "arrived")).toBe(true);
    expect(isAllowedTransition("confirmed", "cancelled")).toBe(true);
    expect(isAllowedTransition("arrived", "in_progress")).toBe(true);
    expect(isAllowedTransition("arrived", "no_show")).toBe(true);
    expect(isAllowedTransition("in_progress", "completed")).toBe(true);
  });

  test("rejects backward transitions", () => {
    expect(isAllowedTransition("confirmed", "pending")).toBe(false);
    expect(isAllowedTransition("arrived", "confirmed")).toBe(false);
    expect(isAllowedTransition("in_progress", "arrived")).toBe(false);
    expect(isAllowedTransition("completed", "in_progress")).toBe(false);
  });

  test("rejects transitions from terminal states", () => {
    expect(isAllowedTransition("completed", "confirmed")).toBe(false);
    expect(isAllowedTransition("no_show", "confirmed")).toBe(false);
    expect(isAllowedTransition("cancelled", "pending")).toBe(false);
  });

  test("rejects skipping states", () => {
    expect(isAllowedTransition("pending", "arrived")).toBe(false);
    expect(isAllowedTransition("pending", "completed")).toBe(false);
    expect(isAllowedTransition("confirmed", "in_progress")).toBe(false);
  });

  test("returns false for unknown source status", () => {
    expect(isAllowedTransition("ghost", "confirmed")).toBe(false);
  });
});

describe("autoTimestamps", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("sets startedAt when transitioning to in_progress", () => {
    const now = new Date("2026-06-17T14:00:00Z");
    jest.setSystemTime(now);
    const result = autoTimestamps("arrived", "in_progress");
    expect(result.startedAt).toEqual(now);
    expect(result.endedAt).toBeUndefined();
  });

  test("sets endedAt when transitioning to completed", () => {
    const now = new Date("2026-06-17T15:00:00Z");
    jest.setSystemTime(now);
    const result = autoTimestamps("in_progress", "completed");
    expect(result.endedAt).toEqual(now);
    expect(result.startedAt).toBeUndefined();
  });

  test("sets nothing for other transitions", () => {
    const result = autoTimestamps("pending", "confirmed");
    expect(result).toEqual({});
  });

  test("does not overwrite startedAt if already in_progress", () => {
    const result = autoTimestamps("in_progress", "in_progress");
    expect(result.startedAt).toBeUndefined();
  });
});
