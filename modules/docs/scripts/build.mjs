import { execFile } from "node:child_process";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);
const docsDir = new URL("../", import.meta.url);
const distDir = new URL("../dist/", import.meta.url);
const runtimeDir = new URL("../dist/runtime/", import.meta.url);
const scalarAssetsDir = new URL("../dist/scalar-assets/", import.meta.url);
const scalarBundledAssetsDir = new URL("../dist/scalar-assets/assets/", import.meta.url);
const scalarCliDir = new URL("../node_modules/@scalar/cli/", import.meta.url);
const scalarClientAssetsDir = new URL("./client/assets/", scalarCliDir);
const runtimeSourceDir = new URL("../src/runtime/", import.meta.url);
const runtimeStylesPath = new URL("../src/runtime/styles.css", import.meta.url);
const runtimeTsBuildInfoPath = new URL(
  "../tsconfig.tsbuildinfo",
  import.meta.url,
);
const scalarConfigPath = new URL("../scalar.config.json", import.meta.url);
const scalarConfig = JSON.parse(await readFile(scalarConfigPath, "utf8"));

const hasRuntimeTypeScript = async () => {
  const entries = await readdir(runtimeSourceDir, {
    recursive: true,
    withFileTypes: true,
  }).catch(() => []);

  return entries.some((entry) => entry.isFile() && entry.name.endsWith(".ts"));
};

const scalarAssetEntries = await readdir(scalarClientAssetsDir);
const scalarEntryScript = scalarAssetEntries.find((entry) =>
  /^index-.*\.js$/.test(entry),
);
const scalarEntryStylesheet = scalarAssetEntries.find((entry) =>
  /^index-.*\.css$/.test(entry),
);
const scalarReferenceModule = scalarAssetEntries.find((entry) =>
  /^ReferenceContentLoader-.*\.js$/.test(entry),
);
const scalarSansFontStack =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const scalarMonoFontStack =
  'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

if (!scalarEntryScript || !scalarEntryStylesheet || !scalarReferenceModule) {
  throw new Error(
    "expected @scalar/cli client assets to include the entry script, stylesheet, and reference module",
  );
}

const scalarWrapperSource = `import { ae as createApp, av as createScalarAppPlugin } from "./assets/${scalarEntryScript}";
import { ScalarReference } from "./assets/${scalarReferenceModule}";

export const createScalarReferenceApp = (target, props) => {
  const app = createApp(ScalarReference, props);
  app.use(createScalarAppPlugin());
  app.mount(target);
  return app;
};
`;

const patchScalarFontSources = (source) => {
  const withoutRemoteFonts = source.replace(
    /@font-face\s*\{[\s\S]*?fonts\.scalar\.com[\s\S]*?\}/g,
    "",
  );

  return withoutRemoteFonts
    .replace(/--scalar-font:[^;]+;/, `--scalar-font:${scalarSansFontStack};`)
    .replace(
      /--scalar-font-code:[^;]+;/,
      `--scalar-font-code:${scalarMonoFontStack};`,
    );
};

const patchScalarStylesheet = async () => {
  const scalarStylesheetPath = new URL(
    `./${scalarEntryStylesheet}`,
    scalarBundledAssetsDir,
  );
  const stylesheetSource = await readFile(scalarStylesheetPath, "utf8");
  const patchedStylesheet = patchScalarFontSources(stylesheetSource);

  if (patchedStylesheet.includes("fonts.scalar.com")) {
    throw new Error(
      "expected vendored Scalar stylesheet to remove fonts.scalar.com references",
    );
  }

  await writeFile(scalarStylesheetPath, patchedStylesheet, "utf8");
};

const patchScalarAssetModuleSpecifiers = async () => {
  const entries = await readdir(scalarBundledAssetsDir, {
    recursive: true,
    withFileTypes: true,
  });

  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
      .map(async (entry) => {
        const assetPath = new URL(`./${entry.name}`, scalarBundledAssetsDir);
        const source = await readFile(assetPath, "utf8");
        const patchedSource = source.replaceAll('"assets/', '"./');

        if (patchedSource !== source) {
          await writeFile(assetPath, patchedSource, "utf8");
        }
      }),
  );
};

