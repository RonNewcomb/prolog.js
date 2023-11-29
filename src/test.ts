import { Binding, Bindings, TupleItem } from "./engine";

const startup: Function[] = [];
let currentTitle = "";

export async function test(...fns: Function[]) {
  let failed = 0;
  for (let i = 1; i <= fns.length; i++) {
    const iString = i < 10 ? " " + i : i;
    try {
      currentTitle = "";
      startup.forEach(fn => fn());
      const retval = fns[i - 1](); // TODO check for Promise and await it
      if (retval instanceof Promise) await retval;
      console.log(iString + " ✔️ " + (currentTitle || ""));
    } catch (e) {
      console.log(iString + " 🚨 " + (currentTitle || ""), " -> ", e);
      failed++;
    }
  }
  if (failed) console.error("🚨 " + failed + " tests failed 🚨");
  else console.info("✔️✔️ all tests passed");
}

export function between(...fns: Function[]) {
  startup.push(...fns);
}

export function title(msg: string): void {
  currentTitle = msg;
}

export const whitespace = /[ \r\n]/g;

// specific to engine ///////

export const isLiteral = (v: any) => !!v && v.literal && v.literal.rvalue;

export const getVarNamed = (varName: string, bindings: Bindings): Binding | undefined => {
  const binding = bindings.find(([a, b]) => a.variable && a.variable.bareword == varName);
  if (binding) return binding;
  const reverse = bindings.find(([a, b]) => b.variable && b.variable.bareword == varName);
  if (reverse) return [reverse[1], reverse[0]];
  return undefined;
};

export const bindingsToObj = (bindings: Bindings): Record<string, TupleItem> => {
  return bindings.reduce((sum, each) => {
    const variable = each[0].variable ? each[0] : each[1];
    const value = each[0] == variable ? each[1] : each[0];
    const varName = variable.variable?.bareword || "_";
    sum[varName] = value;
    return sum;
  }, {} as Record<string, TupleItem>);
};
