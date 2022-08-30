
//declare global {
interface Document {
    input: HTMLFormElement;
    rules: HTMLFormElement;
    output: HTMLFormElement;
}
//}

// these aren't used in the regexes in  class Tokeniser !!
const enum ops {
    open = '[',
    close = ']',
    openList = '{',
    closeList = '}',
    sliceList = '|',
    endSentence = '.',
    endQuestion = '?',
    if = 'if',
    query = '?-',
    comment = '#',
    bodyTermSeparator = ',',
    paramSeparator = ',',
    cutCommit = 'commit',
}

const commandLineEl: HTMLInputElement = document.getElementById('commandline')! as HTMLInputElement;
const consoleOutEl: HTMLDivElement = document.getElementById('consoleout')! as HTMLDivElement;

function newConsoleLine(): HTMLDivElement {
    var elemDiv = document.createElement('div');
    elemDiv.innerHTML = '&nbsp;';
    consoleOutEl.appendChild(elemDiv);
    if (commandLineEl) commandLineEl.scrollIntoView();
    return elemDiv;
}

function print(str: string | number) {
    console.log(str);
    if (!str) return;
    const text = str.toString();
    const lines = text.split('\n');
    const multiline = lines.length > 1;
    for (const line of lines) {
        consoleOutEl.lastElementChild!.append(line);
        if (multiline) newConsoleLine();
    }
}

function printUserline(str: string) {
    const div = newConsoleLine();
    //div.classList.add('userdiv');
    div.innerHTML = '<span>' + str + '</span>';
    newConsoleLine();
}

function consoleOutError(...rest: (any)[]): null {
    const div = newConsoleLine();
    div.classList.add('errdiv');
    div.innerHTML = '<span class=err>' + rest.join(' ') + '</span>';
    newConsoleLine();
    return null;
}

type FunctorResult = null | boolean;
interface Functor {
    (thisTerm: Term, goalList: Term[], environment: Environment, db: Database, level: number, reportFunction: ReportFunction): FunctorResult;
}

type Database = Rule[] & { builtin?: { [key: string]: Functor } };
const database = [] as Database;


// called from HTML
function freeform() {
    print("\nAttaching builtins to database.\n");
    database.builtin = {};
    database.builtin["compare/3"] = Comparitor;
    database.builtin[ops.cutCommit + "/0"] = Commit;
    database.builtin["call/1"] = Call;
    database.builtin["fail/0"] = Fail;
    database.builtin["bagof/3"] = BagOf;
    database.builtin["external/3"] = ExternalJS;
    database.builtin["external2/3"] = ExternalAndParse;
    print("Attachments done.\n");

    print("Parsing rulesets.\n");
    nextlines(document.rules.rules.value);
}

function nextlines(text: string, el?: HTMLTextAreaElement) {
    if (el) el.value = '';
    const lines = text.split("\n");
    for (const line of lines)
        nextline(line);
}

// called from HTML
function nextline(line: string, el?: HTMLInputElement): Database {
    printUserline(line);
    if (!line) return database;
    if (el) el.value = '';
    if (line.substring(0, 1) == ops.comment || line == "" || line.match(/^\s*$/)) {
        return database;
    }
    const or = Rule.parse(new Tokeniser(line));
    if (or == null) return database;
    database.push(or);
    if (document.input.showparse.checked) or.print()
    if (or.asking && or.body) {
        const vs = varNames(or.body.list);
        answerQuestion(renameVariables(or.body.list, 0, []) as Term[], {} as Environment, database, 1, applyOne(printVars, vs));
    }
    if (el) el.scrollIntoView();
    return database;
}

// Functional programming bits... Currying and suchlike
function applyOne(f: Function, arg1: any) {
    return function (arg2: any) { return f(arg1, arg2); };
}

// Some auxiliary bits and pieces... environment-related.

// Print out an environment's contents.
function printEnv(env: { [key: string]: { print: () => void } } | null) {
    if (env == null) {
        print("null\n");
        return;
    }
    let k = false;
    for (var i in env) {
        k = true;
        print(" " + i + " = ");
        env[i].print();
        print("\n");
    }
    if (!k) print("true\n");
}

function printVars(which: Variable[], environment: Environment) {
    // Print bindings.
    if (which.length == 0) {
        print("true\n");
    } else {
        for (var i = 0; i < which.length; i++) {
            print(which[i].name);
            print(" = ");
            (value(new Variable(which[i].name + ".0"), environment)).print();
            print("\n");
        }
    }
    print("\n");
}

