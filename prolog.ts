interface Document {
  input: HTMLFormElement;
  rules: HTMLFormElement;
}

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
  failRollbackMoreAgain = "get_more",
  nothing = "nothing",
  anything = "anything",
  dontSelfRecurse = "dontSelfRecurse:",
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

let showEcholines = document.input.showparse.checked;
function toggleEcholines() {
  showEcholines = !showEcholines;
  document.querySelectorAll<HTMLDivElement>("div.echodiv").forEach(el => (el.style.display = showEcholines ? "block" : "none"));
}

function printUserline(str: string) {
  const div = newConsoleLine();
  div.classList.add("userdiv");
  div.innerHTML = "<span>" + str + "</span>";
}

function printEcholine(str: string) {
  const div = newConsoleLine();
  div.classList.add("echodiv");
  div.innerHTML = "<span>" + str + "</span>";
}

function printDebugline(...rest: any[]) {
  const div = newConsoleLine();
  div.classList.add("debugdiv");
  div.innerHTML = "<div>" + rest.join(" ").replaceAll("\n", "</div><div>") + "</div>";
  newConsoleLine();
  return null;
}

function printAnswerline(str: string) {
  const div = newConsoleLine();
  div.classList.add("answerdiv");
  div.innerHTML = "<div><div>" + str.replaceAll("\n", "</div><div>") + "</div></div>";
}