const patchScalarEntryScript = async () => {
  const scalarEntryScriptPath = new URL(
    `./${scalarEntryScript}`,
    scalarBundledAssetsDir,
  );
  const entrySource = await readFile(scalarEntryScriptPath, "utf8");
  const patchedEntrySource = entrySource
    .replace(
      'const Fp="modulepreload",Zp=function(e){return"/"+e},Sa={}',
      'const Fp="modulepreload",Zp=function(e){return new URL(e,import.meta.url).href},Sa={}',
    )
    .replace(
      /function Ig\(\)\{[\s\S]*?jc\(\$g\.port,\{[\s\S]*?\}\);export\{/,
      'function Ig(){return{port:Number.NaN}}export{',
    )
    .replace(/};\s*$/, ',Sh as av};');

  if (patchedEntrySource === entrySource) {
    throw new Error(
      "expected to patch the vendored Scalar entry script for static embedding",
    );
  }

  await writeFile(scalarEntryScriptPath, patchedEntrySource, "utf8");
};

const docsHtml = `<!doctype html>
<html>
  <head>
    <title>${scalarConfig.title}</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        margin: 0;
      }
    </style>
    <link rel="stylesheet" href="./scalar-assets/assets/${scalarEntryStylesheet}" />
    <link rel="stylesheet" href="./runtime/styles.css" />
  </head>
  <body>
    <div data-scalar-root></div>
    <script type="module" src="./runtime/bootstrap.js"></script>
  </body>
</html>
`;

await rm(distDir, { force: true, recursive: true });
await rm(new URL("../.runtime-dist", import.meta.url), {
  force: true,
  recursive: true,
});
await rm(runtimeTsBuildInfoPath, { force: true });

await mkdir(distDir, { recursive: true });
await mkdir(runtimeDir, { recursive: true });
await mkdir(scalarAssetsDir, { recursive: true });
await mkdir(scalarBundledAssetsDir, { recursive: true });

if (await hasRuntimeTypeScript()) {
  await run("pnpm", ["exec", "tsc", "--project", "./tsconfig.json"], {
    cwd: docsDir,
  });
  await cp(new URL("../.runtime-dist", import.meta.url), distDir, {
    recursive: true,
  });
}

await cp(runtimeStylesPath, new URL("./styles.css", runtimeDir));
await cp(scalarClientAssetsDir, scalarBundledAssetsDir, { recursive: true });
await patchScalarAssetModuleSpecifiers();
await patchScalarStylesheet();
await patchScalarEntryScript();
await cp(
  new URL("../../contract/openapi/openapi.yaml", import.meta.url),
  new URL("../dist/openapi.yaml", import.meta.url),
);
const referenceModulePath = new URL(
  `./${scalarReferenceModule}`,
  scalarBundledAssetsDir,
);
const referenceModuleSource = await readFile(referenceModulePath, "utf8");
const patchedReferenceModuleSource = patchScalarFontSources(
  referenceModuleSource,
);

if (patchedReferenceModuleSource.includes("fonts.scalar.com")) {
  throw new Error(
    "expected vendored Scalar reference module to remove fonts.scalar.com references",
  );
}

await writeFile(
  referenceModulePath,
  `${patchedReferenceModuleSource}\nexport { kMe as ScalarReference };\n`,
  "utf8",
);
await writeFile(
  new URL("./scalar-reference-entry.js", scalarAssetsDir),
  scalarWrapperSource,
  "utf8",
);
await writeFile(new URL("./index.html", distDir), docsHtml, "utf8");

await Promise.all([
  readFile(new URL("../dist/index.html", import.meta.url), "utf8"),
  readFile(new URL("../dist/openapi.yaml", import.meta.url), "utf8"),
  readFile(new URL("../dist/runtime/bootstrap.js", import.meta.url), "utf8"),
  readFile(
    new URL("../dist/scalar-assets/scalar-reference-entry.js", import.meta.url),
    "utf8",
  ),
]);
