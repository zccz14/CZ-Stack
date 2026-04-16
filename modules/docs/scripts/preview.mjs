import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const [, , rootArg = "./dist", portArg = "43240"] = process.argv;
const rootPath = resolve(process.cwd(), rootArg);
const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".yaml", "application/yaml; charset=utf-8"],
]);

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const requestPath = url.pathname === "/" ? "index.html" : url.pathname;
  const filePath = normalize(resolve(rootPath, `.${sep}${requestPath}`));

  if (filePath !== rootPath && !filePath.startsWith(`${rootPath}${sep}`)) {
    response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "content-type":
        contentTypes.get(extname(filePath)) ?? "application/octet-stream",
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(Number(portArg), "127.0.0.1");
