const database = [];
// web browser IDE things /////
const commandLineEl = document.getElementById("commandline");
const consoleOutEl = document.getElementById("consoleout");
function newConsoleLine() {
    var elemDiv = document.createElement("div");
    elemDiv.innerHTML = "&nbsp;";
    consoleOutEl.appendChild(elemDiv);
    if (commandLineEl)
        commandLineEl.scrollIntoView();
    return elemDiv;
}
function printUserline(str) {
    const div = newConsoleLine();
    div.classList.add("userdiv");
    div.innerHTML = "<span>" + str + "</span>";
}
function printEcholine(str) {
    if (!document.input.showparse.checked)
        return;
    const div = newConsoleLine();
    div.classList.add("echodiv");
    div.innerHTML = "<span>" + str + "</span>";
}
function printAnswerline(str) {
    const div = newConsoleLine();
    div.classList.add("answerdiv");
    div.innerHTML = "<div><div>" + str.replaceAll("\n", "</div><div>") + "</div></div>";
}
function consoleOutError(...rest) {
    const div = newConsoleLine();
    div.classList.add("errdiv");
    div.innerHTML = "<span class=err>" + rest.join(" ") + "</span>";
    newConsoleLine();
    return null;
}
let previousInput = "";
function onCommandlineKey(event, el) {
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
    database.builtin["commit" /* cutCommit */ + "/0"] = Commit;
    database.builtin["call/1"] = Call;
    database.builtin["fail/0"] = Fail;
    database.builtin["bagof/3"] = BagOf;
    database.builtin["external/3"] = ExternalJS;
    database.builtin["external2/3"] = ExternalAndParse;
    printAnswerline("Attachments done.\n");
    printAnswerline("Parsing rulesets.\n");
    nextlines(document.rules.rules.value);
}
function nextlines(text) {
    text.split("\n").forEach(nextline);
}
function nextline(line) {
    if (!line || line.match(/^\s+$/))
        return database;
    printUserline(line);
    previousInput = line;
    if (line.match(/^\s*#/))
        return database; //== ops.comment
    const rule = Rule.parse(new Tokeniser(line));
    if (rule == null)
        return database;
    printEcholine(rule.print());
    if (rule.asking) {
        let reported = false;
        const reportFn = (env) => {
            reported = true;
            printVars(varNames(rule.body.list), env);
        };
        answerQuestion(renameVariables(rule.body.list, 0, []), {}, database, 1, reportFn);
        if (!reported)
            printAnswerline("No.\n");
    }
    else {
        database.push(rule);
        printAnswerline("Memorized.\n");
    }
    return database;
}
// environment ///////
// Print out an environment's contents.
function printEnv(env) {
    if (!env)
        return printAnswerline("nothing" /* nothing */ + ".\n");
    const retval = Object.entries(env).map(([name, part]) => ` ${name} = ${part.print()}\n`);
    printAnswerline(retval.length ? retval.join("") : "Yess.\n");
}
// Print bindings.
function printVars(variables, environment) {
    if (variables.length == 0)
        return printAnswerline("Yes.\n\n");
    const retval = [];
    for (const variable of variables) {
        if (variable.name != "?" /* impliedQuestionVar */) {
            retval.push(variable.name);
            retval.push(" is ");
        }
        retval.push(value(new Variable(variable.name + ".0"), environment).print());
        retval.push("\n");
    }
    if (retval.length == 0)
        return printAnswerline("No.\n\n");
    retval.push("\n");
    printAnswerline(retval.join(""));
}
// The value of x in a given environment
function value(x, env) {
    switch (x.type) {
        case "Term":
            const parts = x.partlist.list.map((each) => value(each, env));
            return new Term(x.name, parts);
        case "Atom":
            return x; // We only need to check the values of variables...
        case "Variable":
            const binding = env[x.name];
            return binding == null ? x : value(binding, env);
    }
}
// Give a new environment from the old with "name" (a string variable name) bound to "part" (a part)
function newEnv(name, part, oldEnv) {
    // We assume that name has been 'unwound' or 'followed' as far as possible
    // in the environment. If this is not the case, we could get an alias loop.
    const newEnv = {};
    newEnv[name] = part;
    for (const othername in oldEnv)
        if (othername != name)
            newEnv[othername] = oldEnv[othername];
    return newEnv;
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
        return x.type == y.type && x.name == y.name ? env : null;
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
    return Array.isArray(list) ? list.map((part) => renameVariable(part, level, parent)) : renameVariable(list, level, parent);
}
function renameVariable(part, level, parent) {
    switch (part.type) {
        case "Atom":
            return part;
        case "Variable":
            return new Variable(part.name + "." + level);
        case "Term":
            const term = new Term(part.name, renameVariables(part.partlist.list, level, parent));
            term.parent = parent;
            return term;
    }
}
// Return a list of all variables mentioned in a list of Terms.
function varNames(parts) {
    const variables = [];
    for (const part of parts) {
        switch (part.type) {
            case "Atom":
                continue;
            case "Variable":
                if (!variables.find((o) => o.name == part.name))
                    variables.push(part);
                continue;
            case "Term":
                const nestedVariables = varNames(part.partlist.list);
                for (const nestedVariable of nestedVariables) {
                    if (!variables.find((o) => o.name == nestedVariable.name))
                        variables.push(nestedVariable);
                }
                continue;
        }
    }
    return variables;
}
// The meat of this thing... js-tinyProlog.
// The main proving engine. Returns: null (keep going), other (drop out)
function answerQuestion(goalList, env, db, level, onReport) {
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
    const builtin = db.builtin[thisTerm.name + "/" + thisTerm.partlist.list.length];
    // print ("Debug: searching for builtin "+thisTerm.name+"/"+thisTerm.partlist.list.length+"\n");
    if (builtin) {
        //print ("builtin with name " + thisTerm.name + " found; calling prove() on it...\n");
        // Stick the new body list
        let newGoals = [];
        let j;
        for (j = 1; j < goalList.length; j++)
            newGoals[j - 1] = goalList[j];
        return builtin(thisTerm, newGoals, env, db, level + 1, onReport);
    }
    for (let i = 0; i < db.length; i++) {
        //print ("Debug: in rule selection. thisTerm = "); thisTerm.print(); print ("\n");
        if (thisTerm.excludeRule == i) {
            // print("DEBUG: excluding rule number "+i+" in attempt to satisfy "); thisTerm.print(); print("\n");
            continue;
        }
        const rule = db[i];
        if (!rule.head)
            continue;
        if (rule.head.name != thisTerm.name) {
            //consoleOutError("DEBUG: we'll need better unification to allow the 2nd-order rule matching\n");
            continue;
        }
        // Rename the variables in the head and body
        const renamedHead = new Term(rule.head.name, renameVariables(rule.head.partlist.list, level, thisTerm));
        // renamedHead.ruleNumber = i;
        const env2 = unify(thisTerm, renamedHead, env);
        if (env2 == null)
            continue;
        if (rule.body != null) {
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
            const ret = answerQuestion(newGoals, env2, db, level + 1, onReport);
            if (ret != null)
                return ret;
        }
        else {
            // Just prove the rest of the goallist, recursively.
            let newGoals = [];
            let j;
            for (j = 1; j < goalList.length; j++)
                newGoals[j - 1] = goalList[j];
            const ret = answerQuestion(newGoals, env2, db, level + 1, onReport);
            if (ret != null)
                return ret;
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
class Variable {
    constructor(head) {
        this.type = "Variable";
        this.name = head;
    }
    print() {
        return this.name;
    }
}
class Atom {
    constructor(head) {
        this.type = "Atom";
        this.name = head;
    }
    print() {
        return this.name;
    }
}
class Term {
    constructor(head, list) {
        this.type = "Term";
        this.name = head;
        this.partlist = new Partlist(list);
        this.parent = this;
    }
    print() {
        const retval = [];
        if (this.name == "cons" /* cons */) {
            let part = this;
            while (part.type == "Term" && part.name == "cons" /* cons */ && part.partlist.list.length == 2) {
                part = part.partlist.list[1];
            }
            if ((part.type == "Atom" && part.name == "nothing" /* nothing */) || part.type == "Variable") {
                part = this;
                retval.push("{" /* openList */);
                let comma = false;
                while (part.type == "Term" && part.name == "cons" /* cons */ && part.partlist.list.length == 2) {
                    if (comma)
                        retval.push(", ");
                    retval.push(part.partlist.list[0].print());
                    comma = true;
                    part = part.partlist.list[1];
                }
                if (part.type == "Variable") {
                    retval.push(" " + "|" /* sliceList */ + " ");
                    retval.push(part.print());
                }
                retval.push("}" /* closeList */);
                return retval.join("");
            }
        }
        retval.push("[" /* open */ + this.name);
        retval.push(this.partlist.print());
        retval.push("]" /* close */);
        return retval.join("");
    }
    static parse(tk) {
        // Term -> [NOTTHIS] id ( optParamList )
        if ( /*tk.type == "id" && */tk.current == "commit" /* cutCommit */) {
            // Parse bareword commit as commit/0
            tk = tk.consume();
            return new Term("commit" /* cutCommit */, []);
        }
        let notthis = tk.current == "NOTTHIS" /* notThis */;
        if (notthis)
            tk = tk.consume();
        if (tk.type != "punc" || tk.current != "[" /* open */)
            return consoleOutError("expected [ to begin");
        tk = tk.consume();
        if (tk.type != "id")
            return consoleOutError("expected first term to be a symbol / bare word");
        const name = tk.current;
        tk = tk.consume();
        if (tk.current == ",")
            tk = tk.consume();
        else if (tk.current != "]")
            return consoleOutError("expected , or ] after first term. Current=", tk.current);
        const parts = Partlist.parse(tk);
        if (!parts)
            return null;
        const term = new Term(name, parts);
        term.excludeThis = notthis;
        return term;
    }
}
class Partlist {
    constructor(list) {
        this.list = list;
    }
    print() {
        return this.list.map((each) => ", " + each.print()).join("");
    }
    static parse(tk) {
        const parts = [];
        while (tk.current != "]" /* close */) {
            if (tk.type == "eof")
                return consoleOutError("unexpected EOF while running through terms until", "]" /* close */);
            const part = Partlist.parse1(tk);
            if (part == null)
                return consoleOutError("part didn't parse at", tk.current, "remaining:", tk.remainder);
            if (tk.current == ",")
                tk = tk.consume();
            else if (tk.current != "]" /* close */)
                return consoleOutError("a term, a part, ended before the , or the ]   remaining: ", tk.remainder);
            parts.push(part);
        }
        tk = tk.consume();
        return parts;
    }
    // This was a beautiful piece of code. It got kludged to add [a,b,c|Z] sugar.
    static parse1(tk) {
        // Part -> var | id | id(optParamList)
        // Part -> [ listBit ] ::-> cons(...)
        if (tk.type == "var") {
            const varName = tk.current;
            tk = tk.consume();
            return new Variable(varName);
        }
        // destructure a list
        if (tk.type == "punc" && tk.current == "{" /* openList */) {
            tk = tk.consume();
            // Special case: {} = new atom(nothing).
            if (tk.type == "punc" && tk.current == "}" /* closeList */) {
                tk = tk.consume();
                return new Atom("nothing" /* nothing */);
            }
            // Get a list of parts
            const parts = [];
            while (true) {
                const part = Partlist.parse1(tk);
                if (part == null)
                    return consoleOutError("can't understand this part of a list destructuring:", tk.remainder);
                parts.push(part);
                if (tk.current != ",")
                    break;
                tk = tk.consume();
            }
            // Find the end of the list ... "| Var }" or "}".
            let append;
            if (tk.current == "|" /* sliceList */) {
                tk = tk.consume();
                if (tk.type != "var")
                    return consoleOutError("|" /* sliceList */, " wasn't followed by a var");
                append = new Variable(tk.current);
                tk = tk.consume();
            }
            else {
                append = new Atom("nothing" /* nothing */);
            }
            if (tk.current != "}" /* closeList */)
                return consoleOutError("list destructure wasn't ended by }");
            tk = tk.consume();
            // Return the new cons.... of all this rubbish.
            for (let i = parts.length - 1; i >= 0; i--)
                append = new Term("cons" /* cons */, [parts[i], append]);
            return append;
        }
        const openbracket = tk.type == "punc" && tk.current == "[" /* open */;
        if (openbracket)
            tk = tk.consume();
        const name = tk.current;
        tk = tk.consume();
        if (!openbracket)
            return new Atom(name);
        if (tk.current != ",")
            return consoleOutError("expected , after symbol");
        tk = tk.consume();
        const parts = Partlist.parse(tk);
        if (!parts)
            return null;
        return new Term(name, parts);
    }
}
class Body {
    constructor(list) {
        this.list = list;
    }
    print() {
        return this.list.map((each) => each.print()).join(", ");
    }
}
class Rule {
    constructor(head, bodylist = null, isQuestion = false) {
        if (isQuestion) {
            this.head = null;
            this.body = new Body(bodylist != null ? [head].concat(bodylist) : [head]);
            this.asking = isQuestion;
        }
        else {
            this.head = head;
            this.body = bodylist != null ? new Body(bodylist) : null;
            this.asking = isQuestion;
        }
    }
    print() {
        const retval = [];
        if (this.head)
            retval.push(this.head.print());
        if (this.head && this.body)
            retval.push("if" /* if */);
        if (this.body)
            retval.push(this.body.print());
        retval.push(this.asking ? "?" /* endQuestion */ : "." /* endSentence */);
        retval.push("\n");
        return retval.join(" ");
    }
    // A rule is a Head followedBy   .   orBy   if Body   orBy    ?    or contains ? as a Var   or just ends, where . or ? is assumed
    static parse(tk) {
        const head = Rule.parseHead(tk);
        if (!head)
            return consoleOutError("syntax error");
        if (tk.current == "." /* endSentence */)
            return new Rule(head);
        const expected = ["if" /* if */, "?" /* endQuestion */, "." /* endSentence */, "," /* bodyTermSeparator */];
        const questionIsImplied = hasTheImpliedQuestionVar(head);
        if (!expected.includes(tk.current) && !questionIsImplied && tk.type != "eof")
            return consoleOutError("expected one of", expected.join(" "), " but found", tk.remainder);
        const endQuestionNow = tk.current == "?" /* endQuestion */;
        const isQuestion = tk.current == "?" /* endQuestion */ || tk.current == "," /* bodyTermSeparator */ || questionIsImplied;
        if (tk.type == "eof")
            return new Rule(head, null, isQuestion);
        tk = tk.consume();
        const body = endQuestionNow ? null : Rule.parseBody(tk);
        if (!endQuestionNow && tk.current != "." /* endSentence */ && tk.current != "?" /* endQuestion */ && !questionIsImplied)
            return consoleOutError("expected end of sentence with one of", "." /* endSentence */, "?" /* endQuestion */, " but remaining:", tk.remainder);
        return new Rule(head, body, isQuestion);
    }
    static parseHead(tk) {
        // A head is simply a term. (errors cascade back up)
        return Term.parse(tk);
    }
    static parseBody(tk) {
        const terms = [];
        while (true) {
            const term = Term.parse(tk);
            if (term == null)
                break;
            terms.push(term);
            if (tk.current != ",")
                break;
            tk = tk.consume();
        }
        return terms.length == 0 ? null : terms;
    }
}
function hasTheImpliedQuestionVar(term) {
    switch (term.type) {
        case "Atom":
            return false;
        case "Variable":
            return term.name === "?" /* impliedQuestionVar */;
        case "Term":
            return (term.partlist?.list || []).some(hasTheImpliedQuestionVar);
    }
}
// The Tiny-Prolog parser goes here.
class Tokeniser {
    constructor(line) {
        this.remainder = line;
        this.current = "";
        this.type = ""; // "eof", "id", "var", "punc" etc.
        this.consume(); // Load up the first token.
    }
    consume() {
        if (this.type == "eof") {
            console.warn("Tried to consume eof");
            return this;
        }
        // Eat any leading WS
        let r = this.remainder.match(/^\s*(.*)$/);
        if (r) {
            this.remainder = r[1];
        }
        if (this.remainder == "") {
            this.current = "";
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
        this.current = "";
        this.type = "eof";
        return this;
    }
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
function Commit(thisTerm, goalList, environment, db, level, reportFunction) {
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
function Call(thisTerm, goals, env, db, level, onReport) {
    // Prove the builtin bit, then break out and prove
    // the remaining goalList.
    // Rename the variables in the head and body
    // var renamedHead = new Term(rule.head.name, renameVariables(rule.head.partlist.list, level));
    const first = value(thisTerm.partlist.list[0], env);
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
    for (j = 0; j < goals.length; j++)
        newGoals[j + 1] = goals[j];
    // Just prove the rest of the goallist, recursively.
    return answerQuestion(newGoals, env, db, level + 1, onReport);
}
function Fail(thisTerm, goals, env, db, level, onReport) {
    return null; // TODO shouldn't this return True or something?
}
function BagOf(thisTerm, goals, env, db, level, onReport) {
    // bagof(Term, ConditionTerm, ReturnList)
    let collect = value(thisTerm.partlist.list[0], env);
    const subgoal = value(thisTerm.partlist.list[1], env);
    const into = value(thisTerm.partlist.list[2], env);
    collect = renameVariables(collect, level, thisTerm);
    const newGoal = new Term(subgoal.name, renameVariables(subgoal.partlist.list, level, thisTerm));
    newGoal.parent = thisTerm;
    const newGoals = [];
    newGoals[0] = newGoal;
    // Prove this subgoal, collecting up the environments...
    const anslist = [];
    anslist.renumber = -1;
    const ret = answerQuestion(newGoals, env, db, level + 1, BagOfCollectFunction(collect, anslist));
    // Turn anslist into a proper list and unify with 'into'
    // optional here: nothing anslist -> fail?
    let answers = new Atom("nothing" /* nothing */);
    /*
      print("Debug: anslist = [");
          for (var j = 0; j < anslist.length; j++) {
              anslist[j].print();
              print(", ");
          }
      print("]\n");
      */
    for (var i = anslist.length; i > 0; i--)
        answers = new Term("cons" /* cons */, [anslist[i - 1], answers]);
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
function ExternalJS(thisTerm, goals, env, db, level, onReport) {
    //print ("DEBUG: in External...\n");
    // Get the first term, the template.
    const first = value(thisTerm.partlist.list[0], env);
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
    let second = value(thisTerm.partlist.list[1], env);
    let i = 1;
    while (second.type == "Term" && second.name == "cons" /* cons */) {
        // Go through second an argument at a time...
        const arg = value(second.partlist.list[0], env);
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
    if (second.type != "Atom" || second.name != "nothing" /* nothing */) {
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
        ret = "nothing" /* nothing */;
    // Convert back into an atom...
    const env2 = unify(thisTerm.partlist.list[2], new Atom(ret), env);
    if (env2 == null) {
        //print("Debug: External/3 cannot unify OutValue with " + ret + ", failing\n");
        return null;
    }
    // Just prove the rest of the goallist, recursively.
    return answerQuestion(goals, env2, db, level + 1, onReport);
}
function ExternalAndParse(thisTerm, goals, env, db, level, onReport) {
    //print ("DEBUG: in External...\n");
    // Get the first term, the template.
    const first = value(thisTerm.partlist.list[0], env);
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
    let second = value(thisTerm.partlist.list[1], env);
    let i = 1;
    while (second.type == "Term" && second.name == "cons" /* cons */) {
        // Go through second an argument at a time...
        const arg = value(second.partlist.list[0], env);
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
    if (second.type != "Atom" || second.name != "nothing" /* nothing */) {
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
        ret = "nothing" /* nothing */;
    // Convert back into a Prolog term by calling the appropriate Parse routine...
    const part = Partlist.parse1(new Tokeniser(ret));
    //print("DEBUG: external2, ret = "); ret.print(); print(".\n");
    const env2 = unify(thisTerm.partlist.list[2], part, env);
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
