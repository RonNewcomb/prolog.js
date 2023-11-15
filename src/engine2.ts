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
