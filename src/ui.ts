import { processLine } from "./engine";
import type { Tokeniser } from "./tokenizer";

const toggleStyleEl = document.createElement("style")! as HTMLStyleElement;
toggleStyleEl.id = "toggleStyleEl";
document.head.appendChild(toggleStyleEl);

const showparseCheckEl = document.getElementById("showparse")! as HTMLInputElement;
showparseCheckEl.addEventListener("click", (event: any) => {
  toggleStyleEl.innerText = event.target.checked ? ".echodiv { }" : ".echodiv { display: none !important; }";
  commandLineEl.focus();
});

const consoleOutEl = document.getElementById("consoleout")! as HTMLDivElement;
export function newConsoleLine(classes?: string, html?: string): HTMLDivElement {
  const elemDiv = document.createElement("div");
  if (classes) elemDiv.classList.add(classes);
  elemDiv.innerHTML = html || "&nbsp;";
  consoleOutEl.appendChild(elemDiv);
  commandLineEl?.focus();
  return elemDiv;
}

export function printUserline(str: string) {
  newConsoleLine("userdiv", "<div><div>" + str.replaceAll("\n", "</div><div>") + "</div></div>");
}

export function printEcholine(str: string) {
  newConsoleLine("echodiv", "<div><div>" + str.replaceAll("\n", "</div><div>") + "</div></div>");
}

export function printDebugline(...rest: any[]) {
  newConsoleLine("debugdiv", "<div>" + rest.join(" ").replaceAll("\n", "</div><div>") + "</div>");
  newConsoleLine();
  return null;
}

export function printAnswerline(str: string) {
  newConsoleLine("answerdiv", "<div><div>" + str.replaceAll("\n", "</div><div>") + "</div></div>");
}

export function consoleOutError(tk: Tokeniser | null, ...rest: any[]): null {
  newConsoleLine("errdiv", "<div><div><span class=err>" + rest.join(" ") + "</span></div><div>" + (tk ? tk.current + tk.remainder : "") + "</div></div>");
  newConsoleLine();
  return null;
}

let previousInput = "";

const commandLineEl = document.getElementById("commandline")! as HTMLInputElement;
commandLineEl.addEventListener("keydown", (event: any) => {
  const el = event.target;
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
});

export async function importSource(filename: string) {
  printAnswerline("Fetching " + filename);
  const text = await fetch(filename).then(response => response.text());
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

importSource("testinput.txt").then(_ => commandLineEl.scrollIntoView());
