/**
 * Tests for performance budget utilities
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertBudget,
  checkPerformanceBudgets,
  DEFAULT_BUDGETS,
  DEVELOPMENT_BUDGETS,
  measureApiCall,
  measurePagePerformance,
  PerformanceBudgetChecker,
  type PerformanceMeasurement,
  STRICT_BUDGETS,
} from "./performanceBudgets";

describe("performance budgets", () => {
  describe("DEFAULT_BUDGETS", () => {
    it("has sensible default values", () => {
      expect(DEFAULT_BUDGETS.maxJsSize).toBe(250 * 1024); // 250KB
      expect(DEFAULT_BUDGETS.maxCssSize).toBe(50 * 1024); // 50KB
      expect(DEFAULT_BUDGETS.maxTotalSize).toBe(1000 * 1024); // 1MB
      expect(DEFAULT_BUDGETS.maxApiTime).toBe(1000); // 1s
      expect(DEFAULT_BUDGETS.maxFCP).toBe(1800); // 1.8s
    });
  });

  describe("STRICT_BUDGETS", () => {
    it("has stricter values than defaults", () => {
      expect(STRICT_BUDGETS.maxJsSize).toBeLessThan(DEFAULT_BUDGETS.maxJsSize);
      expect(STRICT_BUDGETS.maxApiTime).toBeLessThan(DEFAULT_BUDGETS.maxApiTime);
    });
  });

  describe("DEVELOPMENT_BUDGETS", () => {
    it("has more lenient values than defaults", () => {
      expect(DEVELOPMENT_BUDGETS.maxJsSize).toBeGreaterThan(DEFAULT_BUDGETS.maxJsSize);
      expect(DEVELOPMENT_BUDGETS.maxApiTime).toBeGreaterThan(DEFAULT_BUDGETS.maxApiTime);
    });
  });

  describe("PerformanceBudgetChecker", () => {
    let checker: PerformanceBudgetChecker;

    beforeEach(() => {
      checker = new PerformanceBudgetChecker(DEFAULT_BUDGETS);
    });

    describe("check", () => {
      it("returns empty array when all budgets are within limits", () => {
        const measurement: PerformanceMeasurement = {
          jsSize: 100 * 1024,
          cssSize: 20 * 1024,
          apiTime: 500,
        };

        const breaches = checker.check(measurement);
        expect(breaches).toHaveLength(0);
      });

      it("detects JS size breach", () => {
        const measurement: PerformanceMeasurement = {
          jsSize: 300 * 1024, // Over 250KB limit
        };

        const breaches = checker.check(measurement);
        expect(breaches).toHaveLength(1);
        expect(breaches[0].budget).toBe("maxJsSize");
      });

      it("detects API time breach", () => {
        const measurement: PerformanceMeasurement = {
          apiTime: 1500, // Over 1000ms limit
        };

        const breaches = checker.check(measurement);
        expect(breaches).toHaveLength(1);
        expect(breaches[0].budget).toBe("maxApiTime");
      });

      it("detects multiple breaches", () => {
        const measurement: PerformanceMeasurement = {
          jsSize: 300 * 1024,
          cssSize: 100 * 1024,
          apiTime: 2000,
        };

        const breaches = checker.check(measurement);
        expect(breaches.length).toBeGreaterThanOrEqual(2);
      });

      it("assigns correct severity for breaches", () => {
        const measurement: PerformanceMeasurement = {
          jsSize: 260 * 1024, // Just over - warning
        };

        const breaches = checker.check(measurement);
        expect(breaches[0].severity).toBe("warning");

        checker.clearBreaches();

        const measurement2: PerformanceMeasurement = {
          jsSize: 400 * 1024, // ~1.6x - error
        };

        const breaches2 = checker.check(measurement2);
        expect(breaches2[0].severity).toBe("error");

        checker.clearBreaches();

        const measurement3: PerformanceMeasurement = {
          jsSize: 600 * 1024, // ~2.4x - critical
        };

        const breaches3 = checker.check(measurement3);
        expect(breaches3[0].severity).toBe("critical");
      });
    });

    describe("onBreach", () => {
      it("calls callback on breach", () => {
        const callback = vi.fn();
        checker.onBreach(callback);

        const measurement: PerformanceMeasurement = {
          jsSize: 300 * 1024,
        };

        checker.check(measurement);

        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            budget: "maxJsSize",
          }),
        );
      });
    });

    describe("getReport", () => {
      it("returns success message when no breaches", () => {
        expect(checker.getReport()).toContain("✅");
        expect(checker.getReport()).toContain("within limits");
      });

      it("returns breach details", () => {
        checker.check({ jsSize: 300 * 1024 });

        const report = checker.getReport();
        expect(report).toContain("⚠️");
        expect(report).toContain("maxJsSize");
      });
    });

    describe("clearBreaches", () => {
      it("clears all recorded breaches", () => {
        checker.check({ jsSize: 300 * 1024 });
        expect(checker.getBreaches()).toHaveLength(1);

        checker.clearBreaches();
        expect(checker.getBreaches()).toHaveLength(0);
      });
    });

    describe("setBudgets", () => {
      it("changes the budgets used for checking", () => {
        checker.setBudgets(STRICT_BUDGETS);

        const measurement: PerformanceMeasurement = {
          jsSize: 200 * 1024, // Under default, over strict
        };

        const breaches = checker.check(measurement);
        expect(breaches).toHaveLength(1);
      });
    });
  });

  describe("measureApiCall", () => {
    it("measures async function execution time", async () => {
      const asyncFn = () =>
        new Promise<string>((resolve) => {
          setTimeout(() => resolve("result"), 100);
        });

      const [result, duration] = await measureApiCall(asyncFn);

      expect(result).toBe("result");
      expect(duration).toBeGreaterThanOrEqual(90);
      expect(duration).toBeLessThan(200); // Should be close to 100ms
    });

    it("propagates errors from the function", async () => {
      const errorFn = () =>
        new Promise((_resolve, reject) => {
          reject(new Error("Test error"));
        });

      await expect(measureApiCall(errorFn)).rejects.toThrow("Test error");
    });
  });

  describe("assertBudget", () => {
    it("does not throw when budgets are within limits", () => {
      const measurement: PerformanceMeasurement = {
        jsSize: 100 * 1024,
      };

      expect(() => assertBudget(measurement)).not.toThrow();
    });

    it("throws when budgets are breached", () => {
      const measurement: PerformanceMeasurement = {
        jsSize: 300 * 1024,
      };

      expect(() => assertBudget(measurement)).toThrow();
    });

    it("includes breach details in error message", () => {
      const measurement: PerformanceMeasurement = {
        jsSize: 300 * 1024,
      };

      try {
        assertBudget(measurement);
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toContain("maxJsSize");
      }
    });
  });

  describe("checkPerformanceBudgets", () => {
    it("returns breaches for current page performance", () => {
      const breaches = checkPerformanceBudgets();

      // We can't make specific assertions about page performance
      // but we can verify the return type
      expect(Array.isArray(breaches)).toBe(true);
    });

    it("uses custom budgets when provided", () => {
      const breaches = checkPerformanceBudgets(STRICT_BUDGETS);

      expect(Array.isArray(breaches)).toBe(true);
    });
  });

  describe("measurePagePerformance", () => {
    it("returns measurement object", () => {
      const measurement = measurePagePerformance();

      // Should have at least some measurements
      expect(typeof measurement).toBe("object");
    });

    it("measures memory if available", () => {
      const measurement = measurePagePerformance();

      if ("memory" in performance) {
        // Memory API is available
        expect(typeof measurement.memoryMB).toBe("number");
      }
    });
  });
});

describe("PerformanceBudgetChecker severity calculation", () => {
  it("correctly calculates warning severity", () => {
    const checker = new PerformanceBudgetChecker({
      maxJsSize: 100,
      maxCssSize: 0,
      maxTotalSize: 0,
      maxApiTime: 0,
      maxMemoryMB: 0,
      maxFCP: 0,
      maxLCP: 0,
      maxCLS: 0,
      maxFID: 0,
      maxTTI: 0,
    });

    // Just over limit (< 1.5x)
    const breaches = checker.check({ jsSize: 120 });
    expect(breaches[0].severity).toBe("warning");
  });

  it("correctly calculates error severity", () => {
    const checker = new PerformanceBudgetChecker({
      maxJsSize: 100,
      maxCssSize: 0,
      maxTotalSize: 0,
      maxApiTime: 0,
      maxMemoryMB: 0,
      maxFCP: 0,
      maxLCP: 0,
      maxCLS: 0,
      maxFID: 0,
      maxTTI: 0,
    });

    // ~1.6x over limit
    const breaches = checker.check({ jsSize: 160 });
    expect(breaches[0].severity).toBe("error");
  });

  it("correctly calculates critical severity", () => {
    const checker = new PerformanceBudgetChecker({
      maxJsSize: 100,
      maxCssSize: 0,
      maxTotalSize: 0,
      maxApiTime: 0,
      maxMemoryMB: 0,
      maxFCP: 0,
      maxLCP: 0,
      maxCLS: 0,
      maxFID: 0,
      maxTTI: 0,
    });

    // > 2x over limit
    const breaches = checker.check({ jsSize: 250 });
    expect(breaches[0].severity).toBe("critical");
  });
});
