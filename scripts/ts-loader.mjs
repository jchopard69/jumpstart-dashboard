import ts from "typescript";
import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export async function resolve(specifier, context, defaultResolve) {
  // Try to resolve .ts extension for bare specifiers (no extension)
  if (
    specifier.startsWith(".") &&
    !specifier.endsWith(".ts") &&
    !specifier.endsWith(".tsx") &&
    !specifier.endsWith(".js") &&
    !specifier.endsWith(".mjs") &&
    !specifier.endsWith(".json")
  ) {
    for (const ext of [".ts", ".tsx"]) {
      try {
        const result = await defaultResolve(specifier + ext, context, defaultResolve);
        return result;
      } catch {
        // Try next extension
      }
    }
  }
  return defaultResolve(specifier, context, defaultResolve);
}

export async function load(url, context, defaultLoad) {
  if (url.endsWith(".ts") || url.endsWith(".tsx")) {
    const source = await readFile(fileURLToPath(url), "utf8");
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX
      }
    });
    return { format: "module", source: outputText, shortCircuit: true };
  }

  return defaultLoad(url, context, defaultLoad);
}
