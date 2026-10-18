import { describe, expect, it } from "vitest";
import { rolldown } from "rolldown";
import { resolve } from "node:path";

describe("production cube bundle", () => {
  it("retains the cube constructor and solver during tree shaking", async () => {
    const bundle = await rolldown({
      input: resolve("src/vendor/cubejs/index.ts"),
      platform: "browser",
      treeshake: true,
    });
    try {
      const { output } = await bundle.generate({ format: "esm", minify: true });
      const chunk = output.find((entry) => entry.type === "chunk");
      if (!chunk || chunk.type !== "chunk") throw new Error("Missing cube bundle");
      const { default: Cube } = await import(/* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(chunk.code).toString("base64")}`);
      expect(typeof Cube).toBe("function");
      const cube = new Cube();
      expect(cube.isSolved()).toBe(true);
      cube.move("R U F");
      expect(cube.isSolved()).toBe(false);
      Cube.initSolver();
      cube.move(cube.solve());
      expect(cube.isSolved()).toBe(true);
    } finally {
      await bundle.close();
    }
  }, 20000);
});