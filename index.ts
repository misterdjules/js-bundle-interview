import { open } from "fs/promises";
import path from "path";

type RegistryNode = {
  sourceFileAbsolutePath: string;
  sourceFileName: string;
  sourceDirName: string;
  sourceContent: string;
};

type Registry = Map<string, RegistryNode>;

export async function buildRegistryForEntryPoint(
  baseDirPath: string,
  entryPoint: string,
  id: string,
  visitedDeps: Map<string, string[]>,
  registry: Registry
) {
  let sourceBuffer = "";
  const fd = await open(entryPoint, "r");
  const stream = fd.createReadStream();
  const newDeps: { id: string; entryPoint: string }[] = [];

  for await (const chunk of stream) {
    sourceBuffer += chunk.toString();
    let requireIdx = sourceBuffer.indexOf("require(");
    while (requireIdx !== -1) {
      const endRequireIdx = sourceBuffer.indexOf(")", requireIdx);

      if (endRequireIdx !== -1) {
        const requireStmt = sourceBuffer.substring(
          requireIdx,
          endRequireIdx + 1
        );

        const requireTargetMatch = requireStmt.match(/require\(\"(.*)\"\)/);
        if (requireTargetMatch) {
          const requireTarget = requireTargetMatch[1];
          const targetAbsolutePath = path.resolve(
            path.dirname(entryPoint),
            requireTarget
          );
          const id = path.relative(baseDirPath, targetAbsolutePath);
          if (!registry.has(id)) {
            registry.set(id, {
              sourceFileAbsolutePath: targetAbsolutePath,
              sourceFileName: path.basename(targetAbsolutePath),
              sourceDirName: path.dirname(targetAbsolutePath),
              sourceContent: "",
            });
          }
          newDeps.push({ id, entryPoint: targetAbsolutePath });
          sourceBuffer = sourceBuffer.replace(
            `require("${requireTarget}")`,
            `require("${id}")`
          );
        }
        requireIdx = sourceBuffer.indexOf("require(", endRequireIdx + 1);
      }
    }
  }

  const registryItem = registry.get(id);
  if (registryItem === undefined) {
    throw new Error(`Item with ID ${id} missing while walking through it`);
  }

  registryItem.sourceContent = sourceBuffer;

  for (const dep of newDeps) {
    let visitedDepsForId = visitedDeps.get(entryPoint);
    if (visitedDepsForId === undefined) {
      visitedDepsForId = [];
      visitedDeps.set(entryPoint, visitedDepsForId);
    }

    if (visitedDepsForId.includes(dep.id)) {
      continue;
    }
    visitedDepsForId.push(dep.id);

    await buildRegistryForEntryPoint(
      baseDirPath,
      dep.entryPoint,
      dep.id,
      visitedDeps,
      registry
    );
  }
}

export async function bundle(entryPoint: string) {
  const registry = new Map<string, RegistryNode>();
  const entryPointId = path.basename(entryPoint);
  registry.set(entryPointId, {
    sourceFileAbsolutePath: entryPoint,
    sourceFileName: path.basename(entryPoint),
    sourceDirName: path.dirname(entryPoint),
    sourceContent: "",
  });

  await buildRegistryForEntryPoint(
    path.dirname(entryPoint),
    entryPoint,
    path.basename(entryPoint),
    new Map<string, string[]>(),
    registry
  );

  let bundleContent = "";
  bundleContent += "registryCache = {}\n";
  bundleContent += "const registry = {\n";

  for (const [registryItemId, registryItem] of registry) {
    bundleContent += `'${registryItemId}': ${wrapModule(
      registryItem.sourceContent
    )},\n`;
  }
  bundleContent += "};\n";

  bundleContent += generateRuntime();

  bundleContent += `require('${entryPointId}')\n`;

  return bundleContent;
}

function generateRuntime() {
  return `
    function require(id) {
      if (registryCache[id]) {
        return registryCache[id].exports;
      }

      const module = {exports: {}};
      registryCache[id] = module;
      registry[id](module.exports, require, module, registry[id].sourceFileName, registry[id].sourceDirName);

      return module.exports;
    }
  `;
}

function wrapModule(sourceContent: string) {
  return (
    "function (exports, require, module, __filename, __dirname) {" +
    sourceContent +
    "}"
  );
}

(async () => {
  console.log(await bundle(path.join(__dirname, "tests/basic/index.js")));
  //console.log(await bundle(path.join(__dirname, "tests/depth-2/index.js")));
  //console.log(await bundle(path.join(__dirname, "tests/cycles/index.js")));
})();