interface Environment { [key: string]: Part }


// The value of x in a given environment
function value(x: Part, env: Environment): Part {
    if (x.type == "Term") {
        const l = [];
        for (var i = 0; i < (x as Term).partlist.list.length; i++) {
            l[i] = value((x as Term).partlist.list[i], env);
        }
        return new Term(x.name, l);
    }
    if (x.type != "Variable") return x;		// We only need to check the values of variables...
    const binding = env[(x as Variable).name];
    if (binding == null) return x;		// Just the variable, no binding.
    return value(binding, env);
}

// Give a new environment from the old with "n" (a string variable name) bound to "z" (a part)
// Part is Atom|Term|Variable
function newEnv(n: string, z: Part, e: Environment): Environment {
    // We assume that n has been 'unwound' or 'followed' as far as possible
    // in the environment. If this is not the case, we could get an alias loop.
    const ne = {} as Environment;
    ne[n] = z;
    for (var i in e)
        if (i != n)
            ne[i] = e[i];
    return ne;
}

// More substantial utility functions.

// Unify two terms in the current environment. Returns a new environment.
// On failure, returns null.
function unify(x: Part, y: Part, env: Environment): Environment | null {
    x = value(x, env);
    y = value(y, env);
    if (x.type == "Variable") return newEnv(x.name, y, env);
    if (y.type == "Variable") return newEnv(y.name, x, env);
    if (x.type == "Atom" || y.type == "Atom")
        if (x.type == y.type && x.name == y.name)
            return env;
        else
            return null;

    // x.type == y.type == Term...
    if (x.name != y.name) return null;	// Ooh, so first-order.
    if ((x as Term).partlist.list.length != (y as Term).partlist.list.length) return null;

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
    if (!Array.isArray(list)) {
        if (list.type == "Atom") {
            return list;
        } else if (list.type == "Variable") {
            return new Variable(list.name + "." + level);
        } else if (list.type == "Term") {
            let out = new Term(list.name, renameVariables((list as Term).partlist.list, level, parent) as Part[]);
            out.parent = parent as Term;
            return out;
        }
        return [];
    } else {
        let out: Part[] = [];

        for (var i = 0; i < list.length; i++) {
            out[i] = renameVariables(list[i], level, parent) as Part;
            /*
                    if (list[i].type == "Atom") {
                        out[i] = list[i];
                    } else if (list[i].type == "Variable") {
                        out[i] = new Variable(list[i].name + "." + level);
                    } else if (list[i].type == "Term") {
                        (out[i] = new Term(list[i].name, renameVariables(list[i].partlist.list, level, parent))).parent = parent;
                    }
            */
        }

        return out;
    }
}

// Return a list of all variables mentioned in a list of Terms.
function varNames(list: Part[]): (Variable | Term)[] {
    const out: (Variable | Term)[] = [];

    main: for (var i = 0; i < list.length; i++) {
        if (list[i].type == "Variable") {
            for (var j = 0; j < out.length; j++)
                if (out[j].name == list[i].name) continue main;
            out[out.length] = list[i] as Variable;
        } else if (list[i].type == "Term") {
            const o2 = varNames((list[i] as Term).partlist.list);
            inner: for (var j = 0; j < o2.length; j++) {
                for (var k = 0; k < out.length; k++)
                    if (o2[j].name == out[k].name) continue inner;
                out[out.length] = o2[j];
            }
        } // else Atom but nothing to do...
    }
    return out;
}

