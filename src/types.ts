export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export type QueryValue = string | string[];

export type QueryRecord = Record<string, QueryValue>;

export type UnknownRecord = Record<string, unknown>;

export type ApiFallback = Record<string, unknown>;

export interface QuickLaunchSettings extends UnknownRecord {
  hideVisitURL?: boolean;
  mobileButtonPosition?: string;
  name?: string;
  provider?: string;
  searchDescriptions?: boolean;
  showSearchSuggestions?: boolean;
  suggestionUrl?: string;
  target?: string;
  url?: string;
}

export type SettingsRecord = UnknownRecord & {
  background?:
    | string
    | (UnknownRecord & {
        blur?: boolean | string;
        brightness?: number | string;
        image?: string;
        opacity?: number;
        saturate?: number | string;
      });
  backgroundOpacity?: number;
  base?: string;
  blockHighlights?: unknown;
  bookmarksStyle?: string;
  cardBlur?: string;
  color?: string;
  description?: string;
  disableCollapse?: boolean;
  disableIndexing?: boolean;
  disableUpdateCheck?: boolean;
  fiveColumns?: boolean;
  favicon?: string;
  fullWidth?: boolean;
  groupsInitiallyCollapsed?: boolean;
  headerStyle?: string;
  hideErrors?: boolean;
  hideVersion?: boolean;
  language?: string;
  layout?: Record<string, LayoutRecord & { tab?: string }>;
  maxBookmarkGroupColumns?: number | string;
  maxGroupColumns?: number | string;
  quicklaunch?: QuickLaunchSettings;
  showStats?: boolean;
  statusStyle?: string;
  target?: string;
  theme?: string;
  title?: string;
  useEqualHeights?: boolean;
};

export interface LayoutRecord extends UnknownRecord {
  columns?: string;
  header?: boolean;
  icon?: string;
  iconsOnly?: boolean;
  initiallyCollapsed?: boolean;
  style?: string;
  useEqualHeights?: boolean;
}

export interface BookmarkRecord extends UnknownRecord {
  abbr?: string;
  description?: string;
  href?: string;
  icon?: string;
  id?: string;
  name: string;
  target?: string;
}

export interface BookmarkGroupRecord extends UnknownRecord {
  bookmarks: BookmarkRecord[];
  groups?: BookmarkGroupRecord[];
  name: string;
  type?: string;
}

export type ServiceRecord = UnknownRecord & {
  app?: string;
  container?: string;
  description?: string;
  external?: boolean;
  group?: string;
  href?: string;
  icon?: string;
  id?: string;
  name?: string;
  namespace?: string;
  ping?: boolean | string;
  podSelector?: string;
  proxmoxNode?: string;
  proxmoxType?: string;
  proxmoxVMID?: string;
  server?: string;
  service_group?: string;
  service_name?: string;
  showStats?: boolean;
  siteMonitor?: boolean | string;
  statusStyle?: string;
  target?: string;
  url?: string;
  widget?: UnknownRecord & {
    fields?: string | string[];
    hide_errors?: boolean;
    highlight?: unknown;
    type?: string;
  };
  widgets?: UnknownRecord[];
};

export interface ServiceGroupRecord extends UnknownRecord {
  groups?: ServiceGroupRecord[];
  name: string;
  parent?: string;
  services: ServiceRecord[];
  type?: string;
}

export interface HomePageProps extends UnknownRecord {
  initialSettings: SettingsRecord;
  fallback: {
    "/api/bookmarks": BookmarkGroupRecord[];
    "/api/hash": false | UnknownRecord;
    "/api/services": ServiceGroupRecord[];
    "/api/validate": unknown;
    "/api/widgets": UnknownRecord[];
  };
  locale: string;
}
