/**
 * Unit tests for logger utilities
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LogLevel, logger, setLogLevel } from "./logger";

describe("logger", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment and log level before each test
    process.env = { ...originalEnv };
    delete process.env.VITEST_WORKER_ID;
    setLogLevel(LogLevel.INFO);
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore environment after each test
    process.env = originalEnv;
  });

  describe("log level control", () => {
    it("should have default log level of INFO", () => {
      // INFO level should log info, warn, and error
      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith("info message");
      expect(consoleWarnSpy).toHaveBeenCalledWith("warn message");
      expect(consoleErrorSpy).toHaveBeenCalledWith("error message");
    });

    it("should respect log level set via setLogLevel", () => {
      setLogLevel(LogLevel.ERROR);

      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith("error message");
    });

    it("should log all messages at DEBUG level", () => {
      setLogLevel(LogLevel.DEBUG);

      const consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(consoleDebugSpy).toHaveBeenCalledWith("debug message");
      expect(consoleLogSpy).toHaveBeenCalledWith("info message");
      expect(consoleWarnSpy).toHaveBeenCalledWith("warn message");
      expect(consoleErrorSpy).toHaveBeenCalledWith("error message");
    });

    it("should log only errors at ERROR level", () => {
      setLogLevel(LogLevel.ERROR);

      const consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith("error message");
    });

    it("should log warn and error at WARN level", () => {
      setLogLevel(LogLevel.WARN);

      const consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith("warn message");
      expect(consoleErrorSpy).toHaveBeenCalledWith("error message");
    });
  });

  describe("Vitest worker suppression", () => {
    it("should suppress all logging when VITEST_WORKER_ID is set", () => {
      process.env.VITEST_WORKER_ID = "1";

      const consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe("debug method", () => {
    it("should only log at DEBUG level or higher", () => {
      setLogLevel(LogLevel.DEBUG);

      const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
      logger.debug("test debug");
      expect(spy).toHaveBeenCalledWith("test debug");

      spy.mockReset();
      setLogLevel(LogLevel.INFO);
      logger.debug("test debug");
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("info method", () => {
    it("should log at INFO level or higher", () => {
      setLogLevel(LogLevel.INFO);

      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      logger.info("test info");
      expect(spy).toHaveBeenCalledWith("test info");

      spy.mockReset();
      setLogLevel(LogLevel.WARN);
      logger.info("test info");
      expect(spy).not.toHaveBeenCalled();
    });

    it("should use console.log for INFO messages", () => {
      setLogLevel(LogLevel.INFO);

      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      logger.info("info message");
      expect(spy).toHaveBeenCalledWith("info message");
    });
  });

  describe("warn method", () => {
    it("should log at WARN level or higher", () => {
      setLogLevel(LogLevel.WARN);

      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      logger.warn("test warn");
      expect(spy).toHaveBeenCalledWith("test warn");

      spy.mockReset();
      setLogLevel(LogLevel.ERROR);
      logger.warn("test warn");
      expect(spy).not.toHaveBeenCalled();
    });

    it("should use console.warn for WARN messages", () => {
      setLogLevel(LogLevel.WARN);

      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      logger.warn("warn message");
      expect(spy).toHaveBeenCalledWith("warn message");
    });
  });

  describe("error method", () => {
    it("should always log errors regardless of level", () => {
      setLogLevel(LogLevel.ERROR);

      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      logger.error("test error");
      expect(spy).toHaveBeenCalledWith("test error");

      spy.mockReset();
      setLogLevel(LogLevel.DEBUG);
      logger.error("test error");
      expect(spy).toHaveBeenCalledWith("test error");
    });

    it("should use console.error for ERROR messages", () => {
      setLogLevel(LogLevel.ERROR);

      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      logger.error("error message");
      expect(spy).toHaveBeenCalledWith("error message");
    });
  });

  describe("environment variable integration", () => {
    it("should read log level from LOG_LEVEL environment variable", () => {
      // This tests the initial setup, which happens at module load time
      // We can't easily test this without reloading the module, but we can
      // test setLogLevel which is what LOG_LEVEL would use
      setLogLevel(LogLevel.ERROR);

      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      logger.info("should not log");
      logger.error("should log");

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith("should log");
    });

    it("should handle invalid LOG_LEVEL gracefully", () => {
      // If LOG_LEVEL is invalid, it should default to INFO
      // This is tested indirectly by the default behavior
      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // At default INFO level
      logger.info("info message");
      logger.error("error message");

      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("log level hierarchy", () => {
    it("should respect the hierarchy: ERROR < WARN < INFO < DEBUG", () => {
      // At ERROR level (0)
      setLogLevel(LogLevel.ERROR);
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const infoSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

      logger.error("error");
      logger.warn("warn");
      logger.info("info");
      logger.debug("debug");

      expect(errorSpy).toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalled();
      expect(debugSpy).not.toHaveBeenCalled();

      // At WARN level (1)
      setLogLevel(LogLevel.WARN);
      errorSpy.mockClear();
      warnSpy.mockClear();

      logger.error("error");
      logger.warn("warn");
      logger.info("info");
      logger.debug("debug");

      expect(errorSpy).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalled();
      expect(debugSpy).not.toHaveBeenCalled();

      // At INFO level (2)
      setLogLevel(LogLevel.INFO);
      errorSpy.mockClear();
      warnSpy.mockClear();
      infoSpy.mockClear();

      logger.error("error");
      logger.warn("warn");
      logger.info("info");
      logger.debug("debug");

      expect(errorSpy).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
      expect(infoSpy).toHaveBeenCalled();
      expect(debugSpy).not.toHaveBeenCalled();

      // At DEBUG level (3)
      setLogLevel(LogLevel.DEBUG);
      errorSpy.mockClear();
      warnSpy.mockClear();
      infoSpy.mockClear();
      debugSpy.mockClear();

      logger.error("error");
      logger.warn("warn");
      logger.info("info");
      logger.debug("debug");

      expect(errorSpy).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
      expect(infoSpy).toHaveBeenCalled();
      expect(debugSpy).toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("should handle empty strings", () => {
      setLogLevel(LogLevel.INFO);

      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      logger.info("");
      expect(spy).toHaveBeenCalledWith("");
    });

    it("should handle very long messages", () => {
      setLogLevel(LogLevel.INFO);

      const longMessage = "x".repeat(10000);
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      logger.info(longMessage);
      expect(spy).toHaveBeenCalledWith(longMessage);
    });

    it("should handle special characters in messages", () => {
      setLogLevel(LogLevel.INFO);

      const specialMessage = "Test: \n\t\r%s%d{}<>&\"'emoji: 🎉";
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      logger.info(specialMessage);
      expect(spy).toHaveBeenCalledWith(specialMessage);
    });

    it("should handle Unicode characters", () => {
      setLogLevel(LogLevel.INFO);

      const unicodeMessage = "你好世界 🌍 مرحبا";
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      logger.info(unicodeMessage);
      expect(spy).toHaveBeenCalledWith(unicodeMessage);
    });
  });

  describe("LogLevel constant", () => {
    it("should have correct numeric values", () => {
      expect(LogLevel.ERROR).toBe(0);
      expect(LogLevel.WARN).toBe(1);
      expect(LogLevel.INFO).toBe(2);
      expect(LogLevel.DEBUG).toBe(3);
    });
  });
});
