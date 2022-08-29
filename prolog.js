const commandLineEl = document.getElementById('commandline');
const consoleOutEl = document.getElementById('consoleout');
function newConsoleLine() {
    var elemDiv = document.createElement('div');
    elemDiv.innerHTML = '&nbsp;';
    consoleOutEl.appendChild(elemDiv);
    if (commandLineEl)
        commandLineEl.scrollIntoView();
    return elemDiv;
}
function print(str) {
    console.log(str);
    if (!str)
        return;
    const text = str.toString();
    const lines = text.split('\n');
    const multiline = lines.length > 1;
    for (const line of lines) {
        consoleOutEl.lastElementChild.append(line);
        if (multiline)
            newConsoleLine();
    }
}
function printUserline(str) {
    const div = newConsoleLine();
    //div.classList.add('errdiv');
    div.innerHTML = '<span>' + str + '</span>';
    newConsoleLine();
}
function consoleOutError(...rest) {
    const div = newConsoleLine();
    div.classList.add('errdiv');
    div.innerHTML = '<span class=err>' + rest.join(' ') + '</span>';
    newConsoleLine();
}
const database = [];
// called from HTML
function freeform() {
    print("\nAttaching builtins to database.\n");
    database.builtin = {};
    database.builtin["compare/3"] = Comparitor;
    database.builtin["cut/0"] = Cut;
    database.builtin["call/1"] = Call;
    database.builtin["fail/0"] = Fail;
    database.builtin["bagof/3"] = BagOf;
    database.builtin["external/3"] = ExternalJS;
    database.builtin["external2/3"] = ExternalAndParse;
    print("Attachments done.\n");
    print("Parsing rulesets.\n");
    nextlines(document.rules.rules.value);
}
function nextlines(text, el) {
    if (el)
        el.value = '';
    const lines = text.split("\n");
    for (const line of lines)
        nextline(line);
}
// called from HTML
function nextline(line, el) {
    printUserline(line);
    if (!line)
        return database;
    if (el)
        el.value = '';
    if (line.substring(0, 1) == "#" /* comment */ || line == "" || line.match(/^\s*$/)) {
        return database;
    }
    const or = Rule.parse(new Tokeniser(line));
    if (or == null)
        return database;
    database.push(or);
    if (document.input.showparse.checked)
        or.print();
    if (or.asking && or.body) {
        const vs = varNames(or.body.list);
        answerQuestion(renameVariables(or.body.list, 0, []), {}, database, 1, applyOne(printVars, vs));
    }
    if (el)
        el.scrollIntoView();
    return database;
}
// Functional programming bits... Currying and suchlike
function applyOne(f, arg1) {
    return function (arg2) { return f(arg1, arg2); };
}
// Some auxiliary bits and pieces... environment-related.
// Print out an environment's contents.
function printEnv(env) {
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
    if (!k)
        print("true\n");
}
function printVars(which, environment) {
    // Print bindings.
    if (which.length == 0) {
        print("true\n");
    }
    else {
        for (var i = 0; i < which.length; i++) {
            print(which[i].name);
            print(" = ");
            (value(new Variable(which[i].name + ".0"), environment)).print();
            print("\n");
        }
    }
    print("\n");
}
// The value of x in a given environment
function value(x, env) {
    if (x.type == "Term") {
        const l = [];
        for (var i = 0; i < x.partlist.list.length; i++) {
            l[i] = value(x.partlist.list[i], env);
        }
        return new Term(x.name, l);
    }
    if (x.type != "Variable")
        return x; // We only need to check the values of variables...
    const binding = env[x.name];
    if (binding == null)
        return x; // Just the variable, no binding.
    return value(binding, env);
}
// Give a new environment from the old with "n" (a string variable name) bound to "z" (a part)
// Part is Atom|Term|Variable
function newEnv(n, z, e) {
    // We assume that n has been 'unwound' or 'followed' as far as possible
    // in the environment. If this is not the case, we could get an alias loop.
    const ne = {};
    ne[n] = z;
    for (var i in e)
        if (i != n)
            ne[i] = e[i];
    return ne;
}
// More substantial utility functions.
// Unify two terms in the current environment. Returns a new environment.
// On failure, returns null.
function unify(x, y, env) {
    x = value(x, env);
    y = value(y, env);
    if (x.type == "Variable")
        return newEnv(x.name, y, env);
    if (y.type == "Variable")
        return newEnv(y.name, x, env);
    if (x.type == "Atom" || y.type == "Atom")
        if (x.type == y.type && x.name == y.name)
            return env;
        else
            return null;
    // x.type == y.type == Term...
    if (x.name != y.name)
        return null; // Ooh, so first-order.
    if (x.partlist.list.length != y.partlist.list.length)
        return null;
    for (var i = 0; i < x.partlist.list.length; i++) {
        env = unify(x.partlist.list[i], y.partlist.list[i], env);
        if (env == null)
            return null;
    }
    return env;
}
// Go through a list of terms (ie, a Body or Partlist's list) renaming variables
// by appending 'level' to each variable name.
// How non-graph-theoretical can this get?!?
// "parent" points to the subgoal, the expansion of which lead to these terms.
function renameVariables(list, level, parent) {
    if (!Array.isArray(list)) {
        if (list.type == "Atom") {
            return list;
        }
        else if (list.type == "Variable") {
            return new Variable(list.name + "." + level);
        }
        else if (list.type == "Term") {
            let out = new Term(list.name, renameVariables(list.partlist.list, level, parent));
            out.parent = parent;
            return out;
        }
        return [];
    }
    else {
        let out = [];
        for (var i = 0; i < list.length; i++) {
            out[i] = renameVariables(list[i], level, parent);
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
function varNames(list) {
    const out = [];
    main: for (var i = 0; i < list.length; i++) {
        if (list[i].type == "Variable") {
            for (var j = 0; j < out.length; j++)
                if (out[j].name == list[i].name)
                    continue main;
            out[out.length] = list[i];
        }
        else if (list[i].type == "Term") {
            const o2 = varNames(list[i].partlist.list);
            inner: for (var j = 0; j < o2.length; j++) {
                for (var k = 0; k < out.length; k++)
                    if (o2[j].name == out[k].name)
                        continue inner;
                out[out.length] = o2[j];
            }
        }
    }
    return out;
}
// The meat of this thing... js-tinyProlog.
// Don't expect built-ins at present. To come:
//	unification of term heads, cut, fail, call, bagof
//	(in that order, probably).
// The main proving engine. Returns: null (keep going), other (drop out)
function answerQuestion(goalList, environment, db, level, reportFunction) {
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
    const builtin = db.builtin[thisTerm.name + "/" + thisTerm.partlist.list.length];
    // print ("Debug: searching for builtin "+thisTerm.name+"/"+thisTerm.partlist.list.length+"\n");
    if (builtin) {
        //print ("builtin with name " + thisTerm.name + " found; calling prove() on it...\n");
        // Stick the new body list
        let newGoals = [];
        let j;
        for (j = 1; j < goalList.length; j++)
            newGoals[j - 1] = goalList[j];
        return builtin(thisTerm, newGoals, environment, db, level + 1, reportFunction);
    }
    for (var i = 0; i < db.length; i++) {
        //print ("Debug: in rule selection. thisTerm = "); thisTerm.print(); print ("\n");
        if (thisTerm.excludeRule == i) {
            // print("DEBUG: excluding rule number "+i+" in attempt to satisfy "); thisTerm.print(); print("\n");
            continue;
        }
        const rule = db[i];
        // We'll need better unification to allow the 2nd-order
        // rule matching ... later.
        if (rule.head.name != thisTerm.name)
            continue;
        // Rename the variables in the head and body
        const renamedHead = new Term(rule.head.name, renameVariables(rule.head.partlist.list, level, thisTerm));
        // renamedHead.ruleNumber = i;
        const env2 = unify(thisTerm, renamedHead, environment);
        if (env2 == null)
            continue;
        const body = rule.body;
        if (body != null) {
            const newFirstGoals = renameVariables(rule.body.list, level, renamedHead);
            // Stick the new body list
            let newGoals = [];
            let j, k;
            for (j = 0; j < newFirstGoals.length; j++) {
                newGoals[j] = newFirstGoals[j];
                if (rule.body.list[j].excludeThis)
                    newGoals[j].excludeRule = i;
            }
            for (k = 1; k < goalList.length; k++)
                newGoals[j++] = goalList[k];
            const ret = answerQuestion(newGoals, env2, db, level + 1, reportFunction);
            if (ret != null)
                return ret;
        }
        else {
            // Just prove the rest of the goallist, recursively.
            let newGoals = [];
            let j;
            for (j = 1; j < goalList.length; j++)
                newGoals[j - 1] = goalList[j];
            const ret = answerQuestion(newGoals, env2, db, level + 1, reportFunction);
            if (ret != null)
                return ret;
        }
        if (renamedHead.cut) {
            //print ("Debug: this goal "); thisTerm.print(); print(" has been cut.\n");
            break;
        }
        if (thisTerm.parent.cut) {
            //print ("Debug: parent goal "); thisTerm.parent.print(); print(" has been cut.\n");
            break;
        }
    }
    return null;
}
class Variable {
    constructor(head) {
        this.name = head;
        this.print = function () { print(this.name); };
        this.type = "Variable";
    }
}
class Atom {
    constructor(head) {
        this.name = head;
        this.print = function () { print(this.name); };
        this.type = "Atom";
    }
}
class Term {
    constructor(head, list) {
        this.name = head;
        this.partlist = new Partlist(list);
        this.type = "Term";
        this.parent = this;
    }
    print() {
        if (this.name == "cons") {
            let part = this;
            while (part.type == "Term" && part.name == "cons" && part.partlist.list.length == 2) {
                part = part.partlist.list[1];
            }
            if ((part.type == "Atom" && part.name == "nothing") || part.type == "Variable") {
                part = this;
                print("{" /* openList */);
                let com = false;
                while (part.type == "Term" && part.name == "cons" && part.partlist.list.length == 2) {
                    if (com)
                        print(", ");
                    part.partlist.list[0].print();
                    com = true;
                    part = part.partlist.list[1];
                }
                if (part.type == "Variable") {
                    print(" " + "|" /* sliceList */ + " ");
                    part.print();
                }
                print("}" /* closeList */);
                return;
            }
        }
        print("[" /* open */ + this.name);
        this.partlist.print();
        print("]" /* close */);
    }
    ;
    static parse(tk) {
        // Term -> [NOTTHIS] id ( optParamList )
        if (tk.type == "punc" && tk.current == "!") {
            // Parse ! as cut/0
            tk = tk.consume();
            return new Term("cut", []);
        }
        let notthis = false;
        if (tk.current == "NOTTHIS") {
            notthis = true;
            tk = tk.consume();
        }
        if (tk.type != "punc" || tk.current != "[" /* open */) {
            consoleOutError("expected [ to begin");
            return null;
        }
        tk = tk.consume();
        if (tk.type != "id") {
            consoleOutError("expected first term to be a symbol / bare word");
            return null;
        }
        const name = tk.current;
        tk = tk.consume();
        if (tk.current == ",")
            tk = tk.consume();
        else if (tk.current != "]") {
            consoleOutError("expected , or ] after first term. Current=", tk.current);
            return null;
        }
        const parts = [];
        let i = 0;
        while (tk.current != "]") {
            if (tk.type == "eof") {
                consoleOutError('unexpected EOF while running through terms until ]');
                return null;
            }
            const part = Partlist.parse1(tk);
            if (part == null) {
                consoleOutError("part didn't parse at", tk.current, "\nremainder:", tk.remainder);
                return null;
            }
            if (tk.current == ",")
                tk = tk.consume();
            else if (tk.current != "]")
                return null;
            // Add the current Part onto the list...
            parts[i++] = part;
        }
        tk = tk.consume();
        const term = new Term(name, parts);
        if (notthis)
            term.excludeThis = true;
        return term;
    }
}
class Partlist {
    constructor(list) {
        this.list = list;
    }
    print() {
        for (let i = 0; i < this.list.length; i++) {
            print(", ");
            this.list[i].print();
        }
    }
    ;
    // This was a beautiful piece of code. It got kludged to add [a,b,c|Z] sugar.
    static parse1(tk) {
        // Part -> var | id | id(optParamList)
        // Part -> [ listBit ] ::-> cons(...)
        if (tk.type == "var") {
            const varName = tk.current;
            tk = tk.consume();
            return new Variable(varName);
        }
        if (tk.type == "punc" && tk.current == "{" /* openList */) {
            tk = tk.consume();
            // destructure a list
            // Special case: {} = new atom(nothing).
            if (tk.type == "punc" && tk.current == "}" /* closeList */) {
                tk = tk.consume();
                return new Atom("nothing");
            }
            // Get a list of parts into l
            const parts = [];
            let i = 0;
            while (true) {
                const part = Partlist.parse1(tk);
                if (part == null) {
                    consoleOutError("subpart didn't parse:", tk.current);
                    return null;
                }
                parts[i++] = part;
                if (tk.current != ",")
                    break;
                tk = tk.consume();
            }
            // Find the end of the list ... "| Var }" or "}".
            let append;
            if (tk.current == "|" /* sliceList */) {
                tk = tk.consume();
                if (tk.type != "var") {
                    consoleOutError("|" /* sliceList */, " wasn't followed by a var");
                    return null;
                }
                append = new Variable(tk.current);
                tk = tk.consume();
            }
            else {
                append = new Atom("nothing");
            }
            if (tk.current != "}" /* closeList */) {
                consoleOutError("list destructure wasn't ended by }");
                return null;
            }
            tk = tk.consume();
            // Return the new cons.... of all this rubbish.
            for (--i; i >= 0; i--)
                append = new Term("cons", [parts[i], append]);
            return append;
        }
        const openbracket = (tk.type == 'punc' && tk.current == "[" /* open */);
        if (openbracket)
            tk = tk.consume();
        const name = tk.current;
        tk = tk.consume();
        if (!openbracket)
            return new Atom(name);
        if (tk.current != ',') {
            consoleOutError("expected , after symbol");
            return null;
        }
        tk = tk.consume();
        const parts = [];
        let i = 0;
        while (tk.current != "]" /* close */) {
            if (tk.type == "eof")
                return null;
            const part = Partlist.parse1(tk);
            if (part == null)
                return null;
            if (tk.current == ",")
                tk = tk.consume();
            else if (tk.current != "]" /* close */)
                return null;
            // Add the current Part onto the list...
            parts[i++] = part;
        }
        tk = tk.consume();
        return new Term(name, parts);
    }
}
class Body {
    constructor(list) {
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
    constructor(head, bodylist = null, isQuestion = false) {
        this.head = head;
        if (bodylist != null)
            this.body = new Body(bodylist);
        else
            this.body = null;
        this.asking = isQuestion;
    }
    print() {
        if (this.body == null) {
            this.head.print();
            print("." /* endSentence */ + "\n");
        }
        else {
            if (!this.asking)
                this.head.print();
            print(" " + (this.asking ? "?-" /* query */ : "if" /* if */) + " ");
            this.body.print();
            print("." /* endSentence */ + "\n");
        }
    }
    static parse(tk) {
        // A rule is a Head followed by . or by :- Body
        const h = Rule.parseHead(tk);
        if (!h)
            return null;
        if (tk.current == "." /* endSentence */) {
            // A simple rule.
            return new Rule(h);
        }
        const isQuestion = tk.current == "?-" /* query */;
        if (tk.current != "if" /* if */ && !isQuestion)
            return null;
        tk = tk.consume();
        const b = Rule.parseBody(tk);
        if (tk.current != "." /* endSentence */ && tk.current != "?" /* endQuestion */ && tk.current != "#" /* comment */ && !isQuestion) {
            consoleOutError("expected", "." /* endSentence */, " but remaining:", tk.remainder);
            return null;
        }
        return new Rule(h, b, isQuestion);
    }
    static parseHead(tk) {
        // is query? so, no head.
        if (tk.type == 'punc' && tk.current == "?-" /* query */) {
            return new Term("?-" /* query */, []);
        }
        // A head is simply a term. (errors cascade back up)
        return Term.parse(tk);
    }
    static parseBody(tk) {
        // Body -> Term {, Term...}
        const terms = [];
        let i = 0;
        let term;
        while ((term = Term.parse(tk)) != null) {
            terms[i++] = term;
            if (tk.current != ",")
                break;
            tk = tk.consume();
        }
        if (i == 0)
            return null;
        return terms;
    }
}
// The Tiny-Prolog parser goes here.
class Tokeniser {
    constructor(string) {
        this.remainder = string;
        this.current = null;
        this.type = null; // "eof", "id", "var", "punc" etc.
        this.consume(); // Load up the first token.
    }
    consume() {
        if (this.type == "eof")
            return this;
        // Eat any leading WS
        let r = this.remainder.match(/^\s*(.*)$/);
        if (r) {
            this.remainder = r[1];
        }
        if (this.remainder == "") {
            this.current = null;
            this.type = "eof";
            return this;
        }
        // punctuation   {  }  .  ,  [  ]  |  !  :- ?-
        r = this.remainder.match(/^([\{\}\.,\[\]\|\!]|\bif\b|\?\-)(.*)$/);
        if (r) {
            this.remainder = r[2];
            this.current = r[1];
            this.type = "punc";
            return this;
        }
        // variable
        r = this.remainder.match(/^([A-Z_][a-zA-Z0-9_]*)(.*)$/);
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
    }
    ;
}
// A sample builtin function, including all the bits you need to get it to work
// within the general proving mechanism.
// compare(First, Second, CmpValue)
// First, Second must be bound to strings here.
// CmpValue is bound to -1, 0, 1
function Comparitor(thisTerm, goalList, environment, db, level, reportFunction) {
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
    if (first.name < second.name)
        cmp = "lt";
    else if (first.name > second.name)
        cmp = "gt";
    const env2 = unify(thisTerm.partlist.list[2], new Atom(cmp), environment);
    if (env2 == null) {
        //print("Debug: Comparitor cannot unify CmpValue with " + cmp + ", failing\n");
        return null;
    }
    // Just prove the rest of the goallist, recursively.
    return answerQuestion(goalList, env2, db, level + 1, reportFunction);
}
function Cut(thisTerm, goalList, environment, db, level, reportFunction) {
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
    // Backtracking through the 'cut' stops any further attempts to prove this subgoal.
    //print ("Debug: backtracking through cut/0: thisTerm.parent = "); thisTerm.parent.print(); print("\n");
    thisTerm.parent.cut = true;
    return ret;
}
// Given a single argument, it sticks it on the goal list.
function Call(thisTerm, goalList, environment, db, level, reportFunction) {
    // Prove the builtin bit, then break out and prove
    // the remaining goalList.
    // Rename the variables in the head and body
    // var renamedHead = new Term(rule.head.name, renameVariables(rule.head.partlist.list, level));
    const first = value(thisTerm.partlist.list[0], environment);
    if (first.type != "Term") {
        //print("Debug: Call needs parameter bound to a Term, failing\n");
        return null;
    }
    //var newGoal = new Term(first.name, renameVariables(first.partlist.list, level, thisTerm));
    //newGoal.parent = thisTerm;
    // Stick this as a new goal on the start of the goallist
    const newGoals = [];
    newGoals[0] = first;
    first.parent = thisTerm;
    let j;
    for (j = 0; j < goalList.length; j++)
        newGoals[j + 1] = goalList[j];
    // Just prove the rest of the goallist, recursively.
    return answerQuestion(newGoals, environment, db, level + 1, reportFunction);
}
function Fail(thisTerm, goalList, environment, db, level, reportFunction) {
    return null;
}
function BagOf(thisTerm, goalList, environment, db, level, reportFunction) {
    // bagof(Term, ConditionTerm, ReturnList)
    let collect = value(thisTerm.partlist.list[0], environment);
    const subgoal = value(thisTerm.partlist.list[1], environment);
    const into = value(thisTerm.partlist.list[2], environment);
    collect = renameVariables(collect, level, thisTerm);
    const newGoal = new Term(subgoal.name, renameVariables(subgoal.partlist.list, level, thisTerm));
    newGoal.parent = thisTerm;
    const newGoals = [];
    newGoals[0] = newGoal;
    // Prove this subgoal, collecting up the environments...
    const anslist = [];
    anslist.renumber = -1;
    const ret = answerQuestion(newGoals, environment, db, level + 1, BagOfCollectFunction(collect, anslist));
    // Turn anslist into a proper list and unify with 'into'
    // optional here: nothing anslist -> fail?
    let answers = new Atom("nothing");
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
// Aux function: return the reportFunction to use with a bagof subgoal
function BagOfCollectFunction(collect, anslist) {
    return function (env) {
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
        anslist[anslist.length] = renameVariables(value(collect, env), anslist.renumber--, []);
    };
}
// Call out to external javascript
// external/3 takes three arguments:
// first: a template string that uses $1, $2, etc. as placeholders for 
const EvalContext = [];
function ExternalJS(thisTerm, goalList, environment, db, level, reportFunction) {
    //print ("DEBUG: in External...\n");
    // Get the first term, the template.
    const first = value(thisTerm.partlist.list[0], environment);
    if (first.type != "Atom") {
        //print("Debug: External needs First bound to a string Atom, failing\n");
        return null;
    }
    const regresult = first.name.match(/^"(.*)"$/);
    if (!regresult)
        return null;
    let r = regresult[1];
    //print("DEBUG: template for External/3 is "+r+"\n");
    // Get the second term, the argument list.
    let second = value(thisTerm.partlist.list[1], environment);
    let i = 1;
    while (second.type == "Term" && second.name == "cons") {
        // Go through second an argument at a time...
        const arg = value(second.partlist.list[0], environment);
        if (arg.type != "Atom") {
            //print("DEBUG: External/3: argument "+i+" must be an Atom, not "); arg.print(); print("\n");
            return null;
        }
        const re = new RegExp("\\$" + i, "g");
        //print("DEBUG: External/3: RegExp is "+re+", arg is "+arg.name+"\n");
        r = r.replace(re, arg.name);
        //print("DEBUG: External/3: r becomes "+r+"\n");
        second = second.partlist.list[1];
        i++;
    }
    if (second.type != "Atom" || second.name != "nothing") {
        //print("DEBUG: External/3 needs second to be a list, not "); second.print(); print("\n");
        return null;
    }
    //print("DEBUG: External/3 about to eval \""+r+"\"\n");
    let ret;
    // @ts-ignore
    with (EvalContext)
        ret = eval(r);
    //print("DEBUG: External/3 got "+ret+" back\n");
    if (!ret)
        ret = "nothing";
    // Convert back into an atom...
    const env2 = unify(thisTerm.partlist.list[2], new Atom(ret), environment);
    if (env2 == null) {
        //print("Debug: External/3 cannot unify OutValue with " + ret + ", failing\n");
        return null;
    }
    // Just prove the rest of the goallist, recursively.
    return answerQuestion(goalList, env2, db, level + 1, reportFunction);
}
function ExternalAndParse(thisTerm, goalList, environment, db, level, reportFunction) {
    //print ("DEBUG: in External...\n");
    // Get the first term, the template.
    const first = value(thisTerm.partlist.list[0], environment);
    if (first.type != "Atom") {
        //print("Debug: External needs First bound to a string Atom, failing\n");
        return null;
    }
    const regResult = first.name.match(/^"(.*)"$/);
    if (!regResult)
        return null;
    let r = regResult[1];
    //print("DEBUG: template for External/3 is "+r+"\n");
    // Get the second term, the argument list.
    let second = value(thisTerm.partlist.list[1], environment);
    let i = 1;
    while (second.type == "Term" && second.name == "cons") {
        // Go through second an argument at a time...
        const arg = value(second.partlist.list[0], environment);
        if (arg.type != "Atom") {
            //print("DEBUG: External/3: argument "+i+" must be an Atom, not "); arg.print(); print("\n");
            return null;
        }
        const re = new RegExp("\\$" + i, "g");
        //print("DEBUG: External/3: RegExp is "+re+", arg is "+arg.name+"\n");
        r = r.replace(re, arg.name);
        //print("DEBUG: External/3: r becomes "+r+"\n");
        second = second.partlist.list[1];
        i++;
    }
    if (second.type != "Atom" || second.name != "nothing") {
        //print("DEBUG: External/3 needs second to be a list, not "); second.print(); print("\n");
        return null;
    }
    //print("DEBUG: External/3 about to eval \""+r+"\"\n");
    let ret;
    // @ts-ignore
    with (EvalContext)
        ret = eval(r);
    //print("DEBUG: External/3 got "+ret+" back\n");
    if (!ret)
        ret = "nothing";
    // Convert back into a Prolog term by calling the appropriate Parse routine...
    const part = Partlist.parse1(new Tokeniser(ret));
    //print("DEBUG: external2, ret = "); ret.print(); print(".\n");
    const env2 = unify(thisTerm.partlist.list[2], part, environment);
    if (env2 == null) {
        //print("Debug: External/3 cannot unify OutValue with " + ret + ", failing\n");
        return null;
    }
    // Just prove the rest of the goallist, recursively.
    return answerQuestion(goalList, env2, db, level + 1, reportFunction);
}
freeform();
