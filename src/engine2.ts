import { printAnswerline, printEcholine } from "./ui";

interface Literal {
  literal: {
    bareword?: string;
    str?: string;
    num?: number;
    boo?: boolean;
  };
  variable?: never; // for typechecking
  tuple?: never; // for typechecking
}
interface Variable {
  variable: {
    bareword: string;
  };
  literal?: never; // for typechecking
  tuple?: never; // for typechecking
}
type TupleItem = Literal | Variable | Tuple;
interface Tuple {
  tuple: TupleItem[];
  variable?: never; // for typechecking
  literal?: never; // for typechecking
}
interface Rule {
  head: Tuple;
  query: Tuple[];
}
interface InputFile {
  lines: Rule[];
}

const sample2: InputFile = {
  lines: [
    {
      head: {
        tuple: [
          { literal: { bareword: "drive" } },
          { literal: { str: "bob" } },
          {
            tuple: [{ literal: { bareword: "downtown" } }],
          },
          { variable: { bareword: "car" } },
        ],
      },
      query: [],
    },
  ],
};

type Scope = Record<string, [TupleItem]>;
type Database = Rule[];

const database: Database = [];

console.info("enter listing() to show the database");
(window as any).listing = () => database.forEach(rule => console.log(JSON.stringify(rule)));

interface GraphNode {
  //parent?: GraphNode;
  queryToProve: Tuple;
  database: Database;
  dbIndex: number; // backtracking increases this number; unification with head stops increasing it
  //rule: Rule; // === database[dbIndex]
  //headThatUnifies: Rule["rule"]["head"];
  vars?: Scope; // the extra [] wrapper is to have pointers to the value
  //queryIndex: number; // rule.body[queryIndex] // backtracking decreases this number; unification increases it
  querysToProve?: GraphNode[];
}

const enum Direction {
  Failing, // backtracking
  Succeeded,
}

/*
for every goal, 
  find [the next] rule in the database which unifies with its head 
  for each of the rule body's subgoals, <recurse>
  if no rule head in the database unifies with it, or no rule with a body fully unifies, backtrack & try the next, 
*/

let previousRun: GraphNode = { queryToProve: { tuple: [] }, database, dbIndex: -1 };

export function ask(database: Database, querysToProve?: Tuple[]): boolean {
  previousRun = querysToProve
    ? <GraphNode>{
        queryToProve: { tuple: [] },
        database,
        dbIndex: -1,
        vars: {},
        querysToProve: querysToProve.map(query => ({ queryToProve: query, database, dbIndex: -1 })),
      }
    : previousRun;
  return goer(previousRun) === Direction.Succeeded;
}

function goer(current: GraphNode): Direction {
  // on a backtrack, start over
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
        current.vars = unify(current.vars, current.queryToProve, nextrule.head!);
      }

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
      continue on_backtracking;
    }
  } while (false);

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

function newScope(oldScope: Scope | null, varName: string, tupleItem: TupleItem): Scope {
  const newScope = Object.create(oldScope);
  newScope[varName] = tupleItem;
  return newScope;
}

function newTuple(items: TupleItem[]): Tuple {
  return { tuple: items };
}

function valueOf(item: TupleItem, scope: Scope): TupleItem {
  if (item.literal) return item;
  if (item.tuple) return newTuple(item.tuple.map(it => valueOf(it, scope)));
  const isBoundVar = scope[item.variable.bareword];
  return isBoundVar ? isBoundVar[0] : item;
}

function unify(scope: Scope | undefined, a: TupleItem, b: TupleItem): Scope | undefined {
  if (scope == null) return undefined;
  const x = valueOf(a, scope);
  const y = valueOf(b, scope);
  if (x.variable) return newScope(scope, x.variable.bareword, y);
  if (y.variable) return newScope(scope, y.variable.bareword, x);
  if (x.literal || y.literal) return x.literal == y.literal ? scope : undefined;
  if (x.tuple.length != y.tuple.length) return undefined;
  for (let i = 0; i < x.tuple.length; i++) scope = unify(scope, x.tuple[i], y.tuple[i]);
  return scope;
}

export function processLine(rule: Rule): void {
  let result = false;
  if (rule.head.tuple[0].literal?.bareword != "more") {
    if (rule == null) return;
    printEcholine(JSON.stringify(rule));
    if (rule.head) {
      database.push(rule);
      printAnswerline("Memorized.\n");
      return;
    }
    result = ask(database, rule.query);
  } else result = ask(database);
  printAnswerline(!result ? "No." : JSON.stringify(previousRun.vars));
}
