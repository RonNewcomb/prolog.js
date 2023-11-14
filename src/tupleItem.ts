// Object (of a style...) definitions:
// Rule = Head if Query
// Head = Tuple  .
// Query = Tuple+  ?
// Tuple = [TupleItem+]
// TupleItem = Variable | Literal | Tuple

import { ops } from "./interfaces";
import type { Rule } from "./rule";
import type { Tokeniser } from "./tokenizer";
import { consoleOutError } from "./ui";

export type TupleItem = Variable | Literal | Tuple;

export class Variable {
  type: "Variable" = "Variable";
  name: string;

  constructor(head: string) {
    this.name = head;
  }
  print(): string {
    return "the " + this.name;
  }
}

export class Literal {
  type: "Literal" = "Literal";
  name: string;

  constructor(head: string) {
    this.name = head;
  }
  print(): string {
    return this.name;
  }
}

export class Tuple {
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
