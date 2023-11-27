import { clear, consoleOutError, printAnswerline, printEcholine, onNextLine } from "./ui";
import { Parser, Grammar } from "nearley";
import "../../tmp/projama.js"; // found from /tmp/src2/engine2.js

const grammar = (window as any).grammar; // created by iife in projama.js

export interface Literal {
  literal: {
    rvalue: string | number | boolean;
    rtype: "bareword" | "string" | "number" | "boolean";
    bareword?: string;
  };
  variable?: never; // for typechecking
  tuple?: never; // for typechecking
}
export interface Variable {
  variable: {
    bareword: string;
  };
  literal?: never; // for typechecking
  tuple?: never; // for typechecking
}
export type TupleItem = Literal | Variable | Tuple;
export interface Tuple {
  tuple: TupleItem[];
  variable?: never; // for typechecking
  literal?: never; // for typechecking
}
export interface Rule {
  head?: Tuple;
  query?: Tuple[];
}
export interface InputFile {
  lines: Rule[];
}

const sample2: InputFile = {
  lines: [
    {
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
    },
  ],
};

type Scope = Record<string, [TupleItem]>; // the extra [] wrapper is to have pointers to the value
export type Database = Rule[];

interface GraphNode {
  //parent?: GraphNode;
  queryToProve: Tuple;
  database: Database;
  dbIndex: number; // backtracking increases this number; unification with head stops increasing it
  //rule: Rule; // === database[dbIndex]
  //headThatUnifies: Rule["rule"]["head"];
  vars?: Scope;
  //queryIndex: number; // rule.body[queryIndex] // backtracking decreases this number; unification increases it
  querysToProve?: GraphNode[];
}

const enum Direction {
  Failing, // backtracking
  Succeeded,
}

export let database: Database = [];
export const useDatabase = (db: Database) => (database = db);
let previousRun: GraphNode = { queryToProve: { tuple: [] }, database, dbIndex: -1 };

export function prolog(database: Database, rule: Rule | undefined): boolean | void {
  if (rule?.head) {
    database.push(rule);
    printAnswerline("Memorized.\n");
    return;
  }
  previousRun = rule?.query ? <GraphNode>{ queryToProve: rule?.query[0], database, dbIndex: -1 } : previousRun;
  const result = goer(previousRun) === Direction.Succeeded;
  printAnswerline(!result ? "No." : previousRun.vars ? prettyPrintVarBindings(previousRun.vars) : "Yes.");
  return result;
}

export function failThatAnswer(current: GraphNode): void {
  if (current.querysToProve && current.querysToProve.length) failThatAnswer(current.querysToProve[current.querysToProve.length - 1]);
  else current.vars = undefined;
}

export const listing = () => database.forEach(rule => console.log(JSON.stringify(rule)));

console.info("enter listing() to show the database");
(window as any).listing = listing;

/*
for every goal, 
  find [the next] rule in the database which unifies with its head 
  for each of the rule body's subgoals, <recurse>
  if no rule head in the database unifies with it, or no rule with a body fully unifies, backtrack & try the next, 
*/
function goer(current: GraphNode): Direction {
  // on a backtrack, start over // javascript's weird way of doing a GOTO
  on_backtracking: do {
    // find a rule in database that unifies with current .queryToProve (unification sets .vars)
    if (!current.vars) {
      // clean this
      current.querysToProve = [];

      // find a rule in the db that unifies with our current.queryToProve
      let nextrule: Rule | undefined;
      while (!current.vars) {
        // get next rule to try
        current.dbIndex++;
        nextrule = current.database[current.dbIndex];

        // if we ran out of rules to try, return failure.
        if (!nextrule) return Direction.Failing;

        // does it unify?
        current.vars = unify(current.vars || {}, current.queryToProve, nextrule.head!);
      }

      // console.log("UNIFIED with rule #", current.dbIndex);

      // we found a rule that unified. If it had conditions, we will try those conditions
      if (nextrule!.query)
        for (const query of nextrule!.query)
          current.querysToProve.push({
            queryToProve: query,
            database: current.database,
            dbIndex: -1,
          });
    }

    // check children recursively, regardless whether this is a replay or they're fresh
    for (const query of current.querysToProve!) {
      // child returns success or failure.
      const state = goer(query);
      if (state == Direction.Succeeded) continue;

      // if child didn't succeed, then nextrule doesn't succeed. Reset and restart with a new db rule
      current.vars = undefined;
      continue on_backtracking; // javascript's weird way of doing a GOTO
    }
  } while (false); // javascript's weird way of doing a GOTO

  return Direction.Succeeded; // all children succeeded, so, I do too.
}

