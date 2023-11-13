import type { Environment } from "./environment";
import type { Rule } from "./rule";
import type { Tuple } from "./tupleItem";

export type Database = Rule[] & { builtin?: { [key: string]: Functor } };
export type FunctorResult = null | boolean;
export interface ReportFunction {
  (env: Environment): void;
}
export interface Functor {
  (thisTuple: Tuple, goals: Tuple[], env: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult;
}

// these aren't used in the regexes in  class Tokeniser !!
export const enum ops {
  open = "[",
  close = "]",
  openList = "{",
  closeList = "}",
  sliceList = "|",
  endSentence = ".",
  endQuestion = "?",
  impliedQuestionVar = "?",
  if = "if",
  comment = "#",
  bodyTupleSeparator = ",",
  paramSeparator = ",",
  cutCommit = "commit",
  failRollbackMoreAgain = "get_more",
  nothing = "nothing",
  anything = "anything",
  dontSelfRecurse = "dontSelfRecurse:",
  cons = "cons",
}
