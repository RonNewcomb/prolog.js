import { Environment } from "./environment";
import { type Database } from "./interfaces";
import { Rule } from "./rule";
import { Tokeniser } from "./tokenizer";
import { Tuple, type TupleItem } from "./tupleItem";
import { consoleOutError, printAnswerline, printEcholine } from "./ui";

export const NOMORE = Symbol("NOMORE");
export const database: Database = [];

console.info("enter db() to show the database");
(window as any).db = () => database.forEach(rule => console.log(rule.print()));

class FunctorIterator {
  current: TupleItem | typeof NOMORE = NOMORE;
  i = 0;
  isDone = false;
  subIter: FunctorIterator | undefined;

  constructor(private areTheseTrue: Tuple[], private scope: Environment, private db: Database) {
    this.first();
  }

  first(): FunctorIterator {
    this.i = 0;
    this.isDone = false;
    this.next();
    return this;
  }

  next(): FunctorIterator {
    if (this.areTheseTrue.length == 0 || this.isDone) {
      this.isDone = true;
      this.current = NOMORE;
      return this;
    }

    const first = this.areTheseTrue[0];
    const rest = this.areTheseTrue.slice(1);

    for (; this.db.length > this.i; this.i++) {
      const rule = this.db[this.i];

      const nextEnvironment = this.scope.unify(first, rule.head); // try to unify the first of goals[] with this rule's head
      if (nextEnvironment == null) continue; // no unify? try next rule in the db

      const nextGoals = rule.body ? rule.body.concat(rest) : rest;

      if (!this.subIter) this.subIter = new FunctorIterator(nextGoals, nextEnvironment, this.db);
      if (this.subIter.isDone) {
        this.subIter = undefined;
        continue;
      }
      return this.subIter;
    }

    this.isDone = true;
    this.current = NOMORE;
    return this;
  }

  rest(): TupleItem[] {
    const vals = [];
    while (!this.isDone) {
      const val = this.next();
      if (val.current != NOMORE) vals.push(val.current);
    }
    return vals;
  }
}

interface GraphNode {
  queryToProve: Tuple;
  database: Database;
  dbIndex: number; // backtracking increases this number; unification with head stops increasing it
  rule: Rule; // === database[dbIndex]
  headThatUnifies: Rule["head"];
  vars: Scope | null; // the extra [] wrapper is to have pointers to the value
  queryIndex: number; // rule.body[queryIndex] // backtracking decreases this number; unification increases it
  querysToProve: GraphNode[];
}

/*
for every goal, 
  find [the next] rule in the database which unifies with its head 
  for each of the rule body's subgoals, <recurse>
  if no rule head in the database unifies with it, or no rule with a body fully unifies, backtrack & try the next, 
*/

function go(root: GraphNode): GraphNode {
  let current = root;
  let state: "go" | "backtracking" = "go";

  while (true) {
    if (current.dbIndex == undefined) current.dbIndex = -1;

    // ?
    if (state == "backtracking") current.vars = null;

    while (!current.vars) {
      current.dbIndex++;
      const nextrule = current.database[current.dbIndex];
      if (!nextrule) return (state = "backtracking");
      if (nextrule != current.rule) current.vars = null;
      current.rule = nextrule;
      current.vars = unify(current.vars, current.queryToProve, current.rule.head!);
    }
    // unnecessary?
    current.headThatUnifies = current.rule.head!;

    // ?
    if (!current.rule.body) break;

    if (current.queryIndex == undefined) {
      current.queryIndex = 0;
      current.querysToProve = (current.rule.body || []).map<GraphNode>(bodytuple => ({
        queryToProve: bodytuple,
        database: current.database,
        dbIndex: 0,
      }));
    }

    // do something with .querysToProve
    current = current.querysToProve[current.queryIndex];
  }
  return root;
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

type Scope = Record<string, [TupleItem]>;

function newScope(oldScope: Scope | null, varName: string, tupleItem: TupleItem): Scope {
  const newScope = Object.create(oldScope);
  newScope[varName] = tupleItem;
  return newScope;
}

function valueOf(item: TupleItem, scope: Scope): TupleItem {
  if (item.literal) return item;
  if (item.tupleitems) return new Tuple(item.tupleitems.map(i => valueOf(i, scope)));
  // else item.variable
  if (item.unbound) return item;
  // else item.bound
  return scope[item.variable][0];
}

function unify(scope: Scope | null, a: TupleItem, b: TupleItem): Scope | null {
  if (scope == null) return null;
  const x = valueOf(a, scope);
  const y = valueOf(b, scope);
  if (x.variable) return newScope(scope, x.variable, y);
  if (y.variable) return newScope(scope, y.variable, x);
  if (x.literal || y.literal) return x.literal == y.literal ? scope : null;
  if (x.tupleitems.length != y.tupleitems.length) return null;
  for (let i = 0; i < x.tupleitems.length; i++) scope = unify(scope, x.tupleitems[i], y.tupleitems[i]);
  return scope;
}

export function getAnswer(iter: FunctorIterator, areTheseTrue: Tuple[], scope: Environment, db: Database, level: number): FunctorIterator {
  if (level > 99) {
    consoleOutError(null, "maximum recursion depth of 99 exceeded");
    iter.isDone = true;
    iter.current = NOMORE;
    return iter;
  }

  if (areTheseTrue.length == 0) {
    iter.isDone = true;
    iter.current = NOMORE;
    return iter;
  }

  const first = areTheseTrue[0];
  const rest = areTheseTrue.slice(1);

  while (db.length > iter.i) {
    const rule = db[iter.i];
    iter.i++;

    const nextEnvironment = scope.unify(first, rule.head); // try to unify the first of goals[] with this rule's head
    if (nextEnvironment == null) continue; // no unify? try next rule in the db

    const nextGoals = (rule.body || []).concat(rest);
    const updatedIter = getAnswer(iter, nextGoals, nextEnvironment, db, level + 1);
  }
  return iter;
}

let previousRun = new FunctorIterator([], new Environment(), database);

export function processLine(line: string): void {
  if (line != "more") {
    const rule = Rule.parse(new Tokeniser(line));
    if (rule == null) return;
    printEcholine(rule.print());
    if (!rule.asking) {
      database.push(rule);
      printAnswerline("Memorized.\n");
      return;
    }
    previousRun = new FunctorIterator(rule.body || [], new Environment(), database);
  }
  const result = previousRun.next();
  printAnswerline(result.current == NOMORE ? "No." : result.current.print());
}
