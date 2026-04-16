import {
  DEFAULT_SERVER_ID,
  type PresetServerId,
  presetServers,
} from "../config/servers.js";

export type ServerSelection =
  | { kind: "preset"; presetId: PresetServerId }
  | { kind: "custom"; baseUrl: string };

const defaultSelection = (): ServerSelection => ({
  kind: "preset",
  presetId: DEFAULT_SERVER_ID,
});

const isPresetServerId = (value: unknown): value is PresetServerId =>
  presetServers.some((item) => item.id === value);

export const isValidCustomBaseUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
};

export const resolveSelection = (raw: string | null): ServerSelection => {
  if (!raw) return defaultSelection();

  try {
    const parsed = JSON.parse(raw) as Partial<ServerSelection>;

    if (parsed.kind === "preset" && isPresetServerId(parsed.presetId)) {
      return { kind: "preset", presetId: parsed.presetId };
    }

    if (
      parsed.kind === "custom" &&
      typeof parsed.baseUrl === "string" &&
      isValidCustomBaseUrl(parsed.baseUrl)
    ) {
      return { kind: "custom", baseUrl: parsed.baseUrl };
    }
  } catch {
    return defaultSelection();
  }

  return defaultSelection();
};

export const toActiveBaseUrl = (selection: ServerSelection): string =>
  selection.kind === "preset"
    ? (presetServers.find((item) => item.id === selection.presetId)?.baseUrl ??
      presetServers[0].baseUrl)
    : selection.baseUrl;
