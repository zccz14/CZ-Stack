export const DOCS_SERVER_STORAGE_KEY = "cz-stack.scalar.server";
export const DEFAULT_SERVER_ID = "dev" as const;

export const presetServers = [
  {
    id: "dev",
    label: "Development",
    baseUrl: "https://dev.api.cz-stack.local",
  },
  {
    id: "staging",
    label: "Staging",
    baseUrl: "https://staging.api.cz-stack.local",
  },
  { id: "prod", label: "Production", baseUrl: "https://api.cz-stack.local" },
] as const;

export type PresetServerId = (typeof presetServers)[number]["id"];
