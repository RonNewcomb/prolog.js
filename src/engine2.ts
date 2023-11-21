import { printAnswerline, printEcholine } from "./ui";

type Database = Rule[];

export const NOMORE = Symbol("NOMORE");
export const database: Database = [];

console.info("enter listing() to show the database");
(window as any).listing = () => database.forEach(rule => console.log(JSON.stringify(rule)));

// class FunctorIterator {
//   current: TupleItem | typeof NOMORE = NOMORE;
//   i = 0;
//   isDone = false;
//   subIter: FunctorIterator | undefined;

//   constructor(private areTheseTrue: Tuple[], private scope: Environment, private db: Database) {
//     this.first();
//   }

//   first(): FunctorIterator {
//     this.i = 0;
//     this.isDone = false;
//     this.next();
//     return this;
//   }

//   next(): FunctorIterator {
//     if (this.areTheseTrue.length == 0 || this.isDone) {
//       this.isDone = true;
//       this.current = NOMORE;
//       return this;
//     }

//     const first = this.areTheseTrue[0];
//     const rest = this.areTheseTrue.slice(1);

//     for (; this.db.length > this.i; this.i++) {
//       const rule = this.db[this.i];

//       const nextEnvironment = this.scope.unify(first, rule.head); // try to unify the first of goals[] with this rule's head
//       if (nextEnvironment == null) continue; // no unify? try next rule in the db

//       const nextGoals = rule.body ? rule.body.concat(rest) : rest;

//       if (!this.subIter) this.subIter = new FunctorIterator(nextGoals, nextEnvironment, this.db);
//       if (this.subIter.isDone) {
//         this.subIter = undefined;
//         continue;
//       }
//       return this.subIter;
//     }

//     this.isDone = true;
//     this.current = NOMORE;
//     return this;
//   }

//   rest(): TupleItem[] {
//     const vals = [];
//     while (!this.isDone) {
//       const val = this.next();
//       if (val.current != NOMORE) vals.push(val.current);
//     }
//     return vals;
//   }
// }

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

/*
for every goal, 
  find [the next] rule in the database which unifies with its head 
  for each of the rule body's subgoals, <recurse>
  if no rule head in the database unifies with it, or no rule with a body fully unifies, backtrack & try the next, 
*/

const enum Direction {
  Failing, // backtracking
  Succeeded,
}

export function goer(current: GraphNode): Direction {
  //if (current.dbIndex == undefined) current.dbIndex = -1;
  //let state: Direction = Direction.Succeeded;

  on_backtracking: do {
    // find a rule in database that unifies with current .queryToProve (unification sets .vars)
    if (!current.vars) {
      let nextrule: Rule | undefined;
      while (!current.vars) {
        // get next rule to try
        current.dbIndex++;
        nextrule = current.database[current.dbIndex];

        // if we ran out of rules to try, return failure.
        if (!nextrule) return Direction.Failing;

        // does it unify?
        current.vars = unify(current.vars, { tupleitem: current.queryToProve }, { tupleitem: nextrule.rule.head! });
      }

      // found a rule that unified. If it had conditions, we will try those conditions
      if (nextrule?.rule.body)
        current.querysToProve = nextrule.rule.body.map<GraphNode>(t => ({
          queryToProve: t,
          database: current.database,
          dbIndex: -1,
        }));
    }

    // check children recursively, regardless whether this is a replay or they're fresh
    if (current.querysToProve)
      for (let query of current.querysToProve) {
        // child returns success or failure.
        const state = goer(query);
        if (state == Direction.Succeeded) continue;

        // if child didn't succeed, then nextrule doesn't succeed. Reset and restart with a new db rule
        current.vars = undefined;
        current.querysToProve = [];
        continue on_backtracking;
      }
  } while (false);

  return Direction.Succeeded; // all children succeeded, so, I do too.
}

// export function go(root: GraphNode): GraphNode {
//   let state: "go" | "backtracking" = "go";
//   const location: number[] = []; // from the end of this array, from root, choose the nth child
//   const current = location.reduceRight((sum, each) => sum.querysToProve[each], root);

//   while (true) {
//     if (current.dbIndex == undefined) current.dbIndex = -1;

//     // ?
//     if (state == "backtracking") current.vars = null;

