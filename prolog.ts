//declare global {
interface Document {
  input: HTMLFormElement;
  rules: HTMLFormElement;
  output: HTMLFormElement;
}
//}

// types ///////////////

type Database = Rule[] & { builtin?: { [key: string]: Functor } };
type FunctorResult = null | boolean;
interface ReportFunction {
  (env: Environment): void;
}
interface Functor {
  (thisTuple: Tuple, goals: Tuple[], env: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult;
}

const database: Database = [] as Database;

// these aren't used in the regexes in  class Tokeniser !!
const enum ops {
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
  failRollback = "rollback",
  nothing = "nothing",
  anything = "anything",
  notThis = "NOTTHIS",
  cons = "cons",
}

// web browser IDE things /////

const commandLineEl: HTMLInputElement = document.getElementById("commandline")! as HTMLInputElement;
const consoleOutEl: HTMLDivElement = document.getElementById("consoleout")! as HTMLDivElement;

function newConsoleLine(): HTMLDivElement {
  var elemDiv = document.createElement("div");
  elemDiv.innerHTML = "&nbsp;";
  consoleOutEl.appendChild(elemDiv);
  if (commandLineEl) commandLineEl.scrollIntoView();
  return elemDiv;
}

function printUserline(str: string) {
  const div = newConsoleLine();
  div.classList.add("userdiv");
  div.innerHTML = "<span>" + str + "</span>";
}

function printEcholine(str: string) {
  if (!document.input.showparse.checked) return;
  const div = newConsoleLine();
  div.classList.add("echodiv");
  div.innerHTML = "<span>" + str + "</span>";
}

function printDebugline(str: string) {
  const div = newConsoleLine();
  div.classList.add("debugdiv");
  div.innerHTML = "<div>" + str.replaceAll("\n", "</div><div>") + "</div>";
}

function printAnswerline(str: string) {
  const div = newConsoleLine();
  div.classList.add("answerdiv");
  div.innerHTML = "<div><div>" + str.replaceAll("\n", "</div><div>") + "</div></div>";
}

function consoleOutError(tk: Tokeniser, ...rest: any[]): null {
  const div = newConsoleLine();
  div.classList.add("errdiv");
  div.innerHTML = "<div><div><span class=err>" + rest.join(" ") + "</span></div><div>" + tk.current + tk.remainder + "</div></div>";
  newConsoleLine();
  return null;
}

let previousInput = "";

function onCommandlineKey(event: any, el: HTMLInputElement) {
  switch (event.key) {
    case "ArrowUp":
      el.value = previousInput;
      return;
    case "Enter":
      nextline(event.target.value);
      el.value = "";
      el.scrollIntoView();
      return;
  }
}

// called from HTML on startup
function init() {
  printAnswerline("\nAttaching builtins to database.\n");
  database.builtin = {};
  database.builtin["compare/3"] = Comparitor;
  database.builtin[ops.cutCommit + "/0"] = Commit;
  database.builtin["call/1"] = Call;
  database.builtin["fail/0"] = Fail;
  database.builtin["bagof/3"] = BagOf;
  database.builtin["external/3"] = ExternalJS;
  database.builtin["external2/3"] = ExternalAndParse;
  printAnswerline("Attachments done.\n");

  printAnswerline("Parsing rulesets.\n");
  nextlines(document.rules.rules.value);
}

function nextlines(text: string) {
  text.split("\n").forEach(nextline);
}

function nextline(line: string): Database {
  if (!line || line.match(/^\s+$/)) return database;
  printUserline(line);
  previousInput = line;
  if (line.match(/^\s*#/)) return database; //== ops.comment
  const rule = Rule.parse(new Tokeniser(line));
  if (rule == null) return database;
  printEcholine(rule.print());
  if (rule.asking) {
    let reported = false;
    const reportFn = (env: Environment) => {
      reported = true;
      env.printBindings(rule.body!);
    };
    console.log("Asking", line);
    answerQuestion(renameVariables(rule.body!, 0) as Tuple[], new Environment(), database, 1, reportFn);
    if (!reported) printAnswerline("No.\n");
  } else {
    database.push(rule);
    printAnswerline("Memorized.\n");
  }
  return database;
}

// environment ///////

class Environment {
  contents: {
    [name: string]: TupleItem;
  };

  constructor() {
    this.contents = {};
  }

  // Give a new environment from the old with "name" (a string variable name) bound to "part" (a part)
  spawn(name: string, part: TupleItem): Environment {
    // We assume that name has been 'unwound' or 'followed' as far as possible
    // in the environment. If this is not the case, we could get an alias loop.
    const newEnv = new Environment();
    newEnv.contents[name] = part;
    for (const othername in this.contents) if (othername != name) newEnv.contents[othername] = this.contents[othername];
    return newEnv;
  }

  // Print out an environment's contents.
  print() {
    if (!this.contents) return printAnswerline("Empty.\n");
    const retval: string[] = Object.entries(this.contents).map(([name, part]) => ` ${name} = ${part.print()}\n`);
    printAnswerline(retval.length ? retval.join("") : "Empty.\n");
  }

  // Return a list of all variables mentioned in a list of Tuples.
  static varNames(parts: TupleItem[]): Variable[] {
    const variables: Variable[] = [];
    for (const part of parts) {
      switch (part.type) {
        case "Atom":
          continue;
        case "Variable":
          if (!variables.find(o => o.name == part.name)) variables.push(part);
          continue;
        case "Tuple":
          const nestedVariables = Environment.varNames(part.items);
          for (const nestedVariable of nestedVariables) {
            if (!variables.find(o => o.name == nestedVariable.name)) variables.push(nestedVariable);
          }
          continue;
      }
    }
    return variables;
  }

  printBindings(tuples: Tuple[]): void {
    const variables = Environment.varNames(tuples);
    if (variables.length == 0) return printAnswerline("Yes.\n\n");

    const retval: string[] = [];
    for (const variable of variables) {
      if (variable.name != ops.impliedQuestionVar) {
        retval.push("The ");
        retval.push(variable.name);
        retval.push(" is ");
      }
      const topLevelVarName = variable.name + ".0";
      const part = this.value(new Variable(topLevelVarName));
      retval.push(part.name == topLevelVarName ? ops.anything : part.print());
      retval.push(".\n");
    }
    retval.push("\n");
    printAnswerline(retval.join(""));
  }

  // The value of x in a given environment
  value(x: TupleItem): TupleItem {
    switch (x.type) {
      case "Tuple":
        const parts = x.items.map(each => this.value(each));
        return new Tuple(x.name, parts);
      case "Atom":
        return x; // We only need to check the values of variables...
      case "Variable":
        const binding = this.contents[x.name];
        return binding == null ? x : this.value(binding);
    }
  }

  // More substantial utility functions.

  // Unify two tuples in the current environment. Returns a new environment.
  // On failure, returns null.
  unify(x: TupleItem, y: TupleItem): Environment | null {
    x = this.value(x);
    y = this.value(y);
    if (x.type == "Variable") return this.spawn(x.name, y);
    if (y.type == "Variable") return this.spawn(y.name, x);
    if (x.type == "Atom" || y.type == "Atom") return x.type == y.type && x.name == y.name ? this : null;

    // x.type == y.type == Tuple...
    if (x.name != y.name) return null; // Ooh, so first-order.
    const xs = x.items;
    const ys = y.items;
    if (xs.length != ys.length) return null;

    let env: Environment | null = this;
    for (let i = 0; i < xs.length; i++) {
      env = env.unify(xs[i], ys[i]);
      if (env == null) return null;
    }

    return env;
  }
}

// Go through a list of tuples (ie, a Body or Partlist's list) renaming variables
// by appending 'level' to each variable name.
// How non-graph-theoretical can this get?!?
// "parent" points to the subgoal, the expansion of which lead to these tuples.
function renameVariables(list: TupleItem[], level: number, parent?: Tuple): TupleItem[] {
  return list.map(part => renameVariable(part, level, parent));
}
function renameVariable(part: TupleItem, level: number, parent?: Tuple): TupleItem {
  switch (part.type) {
    case "Atom":
      return part;
    case "Variable":
      return new Variable(part.name + "." + level);
    case "Tuple":
      return new Tuple(part.name, renameVariables(part.items, level, parent), parent);
  }
}

// The meat of this thing... js-tinyProlog.
// The main proving engine. Returns: null (keep going), other (drop out)
function answerQuestion(goals: Tuple[], env: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult {
  console.log(level, goals, env.contents);

  if (goals.length == 0) {
    onReport(env);
    //if (!more) return true;
    return null;
  }

  // Prove the first tuple in the goals. We do this by trying to unify that tuple with the rules in our database. For each
  // matching rule, replace the tuple with the body of the matching rule, with appropriate substitutions.
  // Then prove the new goals recursively.

  const first = goals[0];
  const rest = goals.slice(1);

  // Do we have a builtin?
  const builtin = db.builtin![first.name + "/" + first.items.length];
  if (builtin) return builtin(first, rest, env, db, level + 1, onReport);

  for (let dbIndex = 0; dbIndex < db.length; dbIndex++) {
    if (first.excludeRule == dbIndex) continue;
    const rule: Rule = db[dbIndex];
    if (!rule.head) continue;
    if (rule.head.name != first.name) continue; //consoleOutError(tk, "DEBUG: we'll need better unification to allow the 2nd-order rule matching\n");
    const renamedHead = new Tuple(rule.head.name, renameVariables(rule.head.items, level, first)); // Rename the variables in the head and body
    // renamedHead.ruleNumber = dbIndex;
    const env2 = env.unify(first, renamedHead);
    if (env2 == null) continue;

    let nextGoals = rest;
    if (rule.body != null) {
      const newFirstGoals = renameVariables(rule.body, level, renamedHead) as Tuple[];
      for (let j = 0; j < newFirstGoals.length; j++) if (rule.body![j].willExcludeRule) newFirstGoals[j].excludeRule = dbIndex;
      nextGoals = newFirstGoals.concat(nextGoals);
    }
    const ret = answerQuestion(nextGoals, env2, db, level + 1, onReport);
    if (ret != null) return ret;
    if (renamedHead.commit) break; //print ("Debug: this goal " + thisTuple.print() + " has been committed.\n");
    if (first.parent.commit) break; //print ("Debug: parent goal " + thisTuple.parent.print() + " has been committed.\n");
  }

  return null;
}

// Object (of a style...) definitions:
// Rule = Head if Query
// Head = Tuple  .
// Query = Tuple+  ?
// Tuple = [TupleItem+]
// TupleItem = Variable | Atom | Tuple

type TupleItem = Variable | Atom | Tuple;

class Variable {
  type: "Variable" = "Variable";
  name: string;

  constructor(head: string) {
    this.name = head;
  }
  print(): string {
    return "The " + this.name;
  }
}

class Atom {
  type: "Atom" = "Atom";
  name: string;

  constructor(head: string) {
    this.name = head;
  }
  print(): string {
    return this.name;
  }
}

class Tuple {
  type: "Tuple" = "Tuple";
  name: string;
  items: TupleItem[];
  willExcludeRule?: boolean;
  excludeRule?: number;
  parent: Tuple;
  commit?: boolean;

  constructor(head: string, list: TupleItem[], parent?: Tuple, excludeThis?: boolean) {
    this.name = head;
    this.items = list;
    this.parent = parent || this;
    this.willExcludeRule = excludeThis;
  }

  static parseAtTopLevel(tk: Tokeniser): Tuple | null {
    const willExclude = tk.current == ops.notThis;
    if (willExclude) tk = tk.consume();

    // Parse commit/rollback as bareword since they control the engine
    if ([ops.cutCommit, ops.failRollback].includes(tk.current as ops)) {
      const op = tk.current;
      tk = tk.consume();
      return new Tuple(op, []);
    }

    const tuple = Tuple.parse(tk);
    if (tuple) tuple.willExcludeRule = willExclude;
    return tuple;
  }

  static parse(tk: Tokeniser): Tuple | null {
    // [
    tk = tk.consume();

    // symbol/vam/number/string/bareword
    const name = tk.current;
    tk = tk.consume();

    //   ,  or  ]
    if (tk.current == ",") tk = tk.consume();
    else if (tk.current != "]") return consoleOutError(tk, "expected , or ] after first tuple");

    // while not ] parse items
    const parts = Tuple.parseItems(tk);
    if (!parts) return null;
    return new Tuple(name, parts);
  }

  print(): string {
    const retval: string[] = [];
    if (this.name == ops.cons) {
      let part: TupleItem = this;
      while (part.type == "Tuple" && part.name == ops.cons && part.items.length == 2) {
        part = part.items[1];
      }
      if ((part.type == "Atom" && part.name == ops.nothing) || part.type == "Variable") {
        part = this;
        retval.push(ops.openList);
        let comma = false;
        while (part.type == "Tuple" && part.name == ops.cons && part.items.length == 2) {
          if (comma) retval.push(", ");
          retval.push(part.items[0].print());
          comma = true;
          part = part.items[1];
        }
        if (part.type == "Variable") {
          retval.push(" " + ops.sliceList + " ");
          retval.push(part.print());
        }
        retval.push(ops.closeList);
        return retval.join("");
      }
    }
    retval.push(ops.open + this.name);
    retval.push(this.items.map(each => ", " + each.print()).join(""));
    retval.push(ops.close);
    return retval.join("");
  }

  static parseItems(tk: Tokeniser): TupleItem[] | null {
    const parts: TupleItem[] = [];
    while (tk.current != ops.close) {
      if (tk.type == "eof") return consoleOutError(tk, "unexpected EOF while running through tuples until", ops.close);

      const part = Tuple.parseItem(tk);
      if (part == null) return consoleOutError(tk, "part didn't parse at", tk.current, " but instead got");
      parts.push(part);

      if (tk.current == ",") tk = tk.consume();
      else if (tk.current != ops.close)
        return consoleOutError(tk, "a tuple ended before the " + ops.bodyTupleSeparator + " or the " + ops.close + "  but instead got");
    }
    tk = tk.consume();
    return parts;
  }

  // This was a beautiful piece of code. It got kludged to add [a,b,c|Z] sugar.
  static parseItem(tk: Tokeniser): TupleItem | null {
    // Part -> var | id | id(optParamList)
    // Part -> [ listBit ] ::-> cons(...)

    switch (tk.type) {
      // var?  parse & return
      case "var":
        const varName = tk.current;
        tk = tk.consume();
        return new Variable(varName);

      // bareword? atom?  parse & return
      case "id":
        const symbolName = tk.current;
        tk = tk.consume();
        return new Atom(symbolName);

      case "eof":
        return consoleOutError(tk, "unexpected end of input");

      default:
        return consoleOutError(tk, "expected a ", ops.open, "or", ops.openList, "here");

      case "punc":
        break;
    }
    if (tk.current == ops.openList) return Tuple.parseDestructuredList(tk);
    if (tk.current == ops.open) return Tuple.parse(tk);
    return consoleOutError(tk, "expected a ", ops.open, "or", ops.openList, "here");
  }

  static parseDestructuredList(tk: Tokeniser): TupleItem | null {
    // list destructure?  parse & return
    tk = tk.consume();

    // Special case: {} = new atom(nothing).
    if (tk.type == "punc" && tk.current == ops.closeList) {
      tk = tk.consume();
      return new Atom(ops.nothing);
    }

    // Get a list of parts
    const parts = [];
    while (true) {
      const part = Tuple.parseItem(tk);
      if (part == null) return consoleOutError(tk, "can't understand this part of a list destructuring");
      parts.push(part);
      if (tk.current != ",") break;
      tk = tk.consume();
    }

    // Find the end of the list ... "| Var }" or "}".
    let append: TupleItem;
    if (tk.current == ops.sliceList) {
      tk = tk.consume();
      if (tk.type != "var") return consoleOutError(tk, ops.sliceList, " wasn't followed by a var");
      append = new Variable(tk.current!);
      tk = tk.consume();
    } else {
      append = new Atom(ops.nothing);
    }
    if (tk.current != ops.closeList) return consoleOutError(tk, "list destructure wasn't ended by }");
    tk = tk.consume();
    // Return the new cons.... of all this rubbish.
    for (let i = parts.length - 1; i >= 0; i--) append = new Tuple(ops.cons, [parts[i], append]);
    return append;
  }
}

class Rule {
  head: Tuple | null;
  body: Tuple[] | null;
  asking: boolean;

  constructor(head: Tuple, query: Tuple[] | null = null, isQuestion: boolean = false) {
    this.asking = isQuestion;
    if (isQuestion) {
      this.body = query != null ? [head].concat(query) : [head];
      this.head = null;
    } else {
      this.body = query;
      this.head = head;
    }
  }

  // A rule is a Head followedBy   .   orBy   if Body   orBy    ?    or contains ? as a Var   or just ends, where . or ? is assumed
  static parse(tk: Tokeniser): Rule | null {
    const head = Tuple.parse(tk);
    if (!head) return consoleOutError(tk, "syntax error");

    const expected = [ops.if, ops.endQuestion, ops.endSentence, ops.bodyTupleSeparator];
    const questionIsImplied = hasTheImpliedUnboundVar(head);
    const isQuestion = tk.current == ops.endQuestion || tk.current == ops.bodyTupleSeparator || questionIsImplied;

    if (!expected.includes(tk.current as ops) && !questionIsImplied && tk.type != "eof")
      return consoleOutError(tk, "expected one of ", expected.join(" "), "  but instead got");

    if (tk.type == "eof") return new Rule(head, null, isQuestion);

    switch (tk.current) {
      case ops.endSentence:
        tk = tk.consume();
        return new Rule(head, null, false); // [foo, ?].  same as [foo, anything]. but not same as [foo, ?]?

      case ops.endQuestion:
        tk = tk.consume();
        return new Rule(head, null, true);

      case ops.if:
        tk = tk.consume();
        const bodyOfIf = Rule.parseBody(tk);
        if (tk.current == ops.endSentence) tk = tk.consume();
        else if (tk.type != "eof") return consoleOutError(tk, "expected end of sentence with a ", ops.endSentence, " but instead got ");
        return new Rule(head, bodyOfIf, false);

      case ops.bodyTupleSeparator:
        tk = tk.consume();
        const bodyContinues = Rule.parseBody(tk);
        if (tk.current == ops.endQuestion) tk.consume();
        else if (tk.type != "eof") return consoleOutError(tk, "expected complex question to end with", ops.endQuestion, "but instead got ");
        return new Rule(head, bodyContinues, true);

      default:
        return consoleOutError(tk, "expected one of ", expected.join(" "), "  but instead got");
    }
  }

  static parseBody(tk: Tokeniser): Tuple[] | null {
    const tuples: Tuple[] = [];
    while (true) {
      const tuple = Tuple.parseAtTopLevel(tk);
      if (tuple == null) break;
      tuples.push(tuple);
      if (tk.current != ",") break;
      tk = tk.consume();
    }
    return tuples.length == 0 ? null : tuples;
  }

  print(): string {
    const retval: string[] = [];
    if (this.head) retval.push(this.head.print());
    if (this.head && this.body) retval.push(ops.if);
    if (this.body) retval.push(this.body.map(each => each.print()).join(", "));
    retval.push(this.asking ? ops.endQuestion : ops.endSentence);
    retval.push("\n");
    return retval.join(" ");
  }
}

function hasTheImpliedUnboundVar(tuple: TupleItem): boolean {
  switch (tuple.type) {
    case "Atom":
      return tuple.name === ops.impliedQuestionVar;
    case "Variable":
      return tuple.name === ops.impliedQuestionVar;
    case "Tuple":
      return tuple.items.some(hasTheImpliedUnboundVar);
  }
}

const newVars = false;

// The Tiny-Prolog parser goes here.
class Tokeniser {
  remainder: string;
  current: string;
  type: "" | "eof" | "id" | "var" | "punc";

  constructor(line: string) {
    this.remainder = line;
    this.current = "";
    this.type = ""; // "eof", "id", "var", "punc" etc.
    this.consume(); // Load up the first token.
  }

  consume(): this {
    if (this.type == "eof") {
      console.warn("Tried to consume eof");
      return this;
    }

    // Eat any leading WS
    let r: RegExpMatchArray | null = this.remainder.match(/^\s*(.*)$/);
    if (r) {
      this.remainder = r[1];
    }

    if (this.remainder == "") {
      this.current = "";
      this.type = "eof";
      return this;
    }

    // punctuation   openList {  closeList }  endSentence .  ummm ,  open [ close ] sliceList | ummm !  if if
    if (newVars) r = this.remainder.match(/^([\{\}\.\?,\[\]\|\!]|(?:\bif\b))(.*)$/);
    else r = this.remainder.match(/^([\{\}\.,\[\]\|\!]|(?:\bif\b))(.*)$/);
    if (r) {
      this.remainder = r[2];
      this.current = r[1];
      this.type = "punc";
      return this;
    }

    // variable    including ? as varName
    if (newVars) r = this.remainder.match(/^(?:the|a|an|any)\s+([a-zA-Z0-9_]+)(.*)$/);
    else r = this.remainder.match(/^([A-Z_][a-zA-Z0-9_]*|\?)(.*)$/);
    if (r) {
      this.remainder = r[2];
      this.current = r[1];
      this.type = "var";
      return this;
    }

    // URLs in curly-bracket pairs
    r = this.remainder.match(/^(\{[^\}]*\})(.*)$/);
    if (r) {
      this.remainder = r[2];
      this.current = r[1];
      this.type = "id";
      return this;
    }

    // Quoted strings
    r = this.remainder.match(/^("[^"]*")(.*)$/);
    if (r) {
      this.remainder = r[2];
      this.current = r[1];
      this.type = "id";
      return this;
    }

    // symbol
    r = this.remainder.match(/^([a-zA-Z0-9][a-zA-Z0-9_]*)(.*)$/);
    if (r) {
      this.remainder = r[2];
      this.current = r[1];
      this.type = "id";
      return this;
    }

    // number
    r = this.remainder.match(/^(-[0-9][0-9]*)(.*)$/);
    if (r) {
      this.remainder = r[2];
      this.current = r[1];
      this.type = "id";
      return this;
    }

    // comment
    r = this.remainder.match(/^#(.*)$/);
    if (r) {
      this.remainder = "";
      this.current = "";
      this.type = "eof";
      return this;
    }

    // eof?
    this.current = "";
    if (this.remainder) consoleOutError(this, "Cannot recognize this");
    this.type = "eof";
    return this;
  }
}

// A sample builtin function, including all the bits you need to get it to work
// within the general proving mechanism.

// compare(First, Second, CmpValue)
// First, Second must be bound to strings here.
// CmpValue is bound to -1, 0, 1
function Comparitor(thisTuple: Tuple, goals: Tuple[], environment: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult {
  //DEBUG print ("in Comparitor.prove()...\n");
  // Prove the builtin bit, then break out and prove
  // the remaining goals.

  // if we were intending to have a resumable builtin (one that can return
  // multiple bindings) then we'd wrap all of this in a while() loop.

  // Rename the variables in the head and body
  // var renamedHead = new Tuple(rule.head.name, renameVariables(rule.head.items.list, level));

  const first = environment.value(thisTuple.items[0]);
  if (first.type != "Atom") {
    //print("Debug: Comparitor needs First bound to an Atom, failing\n");
    return null;
  }

  const second = environment.value(thisTuple.items[1]);
  if (second.type != "Atom") {
    //print("Debug: Comparitor needs Second bound to an Atom, failing\n");
    return null;
  }

  let cmp = "eq";
  if (first.name < second.name) cmp = "lt";
  else if (first.name > second.name) cmp = "gt";

  const env2 = environment.unify(thisTuple.items[2], new Atom(cmp));

  if (env2 == null) {
    //print("Debug: Comparitor cannot unify CmpValue with " + cmp + ", failing\n");
    return null;
  }

  // Just prove the rest of the goals, recursively.
  return answerQuestion(goals, env2, db, level + 1, onReport);
}

function Commit(thisTuple: Tuple, goals: Tuple[], environment: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult {
  //DEBUG print ("in Comparitor.prove()...\n");
  // Prove the builtin bit, then break out and prove
  // the remaining goals.

  // if we were intending to have a resumable builtin (one that can return
  // multiple bindings) then we'd wrap all of this in a while() loop.

  // Rename the variables in the head and body
  // var renamedHead = new Tuple(rule.head.name, renameVariables(rule.head.items.list, level));

  // On the way through, we do nothing...

  // Just prove the rest of the goals, recursively.
  const ret = answerQuestion(goals, environment, db, level + 1, onReport);

  // Backtracking through the 'commit' stops any further attempts to prove this subgoal.
  //print ("Debug: backtracking through commit/0: thisTuple.parent = "); thisTuple.parent.print(); print("\n");
  thisTuple.parent.commit = true;

  return ret;
}

// Given a single argument, it sticks it on the goal list.
function Call(thisTuple: Tuple, goals: Tuple[], env: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult {
  // Prove the builtin bit, then break out and prove
  // the remaining goals.

  // Rename the variables in the head and body
  // var renamedHead = new Tuple(rule.head.name, renameVariables(rule.head.items.list, level));

  const first: TupleItem = env.value(thisTuple.items[0]);
  if (first.type != "Tuple") {
    //print("Debug: Call needs parameter bound to a Tuple, failing\n");
    return null;
  }

  //var newGoal = new Tuple(first.name, renameVariables(first.items.list, level, thisTuple));
  //newGoal.parent = thisTuple;

  // Stick this as a new goal on the start of the goals
  const newGoals: Tuple[] = [];
  newGoals[0] = first;
  first.parent = thisTuple;

  let j;
  for (j = 0; j < goals.length; j++) newGoals[j + 1] = goals[j];

  // Just prove the rest of the goals, recursively.
  return answerQuestion(newGoals, env, db, level + 1, onReport);
}

function Fail(thisTuple: Tuple, goals: Tuple[], env: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult {
  return null; // TODO shouldn't this return True or something?
}

type AnswerList = TupleItem[] & { renumber?: number };

function BagOf(thisTuple: Tuple, goals: Tuple[], env: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult {
  // bagof(Tuple, ConditionTuple, ReturnList)

  let collect: TupleItem = env.value(thisTuple.items[0]);
  const subgoal = env.value(thisTuple.items[1]) as Tuple;
  const into = env.value(thisTuple.items[2]);

  collect = renameVariable(collect, level, thisTuple);
  const newGoal = new Tuple(subgoal.name, renameVariables(subgoal.items, level, thisTuple), thisTuple);

  const newGoals = [];
  newGoals[0] = newGoal;

  // Prove this subgoal, collecting up the environments...
  const anslist = [] as AnswerList;
  anslist.renumber = -1;
  answerQuestion(newGoals, env, db, level + 1, BagOfCollectFunction(collect, anslist));

  // Turn anslist into a proper list and unify with 'into'

  // optional here: nothing anslist -> fail?
  let answers: TupleItem = new Atom(ops.nothing);

  /*
        print("Debug: anslist = [");
            for (let j = 0; j < anslist.length; j++) {
                anslist[j].print();
                print(", ");
            }
        print("]\n");
        */

  for (let i = anslist.length; i > 0; i--) answers = new Tuple(ops.cons, [anslist[i - 1], answers]);

  //print("Debug: unifying "); into.print(); print(" with "); answers.print(); print("\n");
  const env2 = env.unify(into, answers);

  if (env2 == null) {
    //print("Debug: bagof cannot unify anslist with "); into.print(); print(", failing\n");
    return null;
  }

  // Just prove the rest of the goals, recursively.
  return answerQuestion(goals, env2, db, level + 1, onReport);
}

// Aux function: return the onReport to use with a bagof subgoal
function BagOfCollectFunction(collect: TupleItem, anslist: AnswerList): ReportFunction {
  return function (env: Environment) {
    /*
                print("DEBUG: solution in bagof/3 found...\n");
                print("Value of collection tuple ");
                collect.print();
                print(" in this environment = ");
                (value(collect, env)).print();
                print("\n");
                printEnv(env);
                */
    // Rename this appropriately and throw it into anslist
    anslist[anslist.length] = renameVariable(env.value(collect), anslist.renumber!--) as TupleItem;
  };
}

// Call out to external javascript
// external/3 takes three arguments:
// first: a template string that uses $1, $2, etc. as placeholders for
const EvalContext: any[] = [];

function ExternalJS(thisTuple: Tuple, goals: Tuple[], env: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult {
  //print ("DEBUG: in External...\n");

  // Get the first tuple, the template.
  const first = env.value(thisTuple.items[0]);
  if (first.type != "Atom") {
    //print("Debug: External needs First bound to a string Atom, failing\n");
    return null;
  }
  const regresult = first.name.match(/^"(.*)"$/);
  if (!regresult) return null;
  let r = regresult[1];

  //print("DEBUG: template for External/3 is "+r+"\n");

  // Get the second tuple, the argument list.
  let second: TupleItem = env.value(thisTuple.items[1]);
  let i = 1;
  while (second.type == "Tuple" && second.name == ops.cons) {
    // Go through second an argument at a time...
    const arg = env.value(second.items[0]);
    if (arg.type != "Atom") {
      //print("DEBUG: External/3: argument "+i+" must be an Atom, not "); arg.print(); print("\n");
      return null;
    }
    const re = new RegExp("\\$" + i, "g");
    //print("DEBUG: External/3: RegExp is "+re+", arg is "+arg.name+"\n");
    r = r.replace(re, arg.name);
    //print("DEBUG: External/3: r becomes "+r+"\n");
    second = (second as Tuple).items[1];
    i++;
  }
  if (second.type != "Atom" || second.name != ops.nothing) {
    //print("DEBUG: External/3 needs second to be a list, not "); second.print(); print("\n");
    return null;
  }

  //print("DEBUG: External/3 about to eval \""+r+"\"\n");

  let ret: string;
  // @ts-ignore
  with (EvalContext) ret = eval(r);

  //print("DEBUG: External/3 got "+ret+" back\n");

  if (!ret) ret = ops.nothing;

  // Convert back into an atom...
  const env2 = env.unify(thisTuple.items[2], new Atom(ret));

  if (env2 == null) {
    //print("Debug: External/3 cannot unify OutValue with " + ret + ", failing\n");
    return null;
  }

  // Just prove the rest of the goals, recursively.
  return answerQuestion(goals, env2, db, level + 1, onReport);
}

function ExternalAndParse(thisTuple: Tuple, goals: Tuple[], env: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult {
  //print ("DEBUG: in External...\n");

  // Get the first tuple, the template.
  const first = env.value(thisTuple.items[0]);
  if (first.type != "Atom") {
    //print("Debug: External needs First bound to a string Atom, failing\n");
    return null;
  }
  const regResult = first.name.match(/^"(.*)"$/);
  if (!regResult) return null;
  let r = regResult[1];

  //print("DEBUG: template for External/3 is "+r+"\n");

  // Get the second tuple, the argument list.
  let second: TupleItem = env.value(thisTuple.items[1]);
  let i = 1;
  while (second.type == "Tuple" && second.name == ops.cons) {
    // Go through second an argument at a time...
    const arg = env.value(second.items[0]);
    if (arg.type != "Atom") {
      //print("DEBUG: External/3: argument "+i+" must be an Atom, not "); arg.print(); print("\n");
      return null;
    }
    const re = new RegExp("\\$" + i, "g");
    //print("DEBUG: External/3: RegExp is "+re+", arg is "+arg.name+"\n");
    r = r.replace(re, arg.name);
    //print("DEBUG: External/3: r becomes "+r+"\n");
    second = second.items[1];
    i++;
  }
  if (second.type != "Atom" || second.name != ops.nothing) {
    //print("DEBUG: External/3 needs second to be a list, not "); second.print(); print("\n");
    return null;
  }

  //print("DEBUG: External/3 about to eval \""+r+"\"\n");

  let ret: string;
  // @ts-ignore
  with (EvalContext) ret = eval(r);

  //print("DEBUG: External/3 got "+ret+" back\n");

  if (!ret) ret = ops.nothing;

  // Convert back into a Prolog tuple by calling the appropriate Parse routine...
  const part = Tuple.parseItem(new Tokeniser(ret));
  //print("DEBUG: external2, ret = "); ret.print(); print(".\n");

  const env2 = env.unify(thisTuple.items[2], part!);

  if (env2 == null) {
    //print("Debug: External/3 cannot unify OutValue with " + ret + ", failing\n");
    return null;
  }

  // Just prove the rest of the goals, recursively.
  return answerQuestion(goals, env2, db, level + 1, onReport);
}

// run program
init();
commandLineEl.focus();
