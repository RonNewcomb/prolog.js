import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from "@rollup/plugin-commonjs"

export default {
    // input: "tmp/main.js",
    input: "tmp/src2/engine2.js",
    output: {
        file: "./tmp/prolog.js",
        format: "iife",
        generatedCode: "es2015",
    },
    plugins: [
        commonjs({
            include: ["node_modules/**"],
        }),
        nodeResolve({

        }),
    ]
};
