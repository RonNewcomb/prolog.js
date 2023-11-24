import { Database, Rule, ask, database, tell, useDatabase } from "../src2/engine2";
import { clear, importSource, nextline } from "../src2/ui";
import { test } from "../src2/test";

test(
  () => {
    const database: Database = [];
    useDatabase(database);
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
    tell(database, rule);
    const contents = database[0];
    if (contents != rule) throw "tell didn't insert rule but instead " + JSON.stringify(database);
  },

  () => {
    const database: Database = [];
    useDatabase(database);
    nextline(`[holds, "bucket", 834, yes].`);
    if (database.length !== 1) throw "nextline didn't insert rule";
  },

  () => {
    const database: Database = [];
    useDatabase(database);
    nextline(`[holds, "bucket", 834, yes].`);
    nextline(`[holds, "bucket", 78, yes].`);
    nextline(`[holds, "bucket", 834, yes]?`);
    if (database.length !== 2) throw "nextline didn't query";
  },

  () => {
    const database: Database = [];
    useDatabase(database);
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
    const success = ask(database, rule.query);
    if (database.length !== 2) throw "nextline didn't insert";
    if (!success) throw `[holds, "bucket", 834, yes]? didn't succeed`;
  },

  () => {
    const database: Database = [];
    useDatabase(database);
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
    const success = ask(database, rule.query);
    if (database.length !== 1) throw "nextline didn't insert";
    if (success) throw `[holds, "bucket", 78, yes]? didn't fail`;
  },

  async () => {
    clear();
    useDatabase([]);
    await importSource("test2/testinput.txt"); // don't forget to return or await the promise
  },

  () => {
    if (database.length != 4) throw "Database was cleaned or i wasnt waiting";
  },

  () => {
    useDatabase([]);
    if (database.length != 0) throw "or i wasnt waiting";
  }
);
