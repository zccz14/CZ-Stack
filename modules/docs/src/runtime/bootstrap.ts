import { DOCS_SERVER_STORAGE_KEY, presetServers } from "../config/servers.js";
import {
  isValidCustomBaseUrl,
  resolveSelection,
  type ServerSelection,
  toActiveBaseUrl,
} from "./state.js";

const CUSTOM_OPTION_VALUE = "__custom__";
const SCALAR_BRIDGE_MODULE_PATH = "../scalar-assets/scalar-reference-entry.js";

type ScalarServer = {
  url: string;
  description: string;
};

type ScalarReferenceApp = {
  unmount: () => void;
};

type ScalarReferenceBridge = {
  createScalarReferenceApp: (
    target: HTMLElement,
    props: ScalarReferenceProps,
  ) => ScalarReferenceApp;
};

type ScalarReferenceProps = {
  content: string;
  headerLinks: [];
  project: {
    name: string;
  };
  proxyUrl?: string;
  referenceUid: string;
  specPermalink?: string;
  version: {
    footerBelowSidebar: boolean;
    references: Record<string, { config: string }>;
    uid: string;
  };
  versionNames: [];
};

type SelectionRequestTracker = {
  begin: () => number;
  isCurrent: (requestId: number) => boolean;
};

type SyncRequestContext = {
  requestId: number;
  scalarRoot: HTMLElement;
  tracker: SelectionRequestTracker;
};

let activeScalarApp: ScalarReferenceApp | null = null;

export const createSelectionRequestTracker = (): SelectionRequestTracker => {
  let latestRequestId = 0;

  return {
    begin: () => {
      latestRequestId += 1;
      return latestRequestId;
    },
    isCurrent: (requestId) => requestId === latestRequestId,
  };
};

const createBanner = (baseUrl: string) => {
  const banner = document.createElement("div");
  banner.dataset.serverBanner = "true";
  banner.textContent = `Current server: ${baseUrl}`;
  return banner;
};

const buildServers = (activeBaseUrl: string) => {
  const unique = new Map<string, { url: string; description: string }>();
  unique.set(activeBaseUrl, {
    url: activeBaseUrl,
    description: "Current selection",
  });
  for (const preset of presetServers) {
    unique.set(preset.baseUrl, {
      url: preset.baseUrl,
      description: preset.label,
    });
  }
  return [...unique.values()];
};

const createControls = (selection: ServerSelection, activeBaseUrl: string) => {
  const shell = document.createElement("div");
  shell.dataset.serverShell = "true";

  const banner = createBanner(activeBaseUrl);

  const select = document.createElement("select");
  select.ariaLabel = "Server environment";
  for (const preset of presetServers) {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.label;
    select.append(option);
  }
  const customOption = document.createElement("option");
  customOption.value = CUSTOM_OPTION_VALUE;
  customOption.textContent = "Custom URL";
  select.append(customOption);

  const customInput = document.createElement("input");
  customInput.type = "url";
  customInput.placeholder = "https://review.api.cz-stack.local/";
  customInput.value = selection.kind === "custom" ? selection.baseUrl : "";

  const confirmButton = document.createElement("button");
  confirmButton.type = "button";
  confirmButton.textContent = "Apply custom URL";

  select.value =
    selection.kind === "preset" ? selection.presetId : CUSTOM_OPTION_VALUE;

  shell.append(banner, select, customInput, confirmButton);

  return { shell, banner, select, customInput, confirmButton };
};

