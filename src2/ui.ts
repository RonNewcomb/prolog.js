const toggleStyleEl = document.createElement("style")! as HTMLStyleElement;
toggleStyleEl.id = "toggleStyleEl";
document.head.appendChild(toggleStyleEl);

document.getElementById("showparse")!.addEventListener("click", event => {
  const checkbox = event.target as HTMLInputElement;
  toggleStyleEl.innerText = checkbox.checked ? ".echodiv { }" : ".echodiv { display: none !important; }";
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

// export function consoleOutError(tk: Tokeniser | null, ...rest: any[]): null {
//   newConsoleLine("errdiv", "<div><div><span class=err>" + rest.join(" ") + "</span></div><div>" + (tk ? tk.current + tk.remainder : "") + "</div></div>");
//   newConsoleLine();
//   return null;
// }

const previousInput: string[] = [];
let previousInputIndex = 0;

const commandLineEl = document.getElementById("commandline")! as HTMLInputElement;
commandLineEl.addEventListener("keydown", event => {
  const input = event.target as HTMLInputElement;
  switch (event.key) {
    case "ArrowUp":
      if (previousInputIndex < previousInput.length - 1) previousInputIndex++;
      input.value = previousInput[previousInput.length - 1 - previousInputIndex];
      return;
    case "ArrowDown":
      if (previousInputIndex >= 0) previousInputIndex--;
      input.value = previousInputIndex >= 0 ? previousInput[previousInput.length - 1 - previousInputIndex] : "";
      return;
    case "Enter":
      nextline(input.value);
      input.value = "";
      input.scrollIntoView();
      return;
  }
});

export async function importSource(filename: string) {
  printAnswerline("Fetching " + filename);
  const text = await fetch(filename).then(response => response.text());
  text.split("\n").forEach(nextline);
}

const emojiThumbsUp = "&#x1F44D;";

let processLine: (string: string) => any = () => [];

export const registerProcessLine = (fn: typeof processLine) => {
  processLine = fn;
  importSource("test2/testinput.txt").then(_ => commandLineEl.scrollIntoView());
};

function nextline(line: string) {
  line = (line || "").trim();
  if (!line) return;
  printUserline(line);
  previousInput.push(line);
  if (line.match(/^\s*#/)) return printAnswerline(emojiThumbsUp); //== ops.comment
  const db = processLine(line);
  commandLineEl.focus();
}
