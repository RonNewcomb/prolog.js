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

export let database: Database = [];
export const useDatabase = (db: Database) => (database = db);
let previousRun: GraphNode = { queryToProve: { tuple: [] }, database, dbIndex: -1, bindingsWithParent: [] };

export function prolog(database: Database, rule: Rule | Command): "memorized" | "yes" | "no" | Bindings {
  if (rule.command) {
    switch (rule.command.rvalue) {
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
  if (rule.head) {
    database.push(rule);
    return "memorized";
  }
  previousRun = rule.query ? <GraphNode>{ queryToProve: rule.query[0], database, dbIndex: -1 } : previousRun;
  const result = goer(previousRun);
  if (result == Direction.Failing) return "no";
  const topLevelBindings = (previousRun.bindingsWithParent || []).filter(([topLevel, _]) => topLevel.variable);
  return topLevelBindings.length > 0 ? topLevelBindings : "yes";
}

function failThatAnswer(current: GraphNode): void {
  if (current.querysToProve && current.querysToProve.length) failThatAnswer(current.querysToProve[current.querysToProve.length - 1]);
  else current.bindingsWithParent = undefined;
}

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

      // we found a rule that unified. If it had conditions, we will try those conditions
      current.querysToProve = nextrule?.query?.map(query => ({ parent: current, queryToProve: query, database: current.database, dbIndex: -1 })) || undefined;
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

function unify(bindings: Bindings | undefined, a: TupleItem, b: TupleItem): Bindings | undefined {
  if (!bindings) return undefined;
  const x = replaceBoundVarsWithLiterals(a, bindings);
  const y = replaceBoundVarsWithLiterals(b, bindings);
  // now check UN-bound vars
  if (x.variable || y.variable) {
    bindings.push([x, y]);
    return bindings;
  }
  if (x.literal || y.literal) return x.literal && y.literal && x.literal.rvalue == y.literal.rvalue ? bindings : undefined;
  if (x.tuple.length != y.tuple.length) return undefined;
  for (let i = 0; i < x.tuple.length; i++) bindings = unify(bindings, x.tuple[i], y.tuple[i]);
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
        ? container.variable.bareword
        : container.literal.rtype == "string"
        ? `"${container.literal.rvalue}"`
        : container.literal.rvalue;
      return `The ${varName} is ${val}.`;
    })
    .join("\n");
