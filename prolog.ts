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
interface Environment {
  [name: string]: Part;
}
interface ReportFunction {
  (env: Environment): void;
}
interface Functor {
  (thisTerm: Term, goals: Term[], env: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult;
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
  bodyTermSeparator = ",",
  paramSeparator = ",",
  cutCommit = "commit",
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
      printVars(varNames(rule.body!.list), env);
    };
    answerQuestion(renameVariables(rule.body!.list, 0, []) as Term[], {} as Environment, database, 1, reportFn);
    if (!reported) printAnswerline("No.\n");
  } else {
    database.push(rule);
    printAnswerline("Memorized.\n");
  }
  return database;
}

// environment ///////

// Print out an environment's contents.
function printEnv(env?: { [key: string]: Part }) {
  if (!env) return printAnswerline("Empty.\n");
  const retval: string[] = Object.entries(env).map(([name, part]) => ` ${name} = ${part.print()}\n`);
  printAnswerline(retval.length ? retval.join("") : "Empty.\n");
}

// Print bindings.
function printVars(variables: Variable[], environment: Environment): void {
  if (variables.length == 0) return printAnswerline("Yes.\n\n");

  const retval: string[] = [];
  for (const variable of variables) {
    if (variable.name != ops.impliedQuestionVar) {
      retval.push("The ");
      retval.push(variable.name);
      retval.push(" is ");
    }
    const topLevelVarName = variable.name + ".0";
    const part = value(new Variable(topLevelVarName), environment);
    retval.push(part.name == topLevelVarName ? ops.anything : part.print());
    retval.push(".\n");
  }
  retval.push("\n");
  printAnswerline(retval.join(""));
}

// The value of x in a given environment
function value(x: Part, env: Environment): Part {
  switch (x.type) {
    case "Term":
      const parts = x.partlist.list.map(each => value(each, env));
      return new Term(x.name, parts);
    case "Atom":
      return x; // We only need to check the values of variables...
    case "Variable":
      const binding = env[x.name];
      return binding == null ? x : value(binding, env);
  }
}

// Give a new environment from the old with "name" (a string variable name) bound to "part" (a part)
function newEnv(name: string, part: Part, oldEnv: Environment): Environment {
  // We assume that name has been 'unwound' or 'followed' as far as possible
  // in the environment. If this is not the case, we could get an alias loop.
  const newEnv = {} as Environment;
  newEnv[name] = part;
  for (const othername in oldEnv) if (othername != name) newEnv[othername] = oldEnv[othername];
  return newEnv;
}

// More substantial utility functions.

// Unify two terms in the current environment. Returns a new environment.
// On failure, returns null.
function unify(x: Part, y: Part, env: Environment): Environment | null {
  x = value(x, env);
  y = value(y, env);
  if (x.type == "Variable") return newEnv(x.name, y, env);
  if (y.type == "Variable") return newEnv(y.name, x, env);
  if (x.type == "Atom" || y.type == "Atom") return x.type == y.type && x.name == y.name ? env : null;

  // x.type == y.type == Term...
  if (x.name != y.name) return null; // Ooh, so first-order.
  if (x.partlist.list.length != y.partlist.list.length) return null;

  for (var i = 0; i < (x as Term).partlist.list.length; i++) {
    env = unify((x as Term).partlist.list[i], (y as Term).partlist.list[i], env)!;
    if (env == null) return null;
  }

  return env;
}

// Go through a list of terms (ie, a Body or Partlist's list) renaming variables
// by appending 'level' to each variable name.
// How non-graph-theoretical can this get?!?
// "parent" points to the subgoal, the expansion of which lead to these terms.
function renameVariables(list: Part[] | Part, level: number, parent: Term[] | Term): Part[] | Part {
  return Array.isArray(list) ? list.map(part => renameVariable(part, level, parent) as Part) : renameVariable(list, level, parent);
}
function renameVariable(part: Part, level: number, parent: Term[] | Term): Part {
  switch (part.type) {
    case "Atom":
      return part;
    case "Variable":
      return new Variable(part.name + "." + level);
    case "Term":
      const term = new Term(part.name, renameVariables(part.partlist.list, level, parent) as Part[]);
      term.parent = parent as Term;
      return term;
  }
}

