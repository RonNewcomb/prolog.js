const startup: Function[] = [];
let currentTitle = "";

export async function test(...fns: Function[]) {
  let failed = 0;
  for (let i = 1; i <= fns.length; i++) {
    try {
      currentTitle = "";
      startup.forEach(fn => fn());
      const retval = fns[i - 1](); // TODO check for Promise and await it
      if (retval instanceof Promise) await retval;
      console.log(i + " ✔️ " + (currentTitle || ""));
    } catch (e) {
      console.log(i + " 🚨 " + (currentTitle || ""), " -> ", e);
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

export const isLiteral = (v: any) => !!v && !!v[0] && v[0].literal && v[0].literal.rvalue;
