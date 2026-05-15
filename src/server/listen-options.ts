function getArgValue(argv, name) {
  const inlinePrefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(inlinePrefix));
  if (inline) return inline.slice(inlinePrefix.length);

  const index = argv.indexOf(`--${name}`);
  if (index === -1) return undefined;

  const value = argv[index + 1];
  if (!value || value.startsWith("--")) return undefined;
  return value;
}

export function getListenOptions({
  argv = process.argv.slice(2),
  env = process.env,
  defaultHost = "::",
  defaultPort = 3000,
} = {}) {
  const socketPath = getArgValue(argv, "socket");
  const host = getArgValue(argv, "host") ?? getArgValue(argv, "hostname") ?? env.HOSTNAME ?? env.HOST ?? defaultHost;
  const rawPort = getArgValue(argv, "port") ?? env.PORT ?? String(defaultPort);
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid port: ${rawPort}`);
  }

  return { hostname: host, port, socketPath };
}
