import { database, answerQuestion, renameVariables } from "./engine";
import { Environment } from "./environment";
import { ops, Database } from "./interfaces";
import { Comparitor, Commit, Ask, More, BagOf, ExternalJS } from "./library";
import { Rule } from "./rule";
import { Tokeniser } from "./tokenizer";
import { Tuple } from "./tupleItem";

interface Document extends globalThis.Document {
  input: HTMLFormElement;
  rules: HTMLFormElement;
}

// web browser IDE things /////

const commandLineEl: HTMLInputElement = document.getElementById("commandline")! as HTMLInputElement;
const consoleOutEl: HTMLDivElement = document.getElementById("consoleout")! as HTMLDivElement;

export function newConsoleLine(): HTMLDivElement {
  var elemDiv = document.createElement("div");
  elemDiv.innerHTML = "&nbsp;";
  consoleOutEl.appendChild(elemDiv);
  if (commandLineEl) commandLineEl.scrollIntoView();
  return elemDiv;
}

let showEcholines = (document as Document).input.showparse.checked;
export function toggleEcholines() {
  showEcholines = !showEcholines;
  document.querySelectorAll<HTMLDivElement>("div.echodiv").forEach(el => (el.style.display = showEcholines ? "block" : "none"));
}

export function printUserline(str: string) {
  const div = newConsoleLine();
  div.classList.add("userdiv");
  div.innerHTML = "<span>" + str + "</span>";
}

export function printEcholine(str: string) {
  const div = newConsoleLine();
  div.classList.add("echodiv");
  div.innerHTML = "<span>" + str + "</span>";
}

export function printDebugline(...rest: any[]) {
  const div = newConsoleLine();
  div.classList.add("debugdiv");
  div.innerHTML = "<div>" + rest.join(" ").replaceAll("\n", "</div><div>") + "</div>";
  newConsoleLine();
  return null;
}

export function printAnswerline(str: string) {
  const div = newConsoleLine();
  div.classList.add("answerdiv");
  div.innerHTML = "<div><div>" + str.replaceAll("\n", "</div><div>") + "</div></div>";
}

export function consoleOutError(tk: Tokeniser | null, ...rest: any[]): null {
  const div = newConsoleLine();
  div.classList.add("errdiv");
  div.innerHTML = "<div><div><span class=err>" + rest.join(" ") + "</span></div><div>" + (tk ? tk.current + tk.remainder : "") + "</div></div>";
  newConsoleLine();
  return null;
}

let previousInput = "";

export function onCommandlineKey(event: any, el: HTMLInputElement) {
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
  (document as Document).rules.rules.value.split("\n").forEach(nextline);
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

// run program
(window as any).onCommandlineKey = onCommandlineKey;
(window as any).toggleEcholines = toggleEcholines;
init();
commandLineEl.focus();
