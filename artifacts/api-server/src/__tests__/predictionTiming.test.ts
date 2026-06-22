import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  secondsRemainingFromResolveAt,
  isResolved,
  resolveStatus,
} from "../lib/predictionTiming.js";

describe("predictionTiming", () => {
  it("secondsRemainingFromResolveAt returns 0 when resolveAt is in the past", () => {
    const resolveAt = 1_700_000_000; // seconds
    const nowMs = (resolveAt * 1000) + 5_000; // 5s after
    assert.equal(secondsRemainingFromResolveAt(resolveAt, nowMs), 0);
  });

  it("secondsRemainingFromResolveAt rounds up when resolveAt is in the future", () => {
    const resolveAt = 1_700_000_000; // seconds
    const nowMs = (resolveAt * 1000) - 2_500; // 2.5s remaining
    // ceil(2.5) = 3
    assert.equal(secondsRemainingFromResolveAt(resolveAt, nowMs), 3);
  });

  it("isResolved returns true when nowSeconds >= resolveAtSeconds", () => {
    const resolveAt = 100;
    assert.equal(isResolved(100, resolveAt), true);
    assert.equal(isResolved(101, resolveAt), true);
  });

  it("resolveStatus returns pending with correct secondsRemaining before resolveAt", () => {
    const resolveAt = 200; // seconds
    const nowSeconds = 195;
    const nowMs = nowSeconds * 1000;

    const out = resolveStatus(nowSeconds, resolveAt, null);

    assert.equal(out.status, "pending");
    assert.equal(out.secondsRemaining, 5); // exactly 5s
  });

  it("resolveStatus returns correct when resolved and outcome is correct", () => {
    const out = resolveStatus(205, 200, "correct");
    assert.equal(out.status, "correct");
    assert.equal(out.secondsRemaining, 0);
  });

  it("resolveStatus returns incorrect when resolved and outcome is incorrect", () => {
    const out = resolveStatus(250, 200, "incorrect");
    assert.equal(out.status, "incorrect");
    assert.equal(out.secondsRemaining, 0);
  });
});
