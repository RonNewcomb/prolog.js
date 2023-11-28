import { Rule, prolog, database, useDatabase } from "../src/engine";
import { clear, importSource, nextline } from "../src/ui";
import { test, between } from "../src/test";

between(() => useDatabase([]));

test(
  () => {
    const rule: Rule = {
      head: {
        tuple: [
          {
            literal: {
              rtype: "bareword",
              rvalue: "holds",
              bareword: "holds",
            },
          },
          { literal: { rtype: "string", rvalue: "bucket" } },
          { literal: { rtype: "number", rvalue: "834" } },
          {
            literal: { rtype: "bareword", rvalue: "yes", bareword: "yes" },
          },
        ],
      },
    };
    prolog(database, rule);
    const contents = database[0];
    if (contents != rule) throw "tell didn't insert rule but instead " + JSON.stringify(database);
  },

  () => {
    nextline(`[holds, "bucket", 834, yes].`);
    if (database.length !== 1) throw "nextline didn't insert rule";
  },

  () => {
    nextline(`[holds, "bucket", 834, yes].`);
    nextline(`[holds, "bucket", 78, yes].`);
    nextline(`[holds, "bucket", 834, yes]?`);
    if (database.length !== 2) throw "nextline didn't query";
  },

  () => {
    nextline(`[holds, "bucket", 834, yes].`);
    nextline(`[holds, "bucket", 78, yes].`);
    const rule: Rule = {
      head: undefined,
      query: [
        {
          tuple: [
            {
              literal: {
                rtype: "bareword",
                rvalue: "holds",
                bareword: "holds",
              },
            },
            { literal: { rtype: "string", rvalue: "bucket" } },
            { literal: { rtype: "number", rvalue: "834" } },
            {
              literal: { rtype: "bareword", rvalue: "yes", bareword: "yes" },
            },
          ],
        },
      ],
    };
    const success = prolog(database, rule) != "no";
    if (database.length !== 2) throw "nextline didn't insert";
    if (!success) throw `[holds, "bucket", 834, yes]? didn't succeed`;
  },

  () => {
    nextline(`[holds, "bucket", 834, yes].`);
    const rule: Rule = {
      head: undefined,
      query: [
        {
          tuple: [
            {
              literal: {
                rtype: "bareword",
                rvalue: "holds",
                bareword: "holds",
              },
            },
            { literal: { rtype: "string", rvalue: "bucket" } },
            { literal: { rtype: "number", rvalue: "78" } },
            {
              literal: { rtype: "bareword", rvalue: "yes", bareword: "yes" },
            },
          ],
        },
      ],
    };
    const success = prolog(database, rule) != "no";
    if (database.length !== 1) throw "nextline didn't insert";
    if (success) throw `[holds, "bucket", 78, yes]? didn't fail`;
  },

  async () => {
    clear();
    await importSource("test/testinput.txt"); // don't forget to return or await the promise
  },

  () => {
    if (database.length != 0) throw "dirty database";
  }
);
