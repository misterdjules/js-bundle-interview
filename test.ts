import * as path from "path";
import { findDeps } from "./";
import util from "util";

process.on("unhandledRejection", (rejectionErr) => {
  console.error(`Unhandled rejection error: ${rejectionErr}`);
});

async function testCase(entryPoint: string) {
  try {
    const entryPointAbsPath = path.join(__dirname, entryPoint);
    const depsTree = { sourceFileName: entryPoint, children: [] };
    await findDeps(entryPointAbsPath, depsTree, new Map<string, string[]>());
    console.log("depsTree:", util.inspect(depsTree, { depth: null }));
  } catch (err) {
    console.error(`Error: ${err}`);
  }
}
(async () => {
  await testCase("./tests/basic/index.js");
  await testCase("./tests/depth-2/index.js");
  await testCase("./tests/cycles/index.js");
})();