//     if (!current.vars) {
//       let nextrule: Rule | undefined = undefined;
//       while (!current.vars) {
//         current.dbIndex++;
//         nextrule = current.database[current.dbIndex];
//         if (!nextrule) return (state = "backtracking");
//         current.vars = unify(current.vars, { tupleitem: current.queryToProve }, { tupleitem: nextrule.rule.head! });
//       }

//       const query = nextrule?.rule.body || [];
//       if (query.length) {
//         //current.queryIndex = 0;
//         current.querysToProve = query.map(
//           bodytuple =>
//             ({
//               parent: current,
//               queryToProve: bodytuple,
//               database: current.database,
//               dbIndex: 0,
//             } as GraphNode)
//         );
//         location.push(0);
//       } else {
//         location[0]++;
//         if (location[0] >= (current.parent?.querysToProve.length ?? 0)) location.shift();
//       }
//     }
//   }
//   return root;
// }

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

interface Literal {
  literal: {
    bareword?: string;
    str?: string;
    num?: number;
    boo?: boolean;
  };
  variable?: undefined; // for typechecking
  tuple?: undefined; // for typechecking
}
interface Variable {
  variable: {
    bareword: string;
  };
  literal?: undefined; // for typechecking
  tuple?: undefined; // for typechecking
}
interface TupleItem {
  tupleitem: Literal | Variable | Tuple;
}
interface Tuple {
  tuple: TupleItem[];
  variable?: undefined; // for typechecking
  literal?: undefined; // for typechecking
}
interface Rule {
  rule: {
    head: Tuple;
    body: Tuple[];
  };
}

interface InputFile {
  lines: Rule[];
}

const sample: InputFile = {
  lines: [
    {
      rule: {
        head: {
          tuple: [
            { tupleitem: { literal: { bareword: "drive" } } },
            { tupleitem: { literal: { str: "bob" } } },
            {
              tupleitem: {
                tuple: [
                  {
                    tupleitem: { literal: { bareword: "downtown" } },
                  },
                ],
              },
            },
            { tupleitem: { variable: { bareword: "car" } } },
          ],
        },
        body: [],
      },
    },
  ],
};

type Scope = Record<string, [TupleItem]>;

function newScope(oldScope: Scope | null, varName: string, tupleItem: TupleItem): Scope {
  const newScope = Object.create(oldScope);
  newScope[varName] = tupleItem;
  return newScope;
}

function newTuple(items: TupleItem[]): Tuple {
  return { tuple: items };
}

function valueOf(tupleitem: TupleItem, scope: Scope): TupleItem {
  const item = tupleitem.tupleitem;
  if (item.literal) return tupleitem;
  if (item.tuple)
    return {
      tupleitem: newTuple(item.tuple.map(it => valueOf(it, scope))),
    };
  // else item.variable  // else item.bound
  const isBoundVar = scope[item.variable.bareword];
  return isBoundVar ? isBoundVar[0] : tupleitem;
}

function unify(scope: Scope | undefined, a: TupleItem, b: TupleItem): Scope | undefined {
  if (scope == null) return undefined;
  const x = valueOf(a, scope).tupleitem;
  const y = valueOf(b, scope).tupleitem;
  if (x.variable) return newScope(scope, x.variable.bareword, { tupleitem: y });
  if (y.variable) return newScope(scope, y.variable.bareword, { tupleitem: x });
  if (x.literal || y.literal) return x.literal == y.literal ? scope : undefined;
  if (x.tuple.length != y.tuple.length) return undefined;
  for (let i = 0; i < x.tuple.length; i++) scope = unify(scope, x.tuple[i], y.tuple[i]);
  return scope;
}

let previousRun = new FunctorIterator([], {}, database);

export function processLine(rule: Rule): void {
  if (rule.rule.head.tuple[0].tupleitem.literal?.bareword != "more") {
    if (rule == null) return;
    printEcholine(JSON.stringify(rule));
    if (!rule.rule.body || rule.rule.body.length == 0) {
      database.push(rule);
      printAnswerline("Memorized.\n");
      return;
    }
    previousRun = new FunctorIterator(rule.rule.body || [], {}, database);
  }
  const result = previousRun.next();
  printAnswerline(result.current == NOMORE ? "No." : result.current.print());
}
