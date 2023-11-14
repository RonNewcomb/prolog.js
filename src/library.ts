// A sample builtin function, including all the bits you need to get it to work within the general proving mechanism.
// General plan:
// Prove the builtin bit, then break out and prove the remaining goals.
// If we were intending to have a resumable builtin (one that can return multiple bindings) then we'd wrap all of this in a while() loop.
// var renamedHead = new Tuple(renameVariables(rule.head.items.list, level)); // Rename the variables in the head and body

import { answerQuestion, renameVariable, renameVariables } from "./engine";
import type { Environment } from "./environment";
import { Database, ReportFunction, FunctorResult, ops } from "./interfaces";
import { Tokeniser } from "./tokenizer";
import { Tuple, type TupleItem, Literal } from "./tupleItem";
import { printDebugline } from "./ui";

export function Commit(thisTuple: Tuple, goals: Tuple[], environment: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult {
  const ret = answerQuestion(goals, environment, db, level + 1, onReport); // On the way through, we do nothing... Just prove the rest of the goals, recursively.
  thisTuple.parent.commit = true; // Backtracking through the 'commit' stops any further attempts to prove this subgoal.
  return ret;
}

export function More(thisTuple: Tuple, goals: Tuple[], env: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult {
  return null; // TODO shouldn't this return True or something?
}

// [ask, X].  Given a single argument, it sticks it on the goal list.
export function Ask(thisTuple: Tuple, goals: Tuple[], env: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult {
  const first: TupleItem = env.value(thisTuple.items[1]);
  if (first.type != "Tuple") return printDebugline(null, "[Call] only accepts a Tuple.", first.name, "is a", first.type);
  first.parent = thisTuple;
  const newGoals = [first].concat(goals);
  return answerQuestion(newGoals, env, db, level + 1, onReport);
}

// [compare, First: string|number, Second: string|number, CmpValue: gt|eq|lt]
export function Comparitor(thisTuple: Tuple, goals: Tuple[], environment: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult {
  const first = environment.value(thisTuple.items[1]);
  if (first.type != "Literal") return printDebugline(null, "[Comparitor] only accepts literals.", first.name, "is a ", first.type);
  const second = environment.value(thisTuple.items[2]);
  if (second.type != "Literal") return printDebugline(null, "[Comparitor] only accepts literals.", second.name, "is a ", second.type);
  const cmp = first.name < second.name ? "lt" : first.name > second.name ? "gt" : "eq";
  const env2 = environment.unify(thisTuple.items[3], new Literal(cmp));
  if (env2 == null) return printDebugline("[Comparitor] cannot unify final noun with", cmp);
  return answerQuestion(goals, env2, db, level + 1, onReport);
}

type AnswerList = TupleItem[] & { renumber?: number };

// [bagof, Tuple, ConditionTuple, ReturnList]
export function BagOf(thisTuple: Tuple, goals: Tuple[], env: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult {
  let collect = env.value(thisTuple.items[1]);
  const subgoal = env.value(thisTuple.items[2]) as Tuple;
  const into = env.value(thisTuple.items[3]);
  collect = renameVariable(collect, level, thisTuple);
  const newGoals = [new Tuple(renameVariables(subgoal.items, level, thisTuple), thisTuple)];

  // Prove this subgoal, collecting up the environments...
  const answers = [] as AnswerList;
  answers.renumber = -1;
  answerQuestion(newGoals, env, db, level + 1, BagOfCollectFunction(collect, answers));

  // Turn anslist into a proper list and unify with 'into' // optional here: nothing anslist -> fail?
  let cons: TupleItem = new Literal(ops.nothing);
  for (let i = answers.length; i > 0; i--) cons = new Tuple([new Literal(ops.cons), answers[i - 1], cons]);

  const env2 = env.unify(into, cons);
  if (env2 == null) return printDebugline(null, "[bagof] cannot unify final noun with", into.print());
  return answerQuestion(goals, env2, db, level + 1, onReport);
}

// Aux function: return the onReport to use with a bagof subgoal
function BagOfCollectFunction(collecting: TupleItem, anslist: AnswerList): ReportFunction {
  return function (env: Environment) {
    // Rename this appropriately and throw it into anslist
    anslist[anslist.length] = renameVariable(env.value(collecting), anslist.renumber!--) as TupleItem;
  };
}

// [external, "console.log($1, $2)", {X,Y}, Result].   // Calls out to external javascript
// arg1: a template string that uses $1, $2, etc. as placeholders
// arg2: a list of values  // a cons linked-list
// arg3: return value from javascript, if any
export function ExternalJS(term: Tuple, goals: Tuple[], env: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult {
  // Get the first tuple, the template.
  const template = env.value(term.items[1]);
  const regresult = template.name.match(/^"(.*)"$/);
  if (template.type != "Literal" || !regresult) return printDebugline(null, 'First noun of [External] must be a string in "double quotes" not', template.name);

  let jsCommand = regresult[1];

  // Get the second tuple, the argument list.
  let currentLinkedListNode: TupleItem = env.value(term.items[2]) as Tuple;
  let i = 1;
  while (currentLinkedListNode.name == ops.cons && currentLinkedListNode.type == "Tuple") {
    const arg = env.value(currentLinkedListNode.items[1]);
    if (arg.type != "Literal") return printDebugline(null, "Second noun of [External] must contain all literals. #" + i, "is a", arg.print());
    const re = new RegExp("\\$" + i, "g"); // replace $1, $2, etc with values of passed-in params
    jsCommand = jsCommand.replace(re, arg.name);
    currentLinkedListNode = currentLinkedListNode.items[2];
    i++;
  }
  if (currentLinkedListNode.type != "Literal" || currentLinkedListNode.name != ops.nothing)
    return printDebugline(null, "Second noun of [External] must be a {...} list, not", currentLinkedListNode.print());

  let jsReturnValue: string = Function(jsCommand)();
  //with ([]) jsReturnValue = eval(jsCommand);
  if (!jsReturnValue) jsReturnValue = ops.nothing;

  // Convert back into an literal or tupleitem...
  const part = Tuple.parseItem(new Tokeniser((jsReturnValue ?? "").toString()));
  const env2 = env.unify(term.items[3], part!);
  if (env2 == null) return printDebugline(null, "[External] cannot unify return value with", jsReturnValue);
  return answerQuestion(goals, env2, db, level + 1, onReport);
}
