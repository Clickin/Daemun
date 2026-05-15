export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export type QueryValue = string | string[];

export type QueryRecord = Record<string, QueryValue>;

export type UnknownRecord = Record<string, unknown>;

export type ApiFallback = Record<string, unknown>;

export type SettingsRecord = UnknownRecord & {
  blockHighlights?: unknown;
  color?: string;
  hideErrors?: boolean;
  target?: string;
  theme?: string;
};

export type ServiceRecord = UnknownRecord & {
  href?: string;
  service_group?: string;
  service_name?: string;
  target?: string;
  url?: string;
  widget?: UnknownRecord & {
    fields?: string | string[];
    hide_errors?: boolean;
    highlight?: unknown;
    type?: string;
  };
};

export interface HomePageProps {
  initialSettings: UnknownRecord;
  fallback: {
    "/api/bookmarks": unknown[];
    "/api/hash": false | UnknownRecord;
    "/api/services": unknown[];
    "/api/validate": unknown;
    "/api/widgets": unknown[];
  };
  locale: string;
}
