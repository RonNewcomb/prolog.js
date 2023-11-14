import { Environment } from "./environment";
import { type Database } from "./interfaces";
import { Rule } from "./rule";
import { Tokeniser } from "./tokenizer";
import { Tuple, type TupleItem } from "./tupleItem";
import { consoleOutError, printAnswerline, printEcholine } from "./ui";

export const database: Database = [];

console.info("enter db() to show the database");
(window as any).db = () => database.forEach(rule => console.log(rule.print()));

let previousRun = beginLooking([], new Environment(), database);

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
    previousRun = beginLooking(rule.body!, new Environment(), database);
  }
  const result = previousRun.next();
  printAnswerline(result == NOMORE ? "No." : result.print());
}

export const NOMORE = Symbol("NOMORE");

interface FunctorIterator {
  current: TupleItem | typeof NOMORE;
  first: () => TupleItem | typeof NOMORE;
  next: () => TupleItem | typeof NOMORE;
  rest: () => TupleItem[];
  isDone: boolean;
}

export function beginLooking(areTheseTrue: Tuple[], scope: Environment, db: Database): FunctorIterator {
  const newIterator: FunctorIterator = {
    current: NOMORE,
    first: () => NOMORE,
    next: () => NOMORE,
    rest: () => [],
    isDone: true,
  };
  newIterator.next = () => {
    getAnswer(newIterator, areTheseTrue, scope, db, 0);
    return newIterator.current;
  };
  return newIterator;
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

  for (const rule of db) {
    if (rule.head == null) continue; // then a query got stuck in there; it shouldn't have.
    if (rule == first.dontSelfRecurse) continue; // prevent immediate self-recursion
    //const renamedHead = new Tuple(renameVariables(rule.head.items, level, first), undefined, rule.head.dontSelfRecurse); // Rename head's variables
    const nextEnvironment = scope.unify(first, rule.head); // try to unify the first of goals[] with this rule's head
    if (nextEnvironment == null) continue; // no unify? try next rule in the db

    // Unifies, so recurse with the rest of goals[] and the new environment
    // (if the rule has a body/query then (rename them for scope and) prepend them to goals[])
    const nextGoals: Tuple[] = ((rule.body || []) as Tuple[]).concat(rest);

    const hasFailed = getAnswer(iter, nextGoals, nextEnvironment, db, level + 1);
    if (hasFailed != null) return hasFailed;
    if (rule.head.commit) break; // this goal  thisTuple  has been committed
    if (first.parent.commit) break; // parent goal  thisTuple.parent  has been committed
  }
  return iter;
}
