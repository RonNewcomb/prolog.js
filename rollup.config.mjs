import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from "@rollup/plugin-commonjs"

export default {
    input: "tmp/test/initial.test.js",
    output: {
        file: "./tmp/prolog.js",
        format: "iife",
        generatedCode: "es2015",
        name: "projamas",
    },
    plugins: [
        commonjs({ include: ["node_modules/**"], }),
        nodeResolve({}),
    ]
};
