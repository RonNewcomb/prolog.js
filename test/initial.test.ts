import { Rule, prolog, database, useDatabase, prettyPrintVarBindings, Bindings } from "../src/engine";
import { clear, importSource, nextline } from "../src/ui";
import { test, between, title, isLiteral, whitespace, getVarNamed, bindingsToObj } from "../src/test";

between(() => useDatabase([]));

let result: any;

test(
  () => {
    title("AST [holds, bucket, 834, yes].");
    const rule: Rule = {
      head: {
        tuple: [
          { literal: { rtype: "bareword", rvalue: "holds", bareword: "holds" } },
          { literal: { rtype: "string", rvalue: "bucket" } },
          { literal: { rtype: "number", rvalue: "834" } },
          { literal: { rtype: "bareword", rvalue: "yes", bareword: "yes" } },
        ],
      },
    };
    result = prolog(database, rule);
    const contents = database[0];
    if (contents != rule) throw "tell didn't insert rule but instead " + JSON.stringify(database);
  },

  () => {
    title("parsed [holds, bucket, 834, yes].");
    result = nextline(`[holds, "bucket", 834, yes].`);
    if (database.length !== 1) throw "nextline didn't insert rule";
  },

  () => {
    title("two assertions and a query, only two saved");
    result = nextline(`[holds, "bucket", 834, yes].`);
    result = nextline(`[holds, "bucket", 78, yes].`);
    result = nextline(`[holds, "bucket", 834, yes]?`);
    if (database.length !== 2) throw "nextline didn't query";
  },

  () => {
    result = nextline(`[holds, "bucket", 834, yes].`);
    result = nextline(`[holds, "bucket", 78, yes].`);
    const rule: Rule = {
      query: [
        {
          tuple: [
            { literal: { rtype: "bareword", rvalue: "holds", bareword: "holds" } },
            { literal: { rtype: "string", rvalue: "bucket" } },
            { literal: { rtype: "number", rvalue: "834" } },
            { literal: { rtype: "bareword", rvalue: "yes", bareword: "yes" } },
          ],
        },
      ],
    };
    const success = prolog(database, rule) != "no";
    if (database.length !== 2) throw "nextline didn't insert";
    if (!success) throw `[holds, "bucket", 834, yes]? didn't succeed`;
  },

  () => {
    title("parse a fact, ast query for NO");
    result = nextline(`[holds, "bucket", 834, yes].`);
    const rule: Rule = {
      head: undefined,
      query: [
        {
          tuple: [
            { literal: { rtype: "bareword", rvalue: "holds", bareword: "holds" } },
            { literal: { rtype: "string", rvalue: "bucket" } },
            { literal: { rtype: "number", rvalue: "78" } },
            { literal: { rtype: "bareword", rvalue: "yes", bareword: "yes" } },
          ],
        },
      ],
    };
    const success = prolog(database, rule) != "no";
    if (database.length !== 1) throw "nextline didn't insert";
    if (success) throw `[holds, "bucket", 78, yes]? didn't fail`;
  },

  () => {
    if (database.length != 0) throw "dirty database; between() didn't work";
  },

  () => {
    title("can query a fact for multiple vars");
    result = nextline(`[holds, "bucket", 89, yes].`);
    result = nextline(`[holds, the container, the weight, the openable]?`);
    if (result.length > 3) throw "Too many vars: " + result.join(" ");
    if (result.length < 3) throw "Not enough vars: " + result.join(" ");
    const vars = bindingsToObj(result);
    if (!vars.weight) throw "Var 'weight' not found: " + result.join(" ");
    if (isLiteral(vars.weight) != "89") throw `weight != 89`;
    if (!vars.container) throw "Var 'container' not found: " + result.join(" ");
    if (isLiteral(vars.container) != "bucket") throw `container != "bucket"`;
    if (!vars.openable) throw "Var 'openable' not found: " + result.join(" ");
    if (isLiteral(vars.openable) != "yes") throw `openable != "yes"`;
  },

  () => {
    title("can query with a var and then MORE");
    const magic1 = 345;
    const magic2 = 543;
    result = nextline(`[holds, "bucket", ${magic1}, yes].`);
    result = nextline(`[holds, "bucket", ${magic2}, yes].`);

    result = nextline(`[holds, "bucket", the num, yes]?`);
    if (typeof result === "string") throw "Returned " + result + " instead of some bindings";
    let vars = bindingsToObj(result);
    if (result.length > 1) throw "Too many vars: " + result.join(" ");
    if (result.length < 1) throw "Not enough vars: " + result.join(" ");
    if (!vars.num) throw "Var 'num' not found: " + result.join(" ");
    if (isLiteral(vars.num) != magic1) throw `num != ${magic1}`;

    result = nextline("more;");
    if (typeof result === "string") throw "Returned " + result + " instead of some bindings";
    vars = bindingsToObj(result);
    if (result.length > 1) throw "Too many vars: " + result.join(" ");
    if (result.length < 1) throw "Not enough vars: " + result.join(" ");
    if (!vars.num) throw "Var 'num' not found: " + result.join(" ");
    if (isLiteral(vars.num) != magic2) throw `num != ${magic2}`;

    result = nextline("more;");
    if (typeof result !== "string") throw "Returned scope instead of no: " + prettyPrintVarBindings(result);
    if (result != "no") throw "retval != no";
  },

  () => {
    title("can use a var in a fact");
    const magic = 654;
    result = nextline(`[holds, "bucket", the anything].`);
    result = nextline(`[holds, "bucket", ${magic}]?`);
    if (typeof result !== "string") throw "Returned scope instead of yes: " + prettyPrintVarBindings(result);
    if (result != "yes") throw "retval is " + result + " instead of yes";
  },

  () => {
    title("can query with an if that uses a var");
    const magic = 834;
    result = nextline(`[holds, "bucket", ${magic}, yes].`);
    result = nextline(`[hold, "bucket", the number] if [holds, "bucket", the number, yes].`);
    result = nextline(`[hold, "bucket", ${magic}]?`);
    // console.info(result);
    if (result !== "yes") throw "Returned " + prettyPrintVarBindings(result) + " instead of yes";
  },

  () => {
    title("Ensure query has something");
    result = nextline(`[hold, "bucket", the number] if [holds, "bucket", the number, yes].`);
    if (!database[0] || !database.length) throw "conditional fact (rule) wasn't memorized";
    if (!database[0].query) throw "query isn't an array";
    if (!database[0].query) throw "query isn't an array";
    if (!database[0].query.length) throw "query is empty";
    if (!database[0].query[0].tuple) throw "query lacks a tuple";
    if (!database[0].query[0].tuple.length) throw "query's tuple is empty";
    if (database[0].query[0].tuple.length != 4) throw "query's tuple isn't 4 items";
  },

  () => {
    title("can query with a var and an if that uses a different var");
    const magic = 45;
    result = nextline(`[holds, "bucket", ${magic}, yes].`);
    result = nextline(`[hold, "bucket", the number] if [holds, "bucket", the number, yes].`);
    result = nextline(`[hold, "bucket", the answer]?`);

    if (typeof result === "string") throw "Returned " + result + " instead of some bindings";
    let vars = bindingsToObj(result);
    if (result.length > 1) throw "Too many vars: " + result.join(" ");
    if (result.length < 1) throw "Not enough vars: " + result.join(" ");
    if (!vars.answer) throw "Var 'answer' not found: " + JSON.stringify(result);
    if (isLiteral(vars.answer) != magic) throw `answer != ${magic}, is ` + JSON.stringify(vars.answer);
  },

  () => {
    title("can query with a var and an if that uses the same var (name collision?)");
    const magic = 12;
    result = nextline(`[holds, "bucket", ${magic}, yes].`);
    result = nextline(`[hold, "bucket", the number] if [holds, "bucket", the number, yes].`);
    result = nextline(`[hold, "bucket", the number]?`);
    // console.info(result);
    if (typeof result === "string") throw "Returned " + result + " instead of some bindings";
    let vars = bindingsToObj(result);
    if (result.length > 1) throw "Too many vars: " + result.join(" ");
    if (result.length < 1) throw "Not enough vars: " + result.join(" ");
    if (!vars.number) throw "Var 'number' not found: " + result.join(" ");
    if (isLiteral(vars.number) != magic) throw `number != ${magic}, is ` + JSON.stringify(vars.answer);
  },

  // keep last for copy-pasting into testoutput.txt
  async () => {
    const iinfilename = "test/testinput.txt";
    const outfilename = "test/testoutput.txt";
    title("Run " + iinfilename + " and match with " + outfilename);
    clear();
    await importSource(iinfilename); // don't forget to return or await the promise
    const expected = (await fetch(outfilename).then(r => r.text())).replaceAll(whitespace, "");
    const actual = document.getElementById("consoleout")!.innerText.replaceAll(whitespace, "");
    if (expected != actual) {
      console.log(expected);
      console.log(actual);
      throw outfilename + " didn't match";
    }
  }
);

// 9 🚨 can use a var in a fact  ->  Returned scope instead of yes: The anything is 654.
// 10 🚨 can query with an if that uses a var  ->  Returned The number is 834. instead of yes
// 11 🚨 can query with a var and an if that uses a different var  ->  answer != 45, is undefined
// 12 🚨 can query with a var and an if that uses the same var (name collision?)  ->  number != 12, is false
