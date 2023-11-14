import { Environment } from "./environment";
import { type Database, type ReportFunction, type FunctorResult, ops } from "./interfaces";
import { builtin } from "./library";
import { Rule } from "./rule";
import { Tokeniser } from "./tokenizer";
import { Tuple, type TupleItem, Variable } from "./tupleItem";
import { consoleOutError, printAnswerline, printEcholine } from "./ui";

export const database: Database = [];

console.info("enter db() to show the database");
(window as any).db = () => database.forEach(rule => console.log(rule.print()));

export function processLine(line: string): Database {
  const rule = Rule.parse(new Tokeniser(line));
  if (rule == null) return database;
  printEcholine(rule.print());
  if (rule.asking) {
    let reported = false;
    const reportFn = (env: Environment) => {
      reported = true;
      env.printBindings(rule.body!);
    };
    //console.log("Asking", line);
    answerQuestion(renameVariables(rule.body!, 0) as Tuple[], new Environment(), database, 1, reportFn);
    if (!reported) printAnswerline("No.\n");
  } else {
    database.push(rule);
    printAnswerline("Memorized.\n");
  }
  return database;
}

// Go through a tuple's terms renaming variables by appending 'level' to each variable name.
// "parent" points to the subgoal, the expansion of which led to these tuples.
export const renameVariables = (items: TupleItem[] | null | undefined, level: number, parent?: Tuple): TupleItem[] =>
  !items ? [] : items.map(item => renameVariable(item, level, parent));

export function renameVariable(rvalue: TupleItem, level: number, parent?: Tuple): TupleItem {
  switch (rvalue.type) {
    case "Literal":
      return rvalue;
    case "Variable":
      return new Variable(rvalue.name + "." + level);
    case "Tuple":
      return new Tuple(renameVariables(rvalue.items, level, parent), parent, rvalue.dontSelfRecurse);
  }
}

// The meat of this thing... js-tinyProlog.
// The main proving engine. Returns: null (keep going), other (drop out)
// Prove the first tuple in the goals. We do this by trying to unify that tuple with the rules in our database. For each
// matching rule, replace the tuple with the body of the matching rule, with appropriate substitutions.
// Then prove the new goals recursively.
export function answerQuestion(goals: Tuple[], env: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult {
  //console.log(level, goals, env.contents);

  if (level > 99) return consoleOutError(null, "maximum recursion depth of 99 exceeded") || true;

  if (goals.length == 0) {
    onReport(env);
    //if (!more) return true;
    return null;
  }

  const first = goals[0];
  const rest = goals.slice(1);

  // Do we have a builtin?
  const builtinfn = builtin[first.name + "/" + (first.items.length - 1)];
  if (builtinfn) return builtinfn(first, rest, env, db, level + 1, onReport);

  for (const rule of db) {
    if (rule.head == null) continue; // then a query got stuck in there; it shouldn't have.
    if (rule == first.dontSelfRecurse) continue; // prevent immediate self-recursion
    const renamedHead = new Tuple(renameVariables(rule.head.items, level, first), undefined, rule.head.dontSelfRecurse); // Rename head's variables
    const nextEnvironment = env.unify(first, renamedHead); // try to unify the first of goals[] with this rule's head
    if (nextEnvironment == null) continue; // no unify? try next rule in the db

    // Unifies, so recurse with the rest of goals[] and the new environment
    // (if the rule has a body/query then (rename them for scope and) prepend them to goals[])
    const nextGoals = !rule.body ? rest : (renameVariables(rule.body, level, renamedHead) as Tuple[]).concat(rest);

    const hasFailed = answerQuestion(nextGoals, nextEnvironment, db, level + 1, onReport);
    if (hasFailed != null) return hasFailed;
    if (renamedHead.commit) break; // this goal  thisTuple  has been committed
    if (first.parent.commit) break; // parent goal  thisTuple.parent  has been committed
  }
  return null;
}
