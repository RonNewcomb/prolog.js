import { engine_init, processLine } from "./engine";
import type { Tokeniser } from "./tokenizer";

interface Document extends globalThis.Document {
  input: HTMLFormElement;
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
  document.querySelectorAll<HTMLDivElement>("div.echodiv").forEach(el => (el.style.display = showEcholines ? "flex" : "none"));
  commandLineEl.focus();
}

export function printUserline(str: string) {
  const div = newConsoleLine();
  div.classList.add("userdiv");
  div.innerHTML = "<div><div>" + str.replaceAll("\n", "</div><div>") + "</div></div>";
}

export function printEcholine(str: string) {
  const div = newConsoleLine();
  div.classList.add("echodiv");
  div.innerHTML = "<div><div>" + str.replaceAll("\n", "</div><div>") + "</div></div>";
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

// called on startup
async function init() {
  printAnswerline("\nInitializing engine.\n");
  engine_init();

  printAnswerline("Fetching testinput.txt\n");
  const text = await fetch("testinput.txt").then(response => response.text());
  text.split("\n").forEach(nextline);
}

function nextline(line: string) {
  line = (line || "").trim();
  if (!line) return;
  printUserline(line);
  previousInput = line;
  if (line.match(/^\s*#/)) return; //== ops.comment
  const db = processLine(line);
  commandLineEl.focus();
}

// run program
(window as any).onCommandlineKey = onCommandlineKey;
(window as any).toggleEcholines = toggleEcholines;
init();
commandLineEl.focus();
