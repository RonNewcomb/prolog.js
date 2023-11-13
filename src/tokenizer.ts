import { consoleOutError } from "./ui";

// The Tiny-Prolog parser goes here.
export class Tokeniser {
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
