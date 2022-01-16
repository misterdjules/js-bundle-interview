import { open } from "fs/promises";
import path from "path";

type DependencyNode = {
  sourceFileName: string;
  children: DependencyNode[];
};

export async function findDeps(
  entryPoint: string,
  depsTree: DependencyNode,
  visitedDeps: Map<string, string[]>
) {
  let sourceBuffer = "";
  const fd = await open(entryPoint, "r");
  const stream = fd.createReadStream();
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
          depsTree.children.push({
            sourceFileName: requireTargetMatch[1],
            children: [],
          });
        }
        sourceBuffer = sourceBuffer.slice(endRequireIdx);
        requireIdx = sourceBuffer.indexOf("require(");
      }
    }
  }

  for (const depChild of depsTree.children) {
    let visitedDepsForEntryPoint = visitedDeps.get(entryPoint);
    console.log(
      `visited deps for ${depChild.sourceFileName}: ${visitedDepsForEntryPoint}`
    );

    if (visitedDepsForEntryPoint === undefined) {
      visitedDepsForEntryPoint = [];
      visitedDeps.set(entryPoint, visitedDepsForEntryPoint);
    }

    if (visitedDepsForEntryPoint.includes(depChild.sourceFileName)) {
      continue;
    }
    visitedDepsForEntryPoint.push(depChild.sourceFileName);

    await findDeps(
      path.join(path.dirname(entryPoint), depChild.sourceFileName),
      depChild,
      visitedDeps
    );
  }
}