function consoleOutError(tk: Tokeniser | null, ...rest: any[]): null {
  const div = newConsoleLine();
  div.classList.add("errdiv");
  div.innerHTML = "<div><div><span class=err>" + rest.join(" ") + "</span></div><div>" + (tk ? tk.current + tk.remainder : "") + "</div></div>";
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
  database.builtin["ask/1"] = Ask;
  database.builtin[ops.failRollbackMoreAgain + "/0"] = More;
  database.builtin["bagof/3"] = BagOf;
  database.builtin["javascript/3"] = ExternalJS;
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
    //console.log("Asking", line);
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

  constructor(oldEnvironment?: Environment) {
    this.contents = Object.create(oldEnvironment?.contents || null);
  }

  // Print out an environment's contents.
  print() {
    if (!this.contents) return printAnswerline("Empty.\n");
    const retval: string[] = []; // use for..in to get inherited properties
    for (const name in this.contents) retval.push(` ${name} = ${this.contents[name].print()}\n`);
    printAnswerline(retval.length ? retval.join("") : "Empty.\n");
  }

  // prints what values vars are bound to
  printBindings(tuples: Tuple[]): void {
    // Return a list of all variables mentioned in a list of Tuples.
    const varNames = (parts: TupleItem[]): Variable[] => {
      const variables: Variable[] = [];
      for (const part of parts) {
        switch (part.type) {
          case "Literal":
            continue;
          case "Variable":
            if (!variables.find(o => o.name == part.name)) variables.push(part);
            continue;
          case "Tuple":
            const nestedVariables = varNames(part.items);
            for (const nestedVariable of nestedVariables) if (!variables.find(o => o.name == nestedVariable.name)) variables.push(nestedVariable);
            continue;
        }
      }
      return variables;
    };

    const variables = varNames(tuples);
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

  // Give a new environment from the old with "name" (a string variable name) bound to "part" (a part)
  spawn(name: string, part: TupleItem): Environment {
    // We assume that name has been 'unwound' or 'followed' as far as possible
    // in the environment. If this is not the case, we could get an alias loop.
    const newEnv = new Environment(this);
    newEnv.contents[name] = part;
    return newEnv;
  }

  // The value of x in a given environment
  value(x: TupleItem): TupleItem {
    switch (x.type) {
      case "Tuple":
        const parts = x.items.map(each => this.value(each));
        return new Tuple(parts, undefined, x.dontSelfRecurse);
      case "Literal":
        return x; // We only need to check the values of variables...
      case "Variable":
        const binding = this.contents[x.name];
        return binding == null ? x : this.value(binding);
    }
  }

  // Unify two items under the current environment. Returns a new environment, or null on failure
  unify(x: TupleItem, y: TupleItem): Environment | null {
    x = this.value(x);
    y = this.value(y);
    if (x.type == "Variable") return this.spawn(x.name, y);
    if (y.type == "Variable") return this.spawn(y.name, x);
    if (x.type == "Literal" || y.type == "Literal") return x.type == y.type && x.name == y.name ? this : null;

    // x.type == y.type == Tuple...
    const xs = x.items;
    const ys = y.items;
    if (xs.length != ys.length) return null;

    let env: Environment | null = this;
    // check pairs of literals first, for performance
    for (let i = 0; i < xs.length; i++) {
      if (xs[i].type == "Literal" || ys[i].type == "Literal") {
        env = env.unify(xs[i], ys[i]);
        if (env == null) return null;
      }
    }
    //console.log("trying", y.name);
    // now check everything else
    for (let i = 0; i < xs.length; i++) {
      if (xs[i].type != "Literal" && ys[i].type != "Literal") {
        env = env.unify(xs[i], ys[i]);
        if (env == null) return null;
      }
    }

    return env;
  }
}

// Go through a tuple's terms renaming variables by appending 'level' to each variable name.
// "parent" points to the subgoal, the expansion of which led to these tuples.
const renameVariables = (items: TupleItem[], level: number, parent?: Tuple): TupleItem[] => items.map(item => renameVariable(item, level, parent));
function renameVariable(rvalue: TupleItem, level: number, parent?: Tuple): TupleItem {
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
function answerQuestion(goals: Tuple[], env: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult {
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
  const builtin = db.builtin![first.name + "/" + (first.items.length - 1)];
  if (builtin) return builtin(first, rest, env, db, level + 1, onReport);

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

// Object (of a style...) definitions:
// Rule = Head if Query
// Head = Tuple  .
// Query = Tuple+  ?
// Tuple = [TupleItem+]
// TupleItem = Variable | Literal | Tuple

type TupleItem = Variable | Literal | Tuple;

class Variable {
  type: "Variable" = "Variable";
  name: string;

  constructor(head: string) {
    this.name = head;
  }
  print(): string {
    return "the " + this.name;
  }
}

class Literal {
  type: "Literal" = "Literal";
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

  // when it appears before a term in the body of a rule, means "don't use the current rule when attempting to satisfy this term as a subgoal"
  // It's not clever, and it doesn't extend very far down the evaluation stack. In fact, in its current incarnation, the example here
  // (where the rule head is defined in terms of itself immediately) is the only style that this will work with.
  markedDontSelfRecurse?: boolean;
  dontSelfRecurse?: Rule;
  parent: Tuple;
  commit?: boolean;

  constructor(list: TupleItem[], parent?: Tuple, dontSelfRecurse?: Rule) {
    this.name = list.length == 0 ? "anonymous" : list.find(item => item.type == "Literal")?.name || "anonymous";
    this.items = list;
    this.parent = parent || this;
    this.dontSelfRecurse = dontSelfRecurse;
    //console.log("tuple name", this.name);
  }

  // extra-logical markup goes here, outside of and just before a Tuple starts.
  // the markup might apply to the following tuple (ops.dontSelfRecurse) or be unrelated (commit/tryagain)
  static parseAtTopLevel(tk: Tokeniser): Tuple | null {
    const willExclude = tk.current == ops.dontSelfRecurse;
    if (willExclude) tk = tk.consume();

    // Parse commit/rollback as bareword since they control the engine
    if ([ops.cutCommit, ops.failRollbackMoreAgain].includes(tk.current as ops)) {
      const op = tk.current;
      tk = tk.consume();
      return new Tuple([new Literal(op)]);
    }

    const tuple = Tuple.parse(tk);
    if (tuple) tuple.markedDontSelfRecurse = willExclude;
    return tuple;
  }

  static parse(tk: Tokeniser): Tuple | null {
    tk.contextPush("tuple");

    // [
    if (tk.type != "punc" || tk.current != ops.open) return consoleOutError(tk, "tuple must begin with", ops.open);
    tk = tk.consume();

    // while not ] parse items
    const parts: TupleItem[] = [];
    while (tk.current != ops.close) {
      if (tk.type == "eof") return consoleOutError(tk, "unexpected EOF while running through tupleitems");

      const part = Tuple.parseItem(tk);
      if (part == null) return consoleOutError(tk, "part didn't parse at", tk.current, " but instead got");
      parts.push(part);

      if (tk.current == ",") tk = tk.consume();
      else if (tk.current != ops.close)
        return consoleOutError(tk, "a tuple ended before the " + ops.bodyTupleSeparator + " or the " + ops.close + "  but instead got");
    }
    tk = tk.consume("pop");
    return new Tuple(parts);
  }

  print(): string {
    const retval: string[] = [];
    if (this.name == ops.cons) {
      let part: TupleItem = this;
      while (part.type == "Tuple" && part.name == ops.cons && part.items.length == 3) {
        part = part.items[2];
      }
      if ((part.type == "Literal" && part.name == ops.nothing) || part.type == "Variable") {
        part = this;
        retval.push(ops.openList);
        let comma = false;
        while (part.type == "Tuple" && part.name == ops.cons && part.items.length == 3) {
          if (comma) retval.push(", ");
          retval.push(part.items[1].print());
          comma = true;
          part = part.items[2];
        }
        if (part.type == "Variable") {
          retval.push(" " + ops.sliceList + " ");
          retval.push(part.print());
        }
        retval.push(ops.closeList);
        return retval.join("");
      }
    }
    retval.push(ops.open);
    retval.push(this.items.map(each => each.print()).join(", "));
    retval.push(ops.close);
    return retval.join("");
  }

  static parseItem(tk: Tokeniser): TupleItem | null {
    tk.contextPush("tupleitem");
    switch (tk.type) {
      case "var":
        const varName = tk.current;
        tk = tk.consume("pop");
        return new Variable(varName);

      case "id":
        const symbolName = tk.current;
        tk = tk.consume("pop");
        return new Literal(symbolName);

      case "eof":
        return consoleOutError(tk, "unexpected end of input");

      default:
        return consoleOutError(tk, "expected a ", ops.open, "or", ops.openList, "here");

      case "punc":
        break;
    }
    if (tk.current == ops.openList) {
      const t = Tuple.parseDestructuredList(tk);
      tk.contextPop();
      return t;
    }
    if (tk.current == ops.open) {
      const t = Tuple.parse(tk);
      tk.contextPop();
      return t;
    }
    return consoleOutError(tk, "expected a ", ops.open, "or", ops.openList, "here");
  }

  static parseDestructuredList(tk: Tokeniser): TupleItem | null {
    tk.contextPush("list");

    if (tk.type != "punc" || tk.current != ops.openList) return consoleOutError(tk, "list must begin with", ops.openList);
    tk = tk.consume();

    // Special case: {} = new atom(nothing).
    if (tk.type == "punc" && tk.current == ops.closeList) {
      tk = tk.consume("pop");
      return new Literal(ops.nothing);
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
      append = new Literal(ops.nothing);
    }
    if (tk.current != ops.closeList) return consoleOutError(tk, "list destructure wasn't ended by }");
    tk = tk.consume("pop");
    // Return the new cons.... of all this rubbish.
    for (let i = parts.length - 1; i >= 0; i--) append = new Tuple([new Literal(ops.cons), parts[i], append]);
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
    if (this.body) for (const tuple of this.body) if (tuple.markedDontSelfRecurse) tuple.dontSelfRecurse = this;
  }

  // A rule is a Head followedBy   .   orBy   if Body   orBy    ?    or contains ? as a Var   or just ends, where . or ? is assumed
  static parse(tk: Tokeniser): Rule | null {
    tk.contextPush("rule");
    const head = Tuple.parse(tk);
    if (!head) return consoleOutError(tk, "syntax error while parsing", tk.contexts.pop());

    const expected = [ops.if, ops.endQuestion, ops.endSentence, ops.bodyTupleSeparator];
    const questionIsImplied = hasTheImpliedUnboundVar(head);
    const isQuestion = tk.current == ops.endQuestion || tk.current == ops.bodyTupleSeparator || questionIsImplied;

    if (!expected.includes(tk.current as ops) && !questionIsImplied && tk.type != "eof")
      return consoleOutError(tk, "expected one of ", expected.join(" "), "  but instead got");

    if (tk.type == "eof") return new Rule(head, null, isQuestion);
    if (tk.type != "punc") return consoleOutError(tk, "expected punctuation mark here not a", tk.type);

    switch (tk.current) {
      case ops.endSentence:
        tk = tk.consume("pop");
        return new Rule(head, null, false); // [foo, ?].  same as [foo, anything]. but not same as [foo, ?]?

      case ops.endQuestion:
        tk = tk.consume("pop");
        return new Rule(head, null, true);

      case ops.if:
        tk = tk.consume();
        const bodyOfIf = Rule.parseBody(tk);
        if (tk.current == ops.endSentence) tk = tk.consume("pop");
        else if (tk.type != "eof") return consoleOutError(tk, "expected end of sentence with a ", ops.endSentence, " but instead got ");
        return new Rule(head, bodyOfIf, false);

      case ops.bodyTupleSeparator:
        tk = tk.consume();
        const bodyContinues = Rule.parseBody(tk);
        if (tk.current == ops.endQuestion) tk.consume("pop");
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
    case "Literal":
      return false;
    case "Variable":
      return tuple.name === ops.impliedQuestionVar;
    case "Tuple":
      return tuple.items.some(hasTheImpliedUnboundVar);
  }
}

// The Tiny-Prolog parser goes here.
class Tokeniser {
  remainder: string;
  current: string;
  type: "" | "eof" | "id" | "var" | "punc";
  contexts: ("tuple" | "tupleitem" | "list" | "rule")[];

  constructor(line: string) {
    this.remainder = line;
    this.current = "";
    this.type = "";
    this.contexts = [];
    this.consume(); // Load up the first token.
  }

  contextPush(context: "tuple" | "tupleitem" | "list" | "rule") {
    this.contexts.push(context);
  }

  contextPop() {
    this.contexts.pop();
  }

  consume(popContext?: "pop"): this {
    if (popContext) this.contextPop();

    const context = this.contexts[this.contexts.length - 1];

    if (this.type == "eof") {
      console.warn("Tried to consume eof");
      return this;
    }

    // Eat any leading WS
    let r: RegExpMatchArray | null = this.remainder.match(/^\s+(.*)$/);
    if (r) {
      this.remainder = r[1];
    }

    if (this.remainder == "") {
      this.current = "";
      this.type = "eof";
      return this;
    }

    // keyword
    r = this.remainder.match(/^(dontSelfRecurse:)(.*)$/);
    if (r) {
      this.remainder = r[2];
      this.current = r[1];
      this.type = "id";
      return this;
    }

    // punctuation   openList {  closeList }  endSentence .  ummm ,  open [ close ] sliceList | ummm !  if if
    if (context == "rule") r = this.remainder.match(/^([\{\}\.\?,\[\]\|\!]|(?:\bif\b))(.*)$/); // with question mark
    else r = this.remainder.match(/^([\{\}\.,\[\]\|\!]|(?:\bif\b))(.*)$/); // withOUT question mark
    if (r) {
      this.remainder = r[2];
      this.current = r[1];
      this.type = "punc";
      return this;
    }

    // variable    including ? as varName
    if (context == "tuple") r = this.remainder.match(/^(\?)(.*)$/);
    if (!r) r = this.remainder.match(/^(?:the|a|an|any)\s+([a-zA-Z0-9_]+)(.*)$/);
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
    if (this.remainder) consoleOutError(this, "Tokenizer doesn't recognize this while parsing a", context);
    this.type = "eof";
    return this;
  }
}

// A sample builtin function, including all the bits you need to get it to work within the general proving mechanism.
// General plan:
// Prove the builtin bit, then break out and prove the remaining goals.
// If we were intending to have a resumable builtin (one that can return multiple bindings) then we'd wrap all of this in a while() loop.
// var renamedHead = new Tuple(renameVariables(rule.head.items.list, level)); // Rename the variables in the head and body

function Commit(thisTuple: Tuple, goals: Tuple[], environment: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult {
  const ret = answerQuestion(goals, environment, db, level + 1, onReport); // On the way through, we do nothing... Just prove the rest of the goals, recursively.
  thisTuple.parent.commit = true; // Backtracking through the 'commit' stops any further attempts to prove this subgoal.
  return ret;
}

function More(thisTuple: Tuple, goals: Tuple[], env: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult {
  return null; // TODO shouldn't this return True or something?
}

// [ask, X].  Given a single argument, it sticks it on the goal list.
function Ask(thisTuple: Tuple, goals: Tuple[], env: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult {
  const first: TupleItem = env.value(thisTuple.items[1]);
  if (first.type != "Tuple") return printDebugline(null, "[Call] only accepts a Tuple.", first.name, "is a", first.type);
  first.parent = thisTuple;
  const newGoals = [first].concat(goals);
  return answerQuestion(newGoals, env, db, level + 1, onReport);
}

// [compare, First: string|number, Second: string|number, CmpValue: gt|eq|lt]
function Comparitor(thisTuple: Tuple, goals: Tuple[], environment: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult {
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
function BagOf(thisTuple: Tuple, goals: Tuple[], env: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult {
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
function ExternalJS(term: Tuple, goals: Tuple[], env: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult {
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

  let jsReturnValue: string;
  // @ts-ignore
  with ([]) jsReturnValue = eval(jsCommand);
  if (!jsReturnValue) jsReturnValue = ops.nothing;

  // Convert back into an literal or tupleitem...
  const part = Tuple.parseItem(new Tokeniser((jsReturnValue ?? "").toString()));
  const env2 = env.unify(term.items[3], part!);
  if (env2 == null) return printDebugline(null, "[External] cannot unify return value with", jsReturnValue);
  return answerQuestion(goals, env2, db, level + 1, onReport);
}

// run program
init();
commandLineEl.focus();
