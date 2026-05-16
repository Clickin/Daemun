import { mkdirSync } from "node:fs";
import { format as utilFormat } from "node:util";

import { getFileSink } from "@logtape/file";
import { configureSync, getLogger, type LogLevel, type LogRecord, type Logger, type Sink } from "@logtape/logtape";

import checkAndCopyConfig, { CONF_DIR, getSettings } from "utils/config/config";

type DaemunLogger = {
  debug: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
};

const loggers: Record<string, DaemunLogger> = {};
let baseLogger: DaemunLogger | undefined;
let logtapeLogger: Logger | undefined;
let processErrorHandlersInstalled = false;

function normalizeLogLevel(level = "info"): LogLevel {
  switch (level.toLowerCase()) {
    case "trace":
      return "trace";
    case "debug":
      return "debug";
    case "info":
      return "info";
    case "warn":
    case "warning":
      return "warning";
    case "error":
      return "error";
    case "fatal":
      return "fatal";
    default:
      return "info";
  }
}

function formatLevel(level: LogLevel) {
  return level === "warning" ? "warn" : level;
}

function colorizeLevel(level: string) {
  switch (level) {
    case "error":
    case "fatal":
      return `\x1B[31m${level}\x1B[39m`;
    case "warn":
      return `\x1B[33m${level}\x1B[39m`;
    case "info":
      return `\x1B[32m${level}\x1B[39m`;
    case "debug":
      return `\x1B[34m${level}\x1B[39m`;
    case "trace":
      return `\x1B[36m${level}\x1B[39m`;
    default:
      return level;
  }
}

function formatLogMessage(args: unknown[]) {
  if (args.length === 0) {
    return "";
  }

  if (args.length === 1 && args[0] instanceof Error) {
    return args[0].stack || args[0].message;
  }

  return utilFormat(...args);
}

function formatRecordMessage(record: LogRecord) {
  if (record.message.length === 1) {
    return record.message[0];
  }

  return record.message.map((part) => (typeof part === "string" ? part : utilFormat(part))).join("");
}

function logLabel(record: LogRecord) {
  const { label } = record.properties;
  return typeof label === "string" && label.length > 0 ? label : null;
}

function messageFormatter(record: LogRecord, { colorize = false } = {}) {
  const timestamp = new Date(record.timestamp).toISOString();
  const level = formatLevel(record.level);
  const formattedLevel = colorize ? colorizeLevel(level) : level;
  const message = formatRecordMessage(record);
  const label = logLabel(record);

  if (label) {
    return `[${timestamp}] ${formattedLevel}: <${label}> ${message}\n`;
  }

  return `[${timestamp}] ${formattedLevel}: ${message}\n`;
}

function getStreamSink(): Sink {
  return (record) => {
    const stream =
      record.level === "error" || record.level === "fatal" || record.level === "warning"
        ? process.stderr
        : process.stdout;
    stream.write(messageFormatter(record, { colorize: true }));
  };
}

function getFileLogger() {
  const settings = getSettings();
  const logpath = settings.logpath || CONF_DIR;
  const logDir = `${logpath}/logs`;

  mkdirSync(logDir, { recursive: true });

  return getFileSink(`${logDir}/daemun.log`, {
    bufferSize: 0,
    formatter: messageFormatter,
  });
}

function configuredSinks() {
  const configuredTargets = process.env.LOG_TARGETS || "both";

  switch (configuredTargets) {
    case "both":
      return { file: getFileLogger(), stream: getStreamSink() };
    case "stdout":
      return { stream: getStreamSink() };
    case "file":
      return { file: getFileLogger() };
    default:
      return { file: getFileLogger(), stream: getStreamSink() };
  }
}

function formatProcessError(kind: "uncaughtException" | "unhandledRejection", reason: unknown) {
  const message =
    reason && typeof reason === "object" && "message" in reason && typeof reason.message === "string"
      ? reason.message
      : String(reason || "(no error message)");
  const stack = reason instanceof Error && reason.stack ? reason.stack : "  No stack trace";

  return `${kind}: ${message}\n${stack}`;
}

function installProcessErrorHandlers() {
  if (processErrorHandlersInstalled) {
    return;
  }

  processErrorHandlersInstalled = true;
  process.on("uncaughtException", (error) => {
    emit("error", undefined, [formatProcessError("uncaughtException", error)]);
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    emit("error", undefined, [formatProcessError("unhandledRejection", reason)]);
    process.exit(1);
  });
}

function init() {
  checkAndCopyConfig("settings.yaml");

  const sinks = configuredSinks();
  const sinkIds = Object.keys(sinks) as Array<keyof typeof sinks>;

  configureSync({
    reset: true,
    loggers: [
      {
        category: [],
        lowestLevel: normalizeLogLevel(process.env.LOG_LEVEL),
        sinks: sinkIds,
      },
      {
        category: ["logtape", "meta"],
        lowestLevel: "fatal",
        parentSinks: "override",
        sinks: [],
      },
    ],
    sinks,
  });

  logtapeLogger = getLogger([]);
  baseLogger = createDaemunLogger();
  installProcessErrorHandlers();

  const consoleMethods = ["log", "debug", "info", "warn", "error"] as const;
  consoleMethods.forEach((method) => {
    if (method === "log") {
      console[method] = baseLogger.info;
      return;
    }

    console[method] = baseLogger[method];
  });
}

function emit(level: LogLevel, label: string | undefined, args: unknown[]) {
  if (!logtapeLogger) {
    return;
  }

  const message = formatLogMessage(args);
  logtapeLogger.emit({
    level,
    message: [message],
    properties: label ? { label } : {},
    rawMessage: message,
    timestamp: Date.now(),
  });
}

function createDaemunLogger(label?: string): DaemunLogger {
  return {
    debug: (...args) => emit("debug", label, args),
    error: (...args) => emit("error", label, args),
    info: (...args) => emit("info", label, args),
    warn: (...args) => emit("warning", label, args),
  };
}

export default function createLogger(label: string) {
  if (!baseLogger) {
    init();
  }

  if (!loggers[label]) {
    loggers[label] = createDaemunLogger(label);
  }

  return loggers[label];
}
