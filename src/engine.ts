import { clear, consoleOutError, printAnswerline, printEcholine, onNextLine } from "./ui";
import { Parser, Grammar } from "nearley";
import "../../tmp/projama.js"; // found from /tmp/src2/engine2.js

const grammar = Grammar.fromCompiled((window as any).grammar); // created by iife in projama.js

export interface Command {
  command: {
    rvalue: string | number | boolean;
    rtype: "bareword" | "string" | "number" | "boolean";
    bareword?: string;
  };
  head?: never; // for typechecking
  query?: never; // for typechecking
}
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
  command?: never; // for typechecking
}
export type Statement = Rule | Command;
export interface InputFile {
  statements: Statement[];
}

//export type Scope = Record<string, [TupleItem]>; // the extra [] wrapper is to have pointers to the value
export type Binding = [TupleItem, TupleItem];
export type Bindings = Binding[];
export type Database = Rule[];

interface GraphNode {
  parent?: GraphNode;
  queryToProve: Tuple;
  database: Database;
  dbIndex: number; // backtracking increases this number; unification with head stops increasing it
  bindingsWithParent?: Bindings;
  //queryIndex: number; // rule.body[queryIndex] // backtracking decreases this number; unification increases it
  querysToProve?: GraphNode[];
}

const enum Direction {
  Failing, // backtracking
  Succeeded,
}

export function prettyPrintTupleItem(t?: TupleItem): string {
  if (!t) return "undefined";
  if (t.literal) return t.literal.rvalue.toString();
  if (t.tuple) return `[${t.tuple.map(prettyPrintTupleItem).join(", ")}]`;
  if (t.variable) `var ${t.variable.bareword}`;
  return JSON.stringify(t);
}

export let database: Database = [];
export const useDatabase = (db: Database) => (database = db);
let previousRun: GraphNode = { queryToProve: { tuple: [] }, database, dbIndex: -1, bindingsWithParent: [] };

function failThatAnswer(current: GraphNode): void {
  while (current.querysToProve && current.querysToProve.length) current = current.querysToProve[current.querysToProve.length - 1];
  current.bindingsWithParent = undefined;
}

export function prolog(database: Database, statement: Statement): "memorized" | "yes" | "no" | Bindings {
  if (statement.command) {
    switch (statement.command.rvalue) {
      case "more":
        failThatAnswer(previousRun);
        break;
      case "listing":
        database.forEach(rule => printAnswerline(JSON.stringify(rule)));
        return "yes";
      case "clear":
        clear();
        return "yes";
      default:
        return "no";
    }
  }
  if (statement.head) {
    // then fact or rule
    database.push(statement);
    return "memorized";
  } // else query
  previousRun = statement.query ? <GraphNode>{ queryToProve: statement.query[0], database, dbIndex: -1 } : previousRun;
  const result = goer(previousRun);
  if (result == Direction.Failing) return "no";
  prettyPrintBindings(previousRun);
  const topLevelBindings = (previousRun.bindingsWithParent || []).filter(([topLevel, _]) => topLevel.variable);
  return topLevelBindings.length > 0 ? topLevelBindings : "yes";
}

function prettyPrintBindings(current: GraphNode, indent: string = "") {
  if (current.bindingsWithParent) console.log(indent + prettyPrintVarBindings(current.bindingsWithParent));
  if (current.querysToProve) current.querysToProve.forEach(q => prettyPrintBindings(q, indent + "    "));
}

