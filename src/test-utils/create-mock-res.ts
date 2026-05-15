import { vi } from "vitest";

type MockBody = ReturnType<typeof JSON.parse>;

export interface MockResponse {
  body: MockBody;
  end: ReturnType<typeof vi.fn>;
  headers: Record<string, unknown>;
  json: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
  status: ReturnType<typeof vi.fn>;
  statusCode: number | null;
}

export default function createMockRes() {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
  } as MockResponse;

  res.status = vi.fn((code) => {
    res.statusCode = code;
    return res;
  });

  res.json = vi.fn((body) => {
    res.body = body;
    return res;
  });

  res.send = vi.fn((body) => {
    res.body = body;
    return res;
  });

  res.end = vi.fn((body) => {
    res.body = body;
    return res;
  });

  res.setHeader = vi.fn((key, value) => {
    res.headers[key] = value;
    return res;
  });

  return res;
}
