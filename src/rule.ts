import { ops } from "./interfaces";
import { Tokeniser } from "./tokenizer";
import { Tuple, TupleItem } from "./tupleItem";
import { consoleOutError } from "./ui";

export class Rule {
  head: Tuple | null;
  body: Tuple[] | null;
  asking: boolean;

  constructor(head: Tuple, query: Tuple[] | null = null, isQuestion: boolean = false) {
    this.asking = isQuestion;
    if (isQuestion) {
      this.body = query != null ? [head].concat(query) : [head];
      this.head = null;
    } else {
      this.body = query;
      this.head = head;
    }
    if (this.body) for (const tuple of this.body) if (tuple.markedDontSelfRecurse) tuple.dontSelfRecurse = this;
  }

  // A rule is a Head followedBy   .   orBy   if Body   orBy    ?    or contains ? as a Var   or just ends, where . or ? is assumed
  static parse(tk: Tokeniser): Rule | null {
    tk.contextPush("rule");
    const head = Tuple.parse(tk);
    if (!head) return consoleOutError(tk, "syntax error while parsing", tk.contexts.pop());

    const expected = [ops.if, ops.endQuestion, ops.endSentence, ops.bodyTupleSeparator];
    const questionIsImplied = hasTheImpliedUnboundVar(head);
    const isQuestion = tk.current == ops.endQuestion || tk.current == ops.bodyTupleSeparator || questionIsImplied;

    if (!expected.includes(tk.current as ops) && !questionIsImplied && tk.type != "eof")
      return consoleOutError(tk, "expected one of ", expected.join(" "), "  but instead got");

    if (tk.type == "eof") return new Rule(head, null, isQuestion);
    if (tk.type != "punc") return consoleOutError(tk, "expected punctuation mark here not a", tk.type);

    switch (tk.current) {
      case ops.endSentence:
        tk = tk.consume("pop");
        return new Rule(head, null, false); // [foo, ?].  same as [foo, anything]. but not same as [foo, ?]?

      case ops.endQuestion:
        tk = tk.consume("pop");
        return new Rule(head, null, true);

      case ops.if:
        tk = tk.consume();
        const bodyOfIf = Rule.parseBody(tk);
        if (tk.current == ops.endSentence) tk = tk.consume("pop");
        else if (tk.type != "eof") return consoleOutError(tk, "expected end of sentence with a ", ops.endSentence, " but instead got ");
        return new Rule(head, bodyOfIf, false);

      case ops.bodyTupleSeparator:
        tk = tk.consume();
        const bodyContinues = Rule.parseBody(tk);
        if (tk.current == ops.endQuestion) tk.consume("pop");
        else if (tk.type != "eof") return consoleOutError(tk, "expected complex question to end with", ops.endQuestion, "but instead got ");
        return new Rule(head, bodyContinues, true);

      default:
        return consoleOutError(tk, "expected one of ", expected.join(" "), "  but instead got");
    }
  }

  static parseBody(tk: Tokeniser): Tuple[] | null {
    const tuples: Tuple[] = [];
    while (true) {
      const tuple = Tuple.parseAtTopLevel(tk);
      if (tuple == null) break;
      tuples.push(tuple);
      if (tk.current != ",") break;
      tk = tk.consume();
    }
    return tuples.length == 0 ? null : tuples;
  }

  print(): string {
    const retval: string[] = [];
    if (this.head) retval.push(this.head.print());
    if (this.head && this.body) retval.push(ops.if);
    if (this.body) retval.push(this.body.map(each => each.print()).join(", "));
    retval.push(this.asking ? ops.endQuestion : ops.endSentence);
    retval.push("\n");
    return retval.join(" ");
  }
}

function hasTheImpliedUnboundVar(tuple: TupleItem): boolean {
  switch (tuple.type) {
    case "Literal":
      return false;
    case "Variable":
      return tuple.name === ops.impliedQuestionVar;
    case "Tuple":
      return tuple.items.some(hasTheImpliedUnboundVar);
  }
}
