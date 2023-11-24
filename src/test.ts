export async function test(...fns: Function[]) {
  let failed = 0;
  for (let i = 1; i <= fns.length; i++) {
    try {
      const retval = fns[i - 1](); // TODO check for Promise and await it
      if (retval instanceof Promise) await retval;
      console.log(i + " ✔️");
    } catch (e) {
      console.error(i, e);
      failed++;
    }
  }
  if (failed) console.error("🚨 " + failed + " tests failed 🚨");
  else console.info("✔️✔️ all tests passed");
}