/*
to get the Value of a tupleitem,
   if its also a tuple, it stays a tuple but each of its own items follow this
   if its a literal it stays a literal
   if its an unbound var it stays an unbound var
   if its a bound var its what's inside the var:  scope[variable.name][0] 
to unify two tupleitems,
   get the Value of each -- all bound vars just became literals or tuples
   if either is an unbound var, create new scope binding the unbound to the other
   if either is a literal, then both must be literal and values equal; no new scope needed creating
   else, both are tuples, so,
   TO UNIFY TWO TUPLES:
    so, each respective pair must unify (implying length is same)
    if the length doesn't match, no unify
    starting with the current scope,
      unify each respective tupleitem pairs, building up new scope each time
      if any pair doesn't unify then the tuples don't unify
    ... notice that the only time a new scope is Actually created is when an unbound var gets bound to something
to create new scope (from an old one)
   create a new object subclassed from the old one
   newScope = Object.create(oldScope || null);
   newScope[variable.name] = tupleitem;
*/

function addToScope(oldScope: Scope | undefined, varName: string, tupleItem: TupleItem): Scope {
  // a new scope is subclassed to ease rollbacking the assignment to varName
  const newScope = Object.create(oldScope || null) as Scope;
  // the value is wrapped in an [...] so we can use references when many vars point to each other and only the last to the tuple/literal
  newScope[varName] = [tupleItem];
  return newScope;
}

function valueOf(item: TupleItem, scope: Scope): TupleItem {
  // value of a literal is itself
  if (item.literal) return item;
  // value of a tuple is a tuple of the values of each item in the tuple
  if (item.tuple) return { tuple: item.tuple.map(it => valueOf(it, scope)) };
  // value of a bound var is the literal or tuple its bound to
  const isBoundVar = scope[item.variable.bareword];
  // value of an unbound var is itself
  return isBoundVar ? isBoundVar[0] : item;
}

function unify(scope: Scope | undefined, a: TupleItem, b: TupleItem): Scope | undefined {
  if (!scope) return undefined;
  const x = valueOf(a, scope);
  const y = valueOf(b, scope);
  // console.log("trying to unify", x, "with", y);
  if (x.variable) return addToScope(scope, x.variable.bareword, y);
  if (y.variable) return addToScope(scope, y.variable.bareword, x);
  if (x.literal || y.literal) return x.literal!.rvalue == y.literal!.rvalue ? scope : undefined;
  if (x.tuple.length != y.tuple.length) return undefined;
  for (let i = 0; i < x.tuple.length; i++) scope = unify(scope, x.tuple[i], y.tuple[i]);
  return scope;
}

interface ErrorShape {
  offset: number;
  token: { value: string };
}

onNextLine(line => {
  try {
    let rule: Rule | undefined = undefined;
    if (line == "listing") return database.forEach(rule => printAnswerline(JSON.stringify(rule)));
    if (line == "clear") return clear();
    if (line == "more") failThatAnswer(previousRun);
    else {
      const parser = new Parser(Grammar.fromCompiled(grammar));
      const { results } = parser.feed(line);
      const interpretations: InputFile[] = results;
      if (interpretations.length) console.warn("WARNING: multiple interpretations");
      const inputfile: InputFile = interpretations[interpretations.length - 1];
      //console.log(inputfile.lines);
      rule = inputfile.lines.pop();
      //console.log(JSON.stringify(rule));
      if (!rule) return;
      printEcholine(JSON.stringify(rule));
    }
    const result = prolog(database, rule);
    //console.log(previousRun);
  } catch (e: any) {
    consoleOutError("ERROR: " + JSON.stringify(e as ErrorShape));
  }
});

export function prettyPrintVarBindings(scope: Scope): string {
  const vars = [];
  for (let v in scope) vars.push(v);
  // console.log(JSON.stringify(vars));
  if (vars.length == 0) return "Yes";
  return vars
    .map(varName => {
      const container = scope[varName][0];
      let val = container.literal ? container.literal.rvalue : container.tuple ? container.tuple : container.variable.bareword;
      if (container.literal?.rtype == "string") val = `"${val}"`;
      return `The ${varName} is ${val}.`;
    })
    .join("\n");
}