function goer(current: GraphNode): Direction {
  // on a backtrack, start over // javascript's weird way of doing a GOTO
  on_backtracking: do {
    // find a rule in database that unifies with current .queryToProve (unification sets .vars)
    if (!current.bindingsWithParent) {
      // find a rule in the db that unifies with our current.queryToProve
      let nextrule: Rule | undefined;
      while (!current.bindingsWithParent) {
        // get next rule to try
        current.dbIndex++;
        nextrule = current.database[current.dbIndex];

        // if we ran out of rules to try, return failure.
        if (!nextrule) {
          current.querysToProve = undefined; // clean prior results just in case
          return Direction.Failing;
        }

        // does it unify?
        current.bindingsWithParent = unify(current.bindingsWithParent || [], current.queryToProve, nextrule.head!);
      }
      console.log(`[UNIFIED: ${prettyPrintTupleItem(current.queryToProve)} with ${prettyPrintTupleItem(nextrule!.head)}]`);

      // we found a rule that unified. If it had conditions, we will try those conditions
      current.querysToProve = nextrule?.query?.map(query => ({ parent: current, queryToProve: query, database: current.database, dbIndex: -1 })) || undefined;
      if (nextrule?.query?.length) console.log(`[NOW TRY ${nextrule.query.map(prettyPrintTupleItem)}]`);
    }

    // check children recursively, regardless whether this is a replay or they're fresh
    if (current.querysToProve)
      for (const query of current.querysToProve) {
        // child returns success or failure.
        const state = goer(query);
        if (state == Direction.Succeeded) continue;

        // if child didn't succeed, then nextrule doesn't succeed. Reset and restart with a new db rule
        current.bindingsWithParent = undefined;
        continue on_backtracking; // javascript's weird way of doing a GOTO
      }
  } while (false); // javascript's weird way of doing a GOTO

  return Direction.Succeeded; // all children succeeded, so, I do too.
}

function replaceBoundVarsWithLiterals(item: TupleItem, bindings: Bindings): TupleItem {
  // value of a literal is itself
  if (item.literal) return item;
  // value of a tuple is a tuple of the values of each item in the tuple
  if (item.tuple) return { tuple: item.tuple.map(it => replaceBoundVarsWithLiterals(it, bindings)) };
  // value of a bound var is the literal or tuple its bound to
  const isBoundVar = bindings.find(b => b[0].variable && b[0].variable.bareword == item.variable.bareword);
  // value of an unbound var is itself
  return isBoundVar ? isBoundVar[1] : item;
}

function unify(bindings: Bindings, a: TupleItem, b: TupleItem): Bindings | undefined {
  const x = replaceBoundVarsWithLiterals(a, bindings);
  const y = replaceBoundVarsWithLiterals(b, bindings);
  // now check un-bound vars
  if (x.variable || y.variable) {
    console.log(`[Bound ${JSON.stringify(x)} to ${JSON.stringify(y)}]`);
    bindings.push([x, y]);
    return bindings;
  }
  if (x.literal || y.literal) return x.literal && y.literal && x.literal.rvalue == y.literal.rvalue ? bindings : undefined;
  if (x.tuple.length != y.tuple.length) return undefined;
  for (let i = 0; i < x.tuple.length; i++) {
    bindings = unify(bindings, x.tuple[i], y.tuple[i])!;
    if (bindings) continue;
    console.log(`[UN-UNIFY ${JSON.stringify(x.tuple[i])} doesn't unify with ${JSON.stringify(y.tuple[i])}]`);
    return undefined;
  }
  return bindings;
}

interface ErrorShape {
  offset: number;
  token: { value: string };
}

onNextLine(line => {
  try {
    const parser = new Parser(grammar).feed(line);
    const interpretations: InputFile[] = parser.results;
    if (interpretations.length == 0) throw "Cannot interpret.";
    if (interpretations.length > 1) console.warn("WARNING: multiple interpretations");
    const statement = interpretations[0].statements.pop();
    if (!statement) return;
    printEcholine(JSON.stringify(statement));
    const result = prolog(database, statement);
    printAnswerline(typeof result === "string" ? result[0].toUpperCase() + result.slice(1) + "." : prettyPrintVarBindings(result));
    return result;
  } catch (e: any) {
    const msg = "ERROR: " + JSON.stringify(e as ErrorShape);
    consoleOutError(msg);
    console.error(line, msg);
    return;
  }
});

export const prettyPrintVarBindings = (bindings: Bindings): string =>
  bindings
    .map<[string, TupleItem]>(([a, b]) => (a.variable ? [a.variable?.bareword || "", b] : [b.variable?.bareword || "", a]))
    .sort((a, b) => (a[0] < b[0] ? -1 : +1))
    .map(([varName, container]) => {
      const val = container.tuple
        ? container.tuple
        : container.variable
        ? `the ${container.variable.bareword}`
        : container.literal.rtype == "string"
        ? `"${container.literal.rvalue}"`
        : container.literal.rvalue;
      return `The ${varName} is ${val}.`;
    })
    .join("\n");