// Return a list of all variables mentioned in a list of Terms.
function varNames(parts: Part[]): Variable[] {
  const variables: Variable[] = [];
  for (const part of parts) {
    switch (part.type) {
      case "Atom":
        continue;
      case "Variable":
        if (!variables.find(o => o.name == part.name)) variables.push(part);
        continue;
      case "Term":
        const nestedVariables = varNames(part.partlist.list);
        for (const nestedVariable of nestedVariables) {
          if (!variables.find(o => o.name == nestedVariable.name)) variables.push(nestedVariable);
        }
        continue;
    }
  }
  return variables;
}

// The meat of this thing... js-tinyProlog.
// The main proving engine. Returns: null (keep going), other (drop out)
function answerQuestion(goalList: Term[], env: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult {
  //DEBUG: print ("in main prove...\n");
  if (goalList.length == 0) {
    onReport(env);
    //if (!more) return "done";
    return null;
  }

  // Prove the first term in the goallist. We do this by trying to
  // unify that term with the rules in our database. For each
  // matching rule, replace the term with the body of the matching
  // rule, with appropriate substitutions.
  // Then prove the new goallist. (recursive call)

  const thisTerm = goalList[0];
  //print ("Debug: thisterm = "); thisTerm.print(); print("\n");

  // Do we have a builtin?
  const builtin = db.builtin![thisTerm.name + "/" + thisTerm.partlist.list.length];
  // print ("Debug: searching for builtin "+thisTerm.name+"/"+thisTerm.partlist.list.length+"\n");
  if (builtin) {
    //print ("builtin with name " + thisTerm.name + " found; calling prove() on it...\n");
    // Stick the new body list
    let newGoals = [];
    let j;
    for (j = 1; j < goalList.length; j++) newGoals[j - 1] = goalList[j];
    return builtin(thisTerm, newGoals, env, db, level + 1, onReport);
  }

  for (let i = 0; i < db.length; i++) {
    //print ("Debug: in rule selection. thisTerm = "); thisTerm.print(); print ("\n");
    if (thisTerm.excludeRule == i) {
      // print("DEBUG: excluding rule number "+i+" in attempt to satisfy "); thisTerm.print(); print("\n");
      continue;
    }

    const rule: Rule = db[i];
    if (!rule.head) continue;

    if (rule.head.name != thisTerm.name) {
      //consoleOutError(tk, "DEBUG: we'll need better unification to allow the 2nd-order rule matching\n");
      continue;
    }

    // Rename the variables in the head and body
    const renamedHead = new Term(rule.head.name, renameVariables(rule.head.partlist.list, level, thisTerm) as Part[]);
    // renamedHead.ruleNumber = i;

    const env2 = unify(thisTerm, renamedHead, env);
    if (env2 == null) continue;

    if (rule.body != null) {
      const newFirstGoals = renameVariables(rule.body.list, level, renamedHead) as Part[];
      // Stick the new body list
      let newGoals: Term[] = [];
      let j: number, k: number;
      for (j = 0; j < newFirstGoals.length; j++) {
        newGoals[j] = newFirstGoals[j] as Term;
        if (rule.body.list[j].excludeThis) newGoals[j].excludeRule = i;
      }
      for (k = 1; k < goalList.length; k++) newGoals[j++] = goalList[k];
      const ret = answerQuestion(newGoals, env2, db, level + 1, onReport);
      if (ret != null) return ret;
    } else {
      // Just prove the rest of the goallist, recursively.
      let newGoals: Term[] = [];
      let j: number;
      for (j = 1; j < goalList.length; j++) newGoals[j - 1] = goalList[j];
      const ret = answerQuestion(newGoals, env2, db, level + 1, onReport);
      if (ret != null) return ret;
    }

    if (renamedHead.commit) {
      //print ("Debug: this goal " + thisTerm.print() + " has been committed.\n");
      break;
    }
    if (thisTerm.parent.commit) {
      //print ("Debug: parent goal " + thisTerm.parent.print() + " has been committed.\n");
      break;
    }
  }

  return null;
}

// Object (of a style...) definitions:
// Rule = (Head, Body)
// Head = Term
// Body = [Term]
// Term = (id, Parameters)
// Parameters {Partlist} = [Part]
// Part = Variable | Atom | Term

type Part = Variable | Atom | Term;

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

class Term {
  type: "Term" = "Term";
  name: string;
  partlist: Partlist;
  excludeThis?: boolean;
  excludeRule?: number;
  parent: Term;
  commit?: boolean;

  constructor(head: string, list: Part[]) {
    this.name = head;
    this.partlist = new Partlist(list);
    this.parent = this;
  }

  static parse(tk: Tokeniser): Term | null {
    // Term -> [NOTTHIS] id ( optParamList )

    if (/*tk.type == "id" && */ tk.current == ops.cutCommit) {
      // Parse bareword commit as commit/0
      tk = tk.consume();
      return new Term(ops.cutCommit, []);
    }

    let notthis = tk.current == ops.notThis;
    if (notthis) tk = tk.consume();

    if (tk.type != "punc" || tk.current != ops.open) return consoleOutError(tk, "expected [ to begin");
    tk = tk.consume();

    if (tk.type != "id") return consoleOutError(tk, "expected first term to be a symbol / bare word");

    const name = tk.current;
    tk = tk.consume();

    if (tk.current == ",") tk = tk.consume();
    else if (tk.current != "]") return consoleOutError(tk, "expected , or ] after first term. Current=", tk.current);

    const parts = Partlist.parse(tk);
    if (!parts) return null;

    const term = new Term(name!, parts);
    term.excludeThis = notthis;
    return term;
  }

  print(): string {
    const retval: string[] = [];
    if (this.name == ops.cons) {
      let part: Part = this;
      while (part.type == "Term" && part.name == ops.cons && part.partlist.list.length == 2) {
        part = part.partlist.list[1];
      }
      if ((part.type == "Atom" && part.name == ops.nothing) || part.type == "Variable") {
        part = this;
        retval.push(ops.openList);
        let comma = false;
        while (part.type == "Term" && part.name == ops.cons && part.partlist.list.length == 2) {
          if (comma) retval.push(", ");
          retval.push(part.partlist.list[0].print());
          comma = true;
          part = part.partlist.list[1];
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
    retval.push(this.partlist.print());
    retval.push(ops.close);
    return retval.join("");
  }
}

class Partlist {
  list: Part[];

  constructor(list: Part[]) {
    this.list = list;
  }

  static parse(tk: Tokeniser): Part[] | null {
    const parts: Part[] = [];
    while (tk.current != ops.close) {
      if (tk.type == "eof") return consoleOutError(tk, "unexpected EOF while running through terms until", ops.close);

      const part = Partlist.parse1(tk);
      if (part == null) return consoleOutError(tk, "part didn't parse at", tk.current, " but instead got");
      parts.push(part);

      if (tk.current == ",") tk = tk.consume();
      else if (tk.current != ops.close)
        return consoleOutError(tk, "a term ended before the " + ops.bodyTermSeparator + " or the " + ops.close + "  but instead got");
    }
    tk = tk.consume();
    return parts;
  }

  // This was a beautiful piece of code. It got kludged to add [a,b,c|Z] sugar.
  static parse1(tk: Tokeniser): Part | null {
    // Part -> var | id | id(optParamList)
    // Part -> [ listBit ] ::-> cons(...)

    if (tk.type == "var") {
      const varName = tk.current;
      tk = tk.consume();
      return new Variable(varName);
    }

    // destructure a list
    if (tk.type == "punc" && tk.current == ops.openList) {
      tk = tk.consume();

      // Special case: {} = new atom(nothing).
      if (tk.type == "punc" && tk.current == ops.closeList) {
        tk = tk.consume();
        return new Atom(ops.nothing);
      }

      // Get a list of parts
      const parts = [];
      while (true) {
        const part = Partlist.parse1(tk);
        if (part == null) return consoleOutError(tk, "can't understand this part of a list destructuring");
        parts.push(part);
        if (tk.current != ",") break;
        tk = tk.consume();
      }

      // Find the end of the list ... "| Var }" or "}".
      let append: Part;
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
      for (let i = parts.length - 1; i >= 0; i--) append = new Term(ops.cons, [parts[i], append]);
      return append;
    }

    const openbracket = tk.type == "punc" && tk.current == ops.open;
    if (openbracket) tk = tk.consume();

    const name = tk.current;
    tk = tk.consume();

    if (!openbracket) return new Atom(name);

    if (tk.current != ",") return consoleOutError(tk, "expected , after symbol");
    tk = tk.consume();

    const parts = Partlist.parse(tk);
    if (!parts) return null;

    return new Term(name, parts);
  }

  print(): string {
    return this.list.map(each => ", " + each.print()).join("");
  }
}

class Body {
  list: Term[];

  constructor(list: Term[]) {
    this.list = list;
  }

  print(): string {
    return this.list.map(each => each.print()).join(", ");
  }
}

class Rule {
  head: Term | null;
  body: Body | null;
  asking: boolean;

  constructor(head: Term, bodylist: Term[] | null = null, isQuestion: boolean = false) {
    this.asking = isQuestion;
    if (isQuestion) {
      this.body = new Body(bodylist != null ? [head].concat(bodylist) : [head]);
      this.head = null;
    } else {
      this.body = bodylist != null ? new Body(bodylist) : null;
      this.head = head;
    }
  }

  // A rule is a Head followedBy   .   orBy   if Body   orBy    ?    or contains ? as a Var   or just ends, where . or ? is assumed
  static parse(tk: Tokeniser): Rule | null {
    const head = Rule.parseHead(tk);
    if (!head) return consoleOutError(tk, "syntax error");

    const expected = [ops.if, ops.endQuestion, ops.endSentence, ops.bodyTermSeparator];
    const questionIsImplied = hasTheImpliedUnboundVar(head);

    const isQuestion = tk.current == ops.endQuestion || tk.current == ops.bodyTermSeparator || questionIsImplied;

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

      case ops.bodyTermSeparator:
        tk = tk.consume();
        const bodyContinues = Rule.parseBody(tk);
        if (tk.current == ops.endQuestion) tk.consume();
        else if (tk.type != "eof") return consoleOutError(tk, "expected complex question to end with", ops.endQuestion, "but instead got ");
        return new Rule(head, bodyContinues, true);

      default:
        return consoleOutError(tk, "expected one of ", expected.join(" "), "  but instead got");
    }
  }

  static parseHead(tk: Tokeniser): Term | null {
    // A head is simply a term. (errors cascade back up)
    return Term.parse(tk);
  }

  static parseBody(tk: Tokeniser): Term[] | null {
    const terms: Term[] = [];
    while (true) {
      const term = Term.parse(tk);
      if (term == null) break;
      terms.push(term);
      if (tk.current != ",") break;
      tk = tk.consume();
    }
    return terms.length == 0 ? null : terms;
  }

  print(): string {
    const retval: string[] = [];
    if (this.head) retval.push(this.head.print());
    if (this.head && this.body) retval.push(ops.if);
    if (this.body) retval.push(this.body.print());
    retval.push(this.asking ? ops.endQuestion : ops.endSentence);
    retval.push("\n");
    return retval.join(" ");
  }
}

function hasTheImpliedUnboundVar(term: Part): boolean {
  switch (term.type) {
    case "Atom":
      return term.name === ops.impliedQuestionVar;
    case "Variable":
      return term.name === ops.impliedQuestionVar;
    case "Term":
      return term.partlist.list.some(hasTheImpliedUnboundVar);
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
function Comparitor(thisTerm: Term, goalList: Term[], environment: Environment, db: Database, level: number, reportFunction: ReportFunction): FunctorResult {
  //DEBUG print ("in Comparitor.prove()...\n");
  // Prove the builtin bit, then break out and prove
  // the remaining goalList.

  // if we were intending to have a resumable builtin (one that can return
  // multiple bindings) then we'd wrap all of this in a while() loop.

  // Rename the variables in the head and body
  // var renamedHead = new Term(rule.head.name, renameVariables(rule.head.partlist.list, level));

  const first = value(thisTerm.partlist.list[0], environment);
  if (first.type != "Atom") {
    //print("Debug: Comparitor needs First bound to an Atom, failing\n");
    return null;
  }

  const second = value(thisTerm.partlist.list[1], environment);
  if (second.type != "Atom") {
    //print("Debug: Comparitor needs Second bound to an Atom, failing\n");
    return null;
  }

  let cmp = "eq";
  if (first.name < second.name) cmp = "lt";
  else if (first.name > second.name) cmp = "gt";

  const env2 = unify(thisTerm.partlist.list[2], new Atom(cmp), environment);

  if (env2 == null) {
    //print("Debug: Comparitor cannot unify CmpValue with " + cmp + ", failing\n");
    return null;
  }

  // Just prove the rest of the goallist, recursively.
  return answerQuestion(goalList, env2, db, level + 1, reportFunction);
}

function Commit(thisTerm: Term, goalList: Term[], environment: Environment, db: Database, level: number, reportFunction: ReportFunction): FunctorResult {
  //DEBUG print ("in Comparitor.prove()...\n");
  // Prove the builtin bit, then break out and prove
  // the remaining goalList.

  // if we were intending to have a resumable builtin (one that can return
  // multiple bindings) then we'd wrap all of this in a while() loop.

  // Rename the variables in the head and body
  // var renamedHead = new Term(rule.head.name, renameVariables(rule.head.partlist.list, level));

  // On the way through, we do nothing...

  // Just prove the rest of the goallist, recursively.
  const ret = answerQuestion(goalList, environment, db, level + 1, reportFunction);

  // Backtracking through the 'commit' stops any further attempts to prove this subgoal.
  //print ("Debug: backtracking through commit/0: thisTerm.parent = "); thisTerm.parent.print(); print("\n");
  thisTerm.parent.commit = true;

  return ret;
}

// Given a single argument, it sticks it on the goal list.
function Call(thisTerm: Term, goals: Term[], env: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult {
  // Prove the builtin bit, then break out and prove
  // the remaining goalList.

  // Rename the variables in the head and body
  // var renamedHead = new Term(rule.head.name, renameVariables(rule.head.partlist.list, level));

  const first: Part = value(thisTerm.partlist.list[0], env);
  if (first.type != "Term") {
    //print("Debug: Call needs parameter bound to a Term, failing\n");
    return null;
  }

  //var newGoal = new Term(first.name, renameVariables(first.partlist.list, level, thisTerm));
  //newGoal.parent = thisTerm;

  // Stick this as a new goal on the start of the goallist
  const newGoals: Term[] = [];
  newGoals[0] = first as Term;
  (first as Term).parent = thisTerm;

  let j;
  for (j = 0; j < goals.length; j++) newGoals[j + 1] = goals[j];

  // Just prove the rest of the goallist, recursively.
  return answerQuestion(newGoals, env, db, level + 1, onReport);
}

function Fail(thisTerm: Term, goals: Term[], env: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult {
  return null; // TODO shouldn't this return True or something?
}

type AnswerList = Part[] & { renumber?: number };

function BagOf(thisTerm: Term, goals: Term[], env: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult {
  // bagof(Term, ConditionTerm, ReturnList)

  let collect: Part = value(thisTerm.partlist.list[0], env);
  const subgoal = value(thisTerm.partlist.list[1], env) as Term;
  const into = value(thisTerm.partlist.list[2], env);

  collect = renameVariables(collect, level, thisTerm) as Part;
  const newGoal = new Term(subgoal.name, renameVariables(subgoal.partlist.list, level, thisTerm) as Part[]);
  newGoal.parent = thisTerm;

  const newGoals = [];
  newGoals[0] = newGoal;

  // Prove this subgoal, collecting up the environments...
  const anslist = [] as AnswerList;
  anslist.renumber = -1;
  answerQuestion(newGoals, env, db, level + 1, BagOfCollectFunction(collect, anslist));

  // Turn anslist into a proper list and unify with 'into'

  // optional here: nothing anslist -> fail?
  let answers: Part = new Atom(ops.nothing);

  /*
        print("Debug: anslist = [");
            for (var j = 0; j < anslist.length; j++) {
                anslist[j].print();
                print(", ");
            }
        print("]\n");
        */

  for (var i = anslist.length; i > 0; i--) answers = new Term(ops.cons, [anslist[i - 1], answers]);

  //print("Debug: unifying "); into.print(); print(" with "); answers.print(); print("\n");
  const env2 = unify(into, answers, env);

  if (env2 == null) {
    //print("Debug: bagof cannot unify anslist with "); into.print(); print(", failing\n");
    return null;
  }

  // Just prove the rest of the goallist, recursively.
  return answerQuestion(goals, env2, db, level + 1, onReport);
}

// Aux function: return the reportFunction to use with a bagof subgoal
function BagOfCollectFunction(collect: Part, anslist: AnswerList): ReportFunction {
  return function (env: Environment) {
    /*
                print("DEBUG: solution in bagof/3 found...\n");
                print("Value of collection term ");
                collect.print();
                print(" in this environment = ");
                (value(collect, env)).print();
                print("\n");
                printEnv(env);
                */
    // Rename this appropriately and throw it into anslist
    anslist[anslist.length] = renameVariables(value(collect, env), anslist.renumber!--, []) as Part;
  };
}

// Call out to external javascript
// external/3 takes three arguments:
// first: a template string that uses $1, $2, etc. as placeholders for
const EvalContext: any[] = [];

function ExternalJS(thisTerm: Term, goals: Term[], env: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult {
  //print ("DEBUG: in External...\n");

  // Get the first term, the template.
  const first = value(thisTerm.partlist.list[0], env);
  if (first.type != "Atom") {
    //print("Debug: External needs First bound to a string Atom, failing\n");
    return null;
  }
  const regresult = first.name.match(/^"(.*)"$/);
  if (!regresult) return null;
  let r = regresult[1];

  //print("DEBUG: template for External/3 is "+r+"\n");

  // Get the second term, the argument list.
  let second: Part = value(thisTerm.partlist.list[1], env);
  let i = 1;
  while (second.type == "Term" && second.name == ops.cons) {
    // Go through second an argument at a time...
    const arg = value((second as Term).partlist.list[0], env);
    if (arg.type != "Atom") {
      //print("DEBUG: External/3: argument "+i+" must be an Atom, not "); arg.print(); print("\n");
      return null;
    }
    const re = new RegExp("\\$" + i, "g");
    //print("DEBUG: External/3: RegExp is "+re+", arg is "+arg.name+"\n");
    r = r.replace(re, arg.name);
    //print("DEBUG: External/3: r becomes "+r+"\n");
    second = (second as Term).partlist.list[1];
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
  const env2 = unify(thisTerm.partlist.list[2], new Atom(ret), env);

  if (env2 == null) {
    //print("Debug: External/3 cannot unify OutValue with " + ret + ", failing\n");
    return null;
  }

  // Just prove the rest of the goallist, recursively.
  return answerQuestion(goals, env2, db, level + 1, onReport);
}

function ExternalAndParse(thisTerm: Term, goals: Term[], env: Environment, db: Database, level: number, onReport: ReportFunction): FunctorResult {
  //print ("DEBUG: in External...\n");

  // Get the first term, the template.
  const first = value(thisTerm.partlist.list[0], env);
  if (first.type != "Atom") {
    //print("Debug: External needs First bound to a string Atom, failing\n");
    return null;
  }
  const regResult = first.name.match(/^"(.*)"$/);
  if (!regResult) return null;
  let r = regResult[1];

  //print("DEBUG: template for External/3 is "+r+"\n");

  // Get the second term, the argument list.
  let second: Part = value(thisTerm.partlist.list[1], env);
  let i = 1;
  while (second.type == "Term" && second.name == ops.cons) {
    // Go through second an argument at a time...
    const arg = value((second as Term).partlist.list[0], env);
    if (arg.type != "Atom") {
      //print("DEBUG: External/3: argument "+i+" must be an Atom, not "); arg.print(); print("\n");
      return null;
    }
    const re = new RegExp("\\$" + i, "g");
    //print("DEBUG: External/3: RegExp is "+re+", arg is "+arg.name+"\n");
    r = r.replace(re, arg.name);
    //print("DEBUG: External/3: r becomes "+r+"\n");
    second = (second as Term).partlist.list[1];
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

  // Convert back into a Prolog term by calling the appropriate Parse routine...
  const part = Partlist.parse1(new Tokeniser(ret));
  //print("DEBUG: external2, ret = "); ret.print(); print(".\n");

  const env2 = unify(thisTerm.partlist.list[2], part!, env);

  if (env2 == null) {
    //print("Debug: External/3 cannot unify OutValue with " + ret + ", failing\n");
    return null;
  }

  // Just prove the rest of the goallist, recursively.
  return answerQuestion(goals, env2, db, level + 1, onReport);
}

// run program
init();
commandLineEl.focus();
