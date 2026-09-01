import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/haus-card.ts",
  output: {
    file: "dist/haus-card.js",
    format: "es",
    sourcemap: false,
  },
  plugins: [
    resolve(),
    typescript({
      tsconfig: "./tsconfig.json",
      exclude: ["**/*.test.ts"],
      compilerOptions: { outDir: "dist", declaration: false },
    }),
    terser(),
  ],
};