const readOpenApiSource = async () => {
  const response = await fetch("./openapi.yaml", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ./openapi.yaml: ${response.status}`);
  }

  const source = await response.text();
  if (!source.trim()) {
    throw new Error("Expected ./openapi.yaml to be non-empty");
  }

  return source;
};

const getScalarRoot = () => {
  const root = document.querySelector<HTMLElement>("[data-scalar-root]");
  if (!root) {
    throw new Error("Expected [data-scalar-root] mount container");
  }

  return root;
};

const createScalarProps = (
  openApiSource: string,
  activeBaseUrl: string,
): ScalarReferenceProps => {
  const referenceUid = "local-openapi-reference";

  return {
    content: openApiSource,
    headerLinks: [],
    project: {
      name: "CZ-Stack API Reference",
    },
    referenceUid,
    version: {
      footerBelowSidebar: false,
      references: {
        [referenceUid]: {
          config: JSON.stringify({
            servers: buildServers(activeBaseUrl),
          }),
        },
      },
      uid: "local-openapi-version",
    },
    versionNames: [],
  };
};

const loadScalarBridge = async (): Promise<ScalarReferenceBridge> => {
  const bridge = (await import(
    SCALAR_BRIDGE_MODULE_PATH
  )) as Partial<ScalarReferenceBridge>;
  if (typeof bridge.createScalarReferenceApp !== "function") {
    throw new Error("Failed to load the local Scalar browser bridge");
  }

  return bridge as ScalarReferenceBridge;
};

export const syncScalarServer = async (
  activeBaseUrl: string,
  requestContext?: SyncRequestContext,
): Promise<boolean> => {
  const openApiSource = await readOpenApiSource();
  if (
    requestContext &&
    !requestContext.tracker.isCurrent(requestContext.requestId)
  ) {
    return false;
  }

  const scalarRoot = requestContext?.scalarRoot ?? getScalarRoot();
  const scalarBridge = await loadScalarBridge();
  if (
    requestContext &&
    !requestContext.tracker.isCurrent(requestContext.requestId)
  ) {
    return false;
  }

  activeScalarApp?.unmount();
  activeScalarApp = null;
  scalarRoot.replaceChildren();
  activeScalarApp = scalarBridge.createScalarReferenceApp(
    scalarRoot,
    createScalarProps(openApiSource, activeBaseUrl),
  );

  return requestContext
    ? requestContext.tracker.isCurrent(requestContext.requestId)
    : true;
};

export const bootstrapDocs = () => {
  const selectionTracker = createSelectionRequestTracker();
  const selection = resolveSelection(
    localStorage.getItem(DOCS_SERVER_STORAGE_KEY),
  );
  const activeBaseUrl = toActiveBaseUrl(selection);
  const { shell, banner, select, customInput, confirmButton } = createControls(
    selection,
    activeBaseUrl,
  );

  document.body.prepend(shell);

  const applyServerSelection = async (nextSelection: ServerSelection) => {
    const requestId = selectionTracker.begin();
    const nextBaseUrl = toActiveBaseUrl(nextSelection);
    const scalarRoot = getScalarRoot();

    scalarRoot.replaceChildren();

    const remountSucceeded = await syncScalarServer(nextBaseUrl, {
      requestId,
      scalarRoot,
      tracker: selectionTracker,
    });

    if (!remountSucceeded || !selectionTracker.isCurrent(requestId)) {
      return;
    }

    localStorage.setItem(
      DOCS_SERVER_STORAGE_KEY,
      JSON.stringify(nextSelection),
    );
    banner.textContent = `Current server: ${nextBaseUrl}`;
    select.value =
      nextSelection.kind === "preset"
        ? nextSelection.presetId
        : CUSTOM_OPTION_VALUE;
    customInput.value =
      nextSelection.kind === "custom" ? nextSelection.baseUrl : "";
    customInput.setCustomValidity("");
  };

  select.addEventListener("change", () => {
    if (select.value === CUSTOM_OPTION_VALUE) {
      customInput.focus();
      return;
    }

    void applyServerSelection({
      kind: "preset",
      presetId: select.value as (typeof presetServers)[number]["id"],
    });
  });

  confirmButton.addEventListener("click", () => {
    const candidate = customInput.value.trim();
    if (!isValidCustomBaseUrl(candidate)) {
      customInput.setCustomValidity("Enter a full http:// or https:// origin.");
      customInput.reportValidity();
      return;
    }

    void applyServerSelection({ kind: "custom", baseUrl: candidate });
  });

  const initialRequestId = selectionTracker.begin();
  const scalarRoot = getScalarRoot();
  void syncScalarServer(activeBaseUrl, {
    requestId: initialRequestId,
    scalarRoot,
    tracker: selectionTracker,
  }).then((remountSucceeded) => {
    if (!remountSucceeded || !selectionTracker.isCurrent(initialRequestId)) {
      return;
    }

    localStorage.setItem(DOCS_SERVER_STORAGE_KEY, JSON.stringify(selection));
    banner.textContent = `Current server: ${activeBaseUrl}`;
  });
};

if (typeof document !== "undefined" && typeof localStorage !== "undefined") {
  bootstrapDocs();
}
