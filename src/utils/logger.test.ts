import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { checkAndCopyConfig, configureSync, getFileSink, getLogger, getSettings, mkdirSync, state } = vi.hoisted(() => {
  const state = {
    config: null,
    fileSinks: [],
    records: [],
  };

  const logtapeLogger = {
    emit: vi.fn<VitestMockProcedure>((record) => {
      state.records.push(record);
    }),
  };

  return {
    checkAndCopyConfig: vi.fn<VitestMockProcedure>(),
    configureSync: vi.fn<VitestMockProcedure>((config) => {
      state.config = config;
    }),
    getFileSink: vi.fn<VitestMockProcedure>((filename, options) => {
      const sink = vi.fn<VitestMockProcedure>();
      state.fileSinks.push({ filename, options, sink });
      return sink;
    }),
    getLogger: vi.fn<VitestMockProcedure>(() => logtapeLogger),
    getSettings: vi.fn<() => { logpath?: string }>(() => ({ logpath: "/tmp" })),
    mkdirSync: vi.fn<VitestMockProcedure>(),
    state,
  };
});

vi.mock("node:fs", () => ({
  mkdirSync,
}));

vi.mock("@logtape/logtape", () => ({
  configureSync,
  getLogger,
}));

vi.mock("@logtape/file", () => ({
  getFileSink,
}));

vi.mock("utils/config/config", () => ({
  default: checkAndCopyConfig,
  CONF_DIR: "/conf",
  getSettings,
}));

describe("utils/logger", () => {
  const originalEnv = process.env;
  const originalConsole = { ...console };
  let stdoutWrite;
  let stderrWrite;

  function resetState() {
    state.config = null;
    state.fileSinks = [];
    state.records = [];
    vi.clearAllMocks();
  }

  beforeEach(() => {
    resetState();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    stdoutWrite?.mockRestore();
    stderrWrite?.mockRestore();
    stdoutWrite = undefined;
    stderrWrite = undefined;
    Object.assign(console, originalConsole);
  });

  it("initializes LogTape on first createLogger() and caches per label", async () => {
    vi.resetModules();
    process.env.LOG_TARGETS = "stdout";

    const createLogger = (await import("./logger")).default;

    const a1 = createLogger("a");
    const a2 = createLogger("a");
    const b = createLogger("b");

    expect(checkAndCopyConfig).toHaveBeenCalledWith("settings.yaml");
    expect(configureSync).toHaveBeenCalled();
    expect(getLogger).toHaveBeenCalledWith([]);
    expect(state.config.loggers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: [], sinks: ["stream"] }),
        expect.objectContaining({
          category: ["logtape", "meta"],
          lowestLevel: "fatal",
          parentSinks: "override",
          sinks: [],
        }),
      ]),
    );
    expect(a1).toBe(a2);
    expect(b).not.toBe(a1);
  });

  it("selects stdout/file/both sinks based on LOG_TARGETS", async () => {
    vi.resetModules();
    process.env.LOG_TARGETS = "file";

    const createLogger = (await import("./logger")).default;
    createLogger("x");

    expect(Object.keys(state.config.sinks)).toEqual(["file"]);
    expect(mkdirSync).toHaveBeenCalledWith("/tmp/logs", { recursive: true });
    expect(getFileSink).toHaveBeenCalledWith(
      "/tmp/logs/daemun.log",
      expect.objectContaining({ bufferSize: 0, formatter: expect.any(Function) }),
    );

    resetState();
    vi.resetModules();
    process.env.LOG_TARGETS = "wat";

    const createLoggerWithUnknownTarget = (await import("./logger")).default;
    createLoggerWithUnknownTarget("x");

    expect(Object.keys(state.config.sinks).sort()).toEqual(["file", "stream"]);
  });

  it("uses CONF_DIR as the default logpath when settings.logpath is not set", async () => {
    vi.resetModules();
    process.env.LOG_TARGETS = "file";
    getSettings.mockReturnValueOnce({});

    const createLogger = (await import("./logger")).default;
    createLogger("x");

    expect(mkdirSync).toHaveBeenCalledWith("/conf/logs", { recursive: true });
    expect(getFileSink).toHaveBeenCalledWith(
      "/conf/logs/daemun.log",
      expect.objectContaining({ bufferSize: 0, formatter: expect.any(Function) }),
    );
  });

  it("patches console methods through the unlabeled base logger", async () => {
    vi.resetModules();
    process.env.LOG_TARGETS = "stdout";

    const createLogger = (await import("./logger")).default;
    createLogger("x");

    console.log("hello %s", "world");
    console.warn("careful");

    expect(state.records[0]).toMatchObject({
      level: "info",
      message: ["hello world"],
      properties: {},
    });
    expect(state.records[1]).toMatchObject({
      level: "warning",
      message: ["careful"],
      properties: {},
    });
  });

  it("preserves labeled util.format messages and error stack messages", async () => {
    vi.resetModules();
    process.env.LOG_TARGETS = "stdout";

    const createLogger = (await import("./logger")).default;
    const logger = createLogger("x");
    const error = new Error("boom");

    logger.info("Hello %s", "World");
    logger.error(error);

    expect(state.records[0]).toMatchObject({
      level: "info",
      message: ["Hello World"],
      properties: { label: "x" },
    });
    expect(state.records[1].level).toBe("error");
    expect(state.records[1].message[0]).toContain("Error: boom");
    expect(state.records[1].properties).toEqual({ label: "x" });
  });

  it("formats stream sink output and routes warnings/errors to stderr", async () => {
    vi.resetModules();
    process.env.LOG_TARGETS = "stdout";
    stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const createLogger = (await import("./logger")).default;
    createLogger("x");

    const sink = state.config.sinks.stream;
    sink({
      category: [],
      level: "info",
      message: ["hello"],
      properties: { label: "x" },
      rawMessage: "hello",
      timestamp: Date.UTC(2024, 0, 2, 3, 4, 5, 6),
    });
    sink({
      category: [],
      level: "warning",
      message: ["careful"],
      properties: {},
      rawMessage: "careful",
      timestamp: Date.UTC(2024, 0, 2, 3, 4, 5, 6),
    });

    expect(stdoutWrite).toHaveBeenCalledWith("[2024-01-02T03:04:05.006Z] \x1B[32minfo\x1B[39m: <x> hello\n");
    expect(stderrWrite).toHaveBeenCalledWith("[2024-01-02T03:04:05.006Z] \x1B[33mwarn\x1B[39m: careful\n");
  });

  it("uses the same plain text formatter for file output", async () => {
    vi.resetModules();
    process.env.LOG_TARGETS = "file";

    const createLogger = (await import("./logger")).default;
    createLogger("x");

    const line = state.fileSinks[0].options.formatter({
      category: [],
      level: "error",
      message: ["failed"],
      properties: { label: "svc" },
      rawMessage: "failed",
      timestamp: Date.UTC(2024, 0, 2, 3, 4, 5, 6),
    });

    expect(line).toBe("[2024-01-02T03:04:05.006Z] error: <svc> failed\n");
  });

  it("normalizes LOG_LEVEL=warn to LogTape's warning level filter", async () => {
    vi.resetModules();
    process.env.LOG_TARGETS = "stdout";
    process.env.LOG_LEVEL = "warn";

    const createLogger = (await import("./logger")).default;
    createLogger("x");

    expect(state.config.loggers[0].lowestLevel).toBe("warning");
  });
});