// The meat of this thing... js-tinyProlog.
// The main proving engine. Returns: null (keep going), other (drop out)
function answerQuestion(goalList: Term[], environment: Environment, db: Database, level: number, reportFunction: ReportFunction): FunctorResult {
    //DEBUG: print ("in main prove...\n");
    if (goalList.length == 0) {
        reportFunction(environment);

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
        return builtin(thisTerm, newGoals, environment, db, level + 1, reportFunction);
    }

    for (var i = 0; i < db.length; i++) {
        //print ("Debug: in rule selection. thisTerm = "); thisTerm.print(); print ("\n");
        if (thisTerm.excludeRule == i) {
            // print("DEBUG: excluding rule number "+i+" in attempt to satisfy "); thisTerm.print(); print("\n");
            continue;
        }

        const rule: Rule = db[i];
        if (!rule.head) continue;

        // We'll need better unification to allow the 2nd-order
        // rule matching ... later.
        if (rule.head.name != thisTerm.name) continue;

        // Rename the variables in the head and body
        const renamedHead = new Term(rule.head.name, renameVariables(rule.head.partlist.list, level, thisTerm) as Part[]);
        // renamedHead.ruleNumber = i;

        const env2 = unify(thisTerm, renamedHead, environment);
        if (env2 == null) continue;

        const body = rule.body;
        if (body != null) {
            const newFirstGoals = renameVariables(rule.body!.list, level, renamedHead) as Part[];
            // Stick the new body list
            let newGoals: Term[] = [];
            let j: number, k: number;
            for (j = 0; j < newFirstGoals.length; j++) {
                newGoals[j] = newFirstGoals[j] as Term;
                if (rule.body!.list[j].excludeThis) newGoals[j].excludeRule = i;
            }
            for (k = 1; k < goalList.length; k++) newGoals[j++] = goalList[k];
            const ret = answerQuestion(newGoals, env2, db, level + 1, reportFunction);
            if (ret != null) return ret;
        } else {
            // Just prove the rest of the goallist, recursively.
            let newGoals: Term[] = [];
            let j: number;
            for (j = 1; j < goalList.length; j++) newGoals[j - 1] = goalList[j];
            const ret = answerQuestion(newGoals, env2, db, level + 1, reportFunction);
            if (ret != null) return ret;
        }

        if (renamedHead.commit) {
            //print ("Debug: this goal "); thisTerm.print(); print(" has been committed.\n");
            break;
        }
        if (thisTerm.parent.commit) {
            //print ("Debug: parent goal "); thisTerm.parent.print(); print(" has been committed.\n");
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
    name: string;
    print: () => void;
    type: 'Variable';

    constructor(head: string) {
        this.name = head;
        this.print = function () { print(this.name); };
        this.type = "Variable";
    }
}

class Atom {
    name: string;
    print: () => void;
    type: 'Atom';

    constructor(head: string) {
        this.name = head;
        this.print = function () { print(this.name); };
        this.type = "Atom";
    }
}

class Term {
    name: string;
    type: "Term";
    partlist: Partlist;
    excludeThis?: boolean;
    excludeRule?: number;
    parent: Term;
    commit?: boolean;

    constructor(head: string, list: Part[]) {
        this.name = head;
        this.partlist = new Partlist(list);
        this.type = "Term";
        this.parent = this;
    }

    print() {
        if (this.name == "cons") {
            let part: Part = this;
            while (part.type == "Term" && part.name == "cons" && (part as Term).partlist.list.length == 2) {
                part = (part as Term).partlist.list[1];
            }
            if ((part.type == "Atom" && part.name == "nothing") || part.type == "Variable") {
                part = this;
                print(ops.openList);
                let com = false;
                while (part.type == "Term" && part.name == "cons" && (part as Term).partlist.list.length == 2) {
                    if (com) print(", ");
                    (part as Term).partlist.list[0].print();
                    com = true;
                    part = (part as Term).partlist.list[1];
                }
                if (part.type == "Variable") {
                    print(" " + ops.sliceList + " ");
                    part.print();
                }
                print(ops.closeList);
                return;
            }
        }
        print(ops.open + this.name);
        this.partlist.print();
        print(ops.close);
    };

    static parse(tk: Tokeniser): Term | null {
        // Term -> [NOTTHIS] id ( optParamList )

        if (/*tk.type == "id" && */tk.current == ops.cutCommit) {
            // Parse bareword commit as commit/0
            tk = tk.consume();
            return new Term(ops.cutCommit, []);
        }

        let notthis = false;
        if (tk.current == "NOTTHIS") {
            notthis = true;
            tk = tk.consume();
        }

        if (tk.type != "punc" || tk.current != ops.open) return consoleOutError("expected [ to begin");
        tk = tk.consume();

        if (tk.type != "id") return consoleOutError("expected first term to be a symbol / bare word");

        const name = tk.current;
        tk = tk.consume();

        if (tk.current == ",") tk = tk.consume();
        else if (tk.current != "]") return consoleOutError("expected , or ] after first term. Current=", tk.current);

        const parts: Part[] = [];
        while (tk.current != "]") {
            if (tk.type == "eof") return consoleOutError('unexpected EOF while running through terms until', ops.close);

            const part = Partlist.parse1(tk);
            if (part == null) return consoleOutError("part didn't parse at", tk.current, "remaining:", tk.remainder);

            if (tk.current == ",") tk = tk.consume();
            else if (tk.current != "]") return consoleOutError("a term, a part, ended before the , or the ]   remaining: ", tk.remainder);

            parts.push(part);
        }
        tk = tk.consume();

        const term = new Term(name!, parts);
        if (notthis) term.excludeThis = true;
        return term;
    }

}

class Partlist {
    list: Part[];

    constructor(list: Part[]) {
        this.list = list;
    }

    print() {
        for (let i = 0; i < this.list.length; i++) {
            print(", ");
            this.list[i].print();
        }
    };

    // This was a beautiful piece of code. It got kludged to add [a,b,c|Z] sugar.
    static parse1(tk: Tokeniser): Part | null {
        // Part -> var | id | id(optParamList)
        // Part -> [ listBit ] ::-> cons(...)

        if (tk.type == "var") {
            const varName = tk.current;
            tk = tk.consume();
            return new Variable(varName!);
        }

        if (tk.type == "punc" && tk.current == ops.openList) {
            tk = tk.consume();

            // destructure a list

            // Special case: {} = new atom(nothing).
            if (tk.type == "punc" && tk.current == ops.closeList) {
                tk = tk.consume();
                return new Atom("nothing");
            }

            // Get a list of parts into l
            const parts = [];
            let i = 0;

            while (true) {
                const part = Partlist.parse1(tk);
                if (part == null) return consoleOutError("subpart didn't parse:", tk.current);

                parts[i++] = part;
                if (tk.current != ",") break;
                tk = tk.consume();
            }

            // Find the end of the list ... "| Var }" or "}".
            let append: Part;
            if (tk.current == ops.sliceList) {
                tk = tk.consume();
                if (tk.type != "var") return consoleOutError(ops.sliceList, " wasn't followed by a var");
                append = new Variable(tk.current!);
                tk = tk.consume();
            } else {
                append = new Atom("nothing");
            }
            if (tk.current != ops.closeList) return consoleOutError("list destructure wasn't ended by }");
            tk = tk.consume();
            // Return the new cons.... of all this rubbish.
            for (--i; i >= 0; i--) append = new Term("cons", [parts[i], append]);
            return append;
        }

        const openbracket = (tk.type == 'punc' && tk.current == ops.open)
        if (openbracket) tk = tk.consume();

        const name = tk.current;
        tk = tk.consume();

        if (!openbracket) return new Atom(name!);

        if (tk.current != ',') return consoleOutError("expected , after symbol");
        tk = tk.consume();

        const parts = [];
        let i = 0;
        while (tk.current != ops.close) {
            if (tk.type == "eof") return null;

            const part = Partlist.parse1(tk);
            if (part == null) return null;

            if (tk.current == ",") tk = tk.consume();
            else if (tk.current != ops.close) return null;

            // Add the current Part onto the list...
            parts[i++] = part;
        }
        tk = tk.consume();

        return new Term(name!, parts);
    }

}

class Body {
    list: Term[];

    constructor(list: Term[]) {
        this.list = list;
    }

    print() {
        for (var i = 0; i < this.list.length; i++) {
            this.list[i].print();
            if (i < this.list.length - 1)
                print(", ");
        }
    }
}

class Rule {
    head: Term | null;
    body: Body | null;
    asking: boolean;

    constructor(head: Term, bodylist: Term[] | null = null, isQuestion: boolean = false) {
        if (isQuestion) {
            this.head = null;
            this.body = new Body(bodylist != null ? [head].concat(bodylist) : [head]);
            this.asking = isQuestion;
        }
        else {
            this.head = head;
            this.body = (bodylist != null) ? new Body(bodylist) : null;
            this.asking = isQuestion;
        }
    }

    print() {
        if (this.head != null)
            this.head.print();
        if (this.head && this.body)
            print(" " + ops.if + " ");
        if (this.body != null)
            this.body.print();
        print((this.asking ? ops.endQuestion : ops.endSentence) + "\n");
    }

    static parse(tk: Tokeniser): Rule | null {
        // A rule is a Head followed by . or by :- Body

        const h = Rule.parseHead(tk);
        if (!h) return null;

        if (tk.current == ops.endSentence) {
            // A simple rule.
            return new Rule(h);
        }

        const endQuestionNow = tk.current == ops.endQuestion;
        const isQuestion = tk.current == ops.endQuestion || tk.current == ops.bodyTermSeparator;
        if (tk.current != ops.if && !isQuestion) return consoleOutError("expected one of", [ops.if, ops.endQuestion, ops.endSentence, ops.bodyTermSeparator].join(' '), " but found", tk.remainder);

        tk = tk.consume();
        const b = endQuestionNow ? null : Rule.parseBody(tk);

        if (!endQuestionNow && tk.current != ops.endSentence && tk.current != ops.endQuestion)
            return consoleOutError("expected one of", ops.endSentence, ops.endQuestion, " but remaining:", tk.remainder);

        return new Rule(h, b, isQuestion);
    }

    static parseHead(tk: Tokeniser): Term | null {

        // is query? so, no head.
        if (tk.type == 'punc' && tk.current == ops.query) {
            return new Term(ops.query, []);
        }

        // A head is simply a term. (errors cascade back up)
        return Term.parse(tk);
    }

    static parseBody(tk: Tokeniser): Term[] | null {
        // Body -> Term {, Term...}
        const terms: Term[] = [];
        let i = 0;

        let term: Term | null;
        while ((term = Term.parse(tk)) != null) {
            terms[i++] = term;
            if (tk.current != ",") break;
            tk = tk.consume();
        }

        if (i == 0) return null;
        return terms;
    }

}


// The Tiny-Prolog parser goes here.
class Tokeniser {
    remainder: string;
    current: string | null;
    type: null | "eof" | "id" | "var" | "punc";

    constructor(string: string) {
        this.remainder = string;
        this.current = null;
        this.type = null;	// "eof", "id", "var", "punc" etc.
        this.consume();	// Load up the first token.
    }

    consume(): this {
        if (this.type == "eof") return this;

        // Eat any leading WS
        let r: RegExpMatchArray | null = this.remainder.match(/^\s*(.*)$/);
        if (r) {
            this.remainder = r[1];
        }

        if (this.remainder == "") {
            this.current = null;
            this.type = "eof";
            return this;
        }

        // punctuation   openList {  closeList }  endSentence .  ummm ,  open [ close ] sliceList | ummm !  if if  query ?-
        r = this.remainder.match(/^([\{\}\.,\[\]\|\!]|\bif\b|\?\-)(.*)$/);
        if (r) {
            this.remainder = r[2];
            this.current = r[1];
            this.type = "punc";
            return this;
        }

        // variable    including ? as varName
        r = this.remainder.match(/^([A-Z_][a-zA-Z0-9_]*|\?)(.*)$/);
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

        // eof?
        this.current = null;
        this.type = "eof";
        return this;
    };
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
function Call(thisTerm: Term, goalList: Term[], environment: Environment, db: Database, level: number, reportFunction: ReportFunction): FunctorResult {
    // Prove the builtin bit, then break out and prove
    // the remaining goalList.

    // Rename the variables in the head and body
    // var renamedHead = new Term(rule.head.name, renameVariables(rule.head.partlist.list, level));

    const first: Part = value(thisTerm.partlist.list[0], environment);
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
    for (j = 0; j < goalList.length; j++) newGoals[j + 1] = goalList[j];

    // Just prove the rest of the goallist, recursively.
    return answerQuestion(newGoals, environment, db, level + 1, reportFunction);
}

function Fail(thisTerm: Term, goalList: Term[], environment: Environment, db: Database, level: number, reportFunction: ReportFunction): null {
    return null;
}

type AnswerList = Part[] & { renumber?: number };

function BagOf(thisTerm: Term, goalList: Term[], environment: Environment, db: Database, level: number, reportFunction: ReportFunction): FunctorResult {
    // bagof(Term, ConditionTerm, ReturnList)

    let collect: Part = value(thisTerm.partlist.list[0], environment);
    const subgoal = value(thisTerm.partlist.list[1], environment) as Term;
    const into = value(thisTerm.partlist.list[2], environment);

    collect = renameVariables(collect, level, thisTerm) as Part;
    const newGoal = new Term(subgoal.name, renameVariables(subgoal.partlist.list, level, thisTerm) as Part[]);
    newGoal.parent = thisTerm;

    const newGoals = [];
    newGoals[0] = newGoal;

    // Prove this subgoal, collecting up the environments...
    const anslist = [] as AnswerList;
    anslist.renumber = -1;
    const ret = answerQuestion(newGoals, environment, db, level + 1, BagOfCollectFunction(collect, anslist));

    // Turn anslist into a proper list and unify with 'into'

    // optional here: nothing anslist -> fail?
    let answers: Part = new Atom("nothing");

    /*
    print("Debug: anslist = [");
        for (var j = 0; j < anslist.length; j++) {
            anslist[j].print();
            print(", ");
        }
    print("]\n");
    */

    for (var i = anslist.length; i > 0; i--)
        answers = new Term("cons", [anslist[i - 1], answers]);

    //print("Debug: unifying "); into.print(); print(" with "); answers.print(); print("\n");
    const env2 = unify(into, answers, environment);

    if (env2 == null) {
        //print("Debug: bagof cannot unify anslist with "); into.print(); print(", failing\n");
        return null;
    }

    // Just prove the rest of the goallist, recursively.
    return answerQuestion(goalList, env2, db, level + 1, reportFunction);
}

interface ReportFunction {
    (env: Environment): void;
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

function ExternalJS(thisTerm: Term, goalList: Term[], environment: Environment, db: Database, level: number, reportFunction: ReportFunction): FunctorResult {
    //print ("DEBUG: in External...\n");

    // Get the first term, the template.
    const first = value(thisTerm.partlist.list[0], environment);
    if (first.type != "Atom") {
        //print("Debug: External needs First bound to a string Atom, failing\n");
        return null;
    }
    const regresult = first.name.match(/^"(.*)"$/);
    if (!regresult) return null;
    let r = regresult[1];

    //print("DEBUG: template for External/3 is "+r+"\n");

    // Get the second term, the argument list.
    let second: Part = value(thisTerm.partlist.list[1], environment);
    let i = 1;
    while (second.type == "Term" && second.name == "cons") {
        // Go through second an argument at a time...
        const arg = value((second as Term).partlist.list[0], environment);
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
    if (second.type != "Atom" || second.name != "nothing") {
        //print("DEBUG: External/3 needs second to be a list, not "); second.print(); print("\n");
        return null;
    }

    //print("DEBUG: External/3 about to eval \""+r+"\"\n");

    let ret: string;
    // @ts-ignore
    with (EvalContext) ret = eval(r);

    //print("DEBUG: External/3 got "+ret+" back\n");

    if (!ret) ret = "nothing";


    // Convert back into an atom...
    const env2 = unify(thisTerm.partlist.list[2], new Atom(ret), environment);

    if (env2 == null) {
        //print("Debug: External/3 cannot unify OutValue with " + ret + ", failing\n");
        return null;
    }

    // Just prove the rest of the goallist, recursively.
    return answerQuestion(goalList, env2, db, level + 1, reportFunction);
}

function ExternalAndParse(thisTerm: Term, goalList: Term[], environment: Environment, db: Database, level: number, reportFunction: ReportFunction): FunctorResult {
    //print ("DEBUG: in External...\n");

    // Get the first term, the template.
    const first = value(thisTerm.partlist.list[0], environment);
    if (first.type != "Atom") {
        //print("Debug: External needs First bound to a string Atom, failing\n");
        return null;
    }
    const regResult = first.name.match(/^"(.*)"$/);
    if (!regResult) return null;
    let r = regResult[1];

    //print("DEBUG: template for External/3 is "+r+"\n");

    // Get the second term, the argument list.
    let second: Part = value(thisTerm.partlist.list[1], environment);
    let i = 1;
    while (second.type == "Term" && second.name == "cons") {
        // Go through second an argument at a time...
        const arg = value((second as Term).partlist.list[0], environment);
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
    if (second.type != "Atom" || second.name != "nothing") {
        //print("DEBUG: External/3 needs second to be a list, not "); second.print(); print("\n");
        return null;
    }

    //print("DEBUG: External/3 about to eval \""+r+"\"\n");

    let ret: string;
    // @ts-ignore
    with (EvalContext) ret = eval(r);

    //print("DEBUG: External/3 got "+ret+" back\n");

    if (!ret) ret = "nothing";


    // Convert back into a Prolog term by calling the appropriate Parse routine...
    const part = Partlist.parse1(new Tokeniser(ret));
    //print("DEBUG: external2, ret = "); ret.print(); print(".\n");

    const env2 = unify(thisTerm.partlist.list[2], part!, environment);

    if (env2 == null) {
        //print("Debug: External/3 cannot unify OutValue with " + ret + ", failing\n");
        return null;
    }

    // Just prove the rest of the goallist, recursively.
    return answerQuestion(goalList, env2, db, level + 1, reportFunction);
}

freeform();
commandLineEl.focus();
