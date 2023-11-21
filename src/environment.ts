import { ops } from "./interfaces";
import { type TupleItem, Tuple, Variable } from "./tupleItem";
import { printAnswerline } from "./ui";

export class Environment {
  contents: Record<string, TupleItem>;

  constructor(oldEnvironment?: Environment) {
    this.contents = Object.create(oldEnvironment?.contents || null);
  }

  // Print out an environment's contents.
  print() {
    if (!this.contents) return printAnswerline("Empty.\n");
    const retval: string[] = []; // use for..in to get inherited properties
    for (const name in this.contents) retval.push(` ${name} = ${this.contents[name].print()}\n`);
    printAnswerline(retval.length ? retval.join("") : "Empty.\n");
  }

  // prints what values vars are bound to
  printBindings(tuples: Tuple[]): void {
    // Return a list of all variables mentioned in a list of Tuples.
    const varNames = (parts: TupleItem[]): Variable[] => {
      const variables: Variable[] = [];
      for (const part of parts) {
        switch (part.type) {
          case "Literal":
            continue;
          case "Variable":
            if (!variables.find(o => o.name == part.name)) variables.push(part);
            continue;
          case "Tuple":
            const nestedVariables = varNames(part.items);
            for (const nestedVariable of nestedVariables) if (!variables.find(o => o.name == nestedVariable.name)) variables.push(nestedVariable);
            continue;
        }
      }
      return variables;
    };

    const variables = varNames(tuples);
    if (variables.length == 0) return printAnswerline("Yes.\n\n");

    const retval: string[] = [];
    for (const variable of variables) {
      if (variable.name != ops.impliedQuestionVar) {
        retval.push("The ");
        retval.push(variable.name);
        retval.push(" is ");
      }
      const topLevelVarName = variable.name + ".0";
      const part = this.value(new Variable(topLevelVarName));
      retval.push(part.name == topLevelVarName ? ops.anything : part.print());
      retval.push(".\n");
    }
    retval.push("\n");
    printAnswerline(retval.join(""));
  }

  // Give a new environment from the old with "name" (a string variable name) bound to "part" (a part)
  spawn(name: string, part: TupleItem): Environment {
    // We assume that name has been 'unwound' or 'followed' as far as possible
    // in the environment. If this is not the case, we could get an alias loop.
    const newEnv = new Environment(this);
    newEnv.contents[name] = part;
    return newEnv;
  }

  // The value of x in a given environment
  value(x: TupleItem): TupleItem {
    switch (x.type) {
      case "Tuple":
        const parts = x.items.map(each => this.value(each));
        return new Tuple(parts, undefined, x.dontSelfRecurse);
      case "Literal":
        return x; // We only need to check the values of variables...
      case "Variable":
        const binding = this.contents[x.name];
        return binding == null ? x : this.value(binding);
    }
  }

  // Unify two items under the current environment. Returns a new environment, or null on failure
  unify(x: TupleItem | null, y: TupleItem | null): Environment | null {
    if (x == null || y == null) return null;
    x = this.value(x);
    y = this.value(y);
    if (x.type == "Variable") return this.spawn(x.name, y);
    if (y.type == "Variable") return this.spawn(y.name, x);
    if (x.type == "Literal" || y.type == "Literal") return x.type == y.type && x.name == y.name ? this : null;

    // x.type == y.type == Tuple...
    const xs = x.items;
    const ys = y.items;
    if (xs.length != ys.length) return null;

    let env: Environment | null = this;
    // check pairs of literals first, for performance
    for (let i = 0; i < xs.length; i++) {
      if (xs[i].type == "Literal" || ys[i].type == "Literal") {
        env = env.unify(xs[i], ys[i]);
        if (env == null) return null;
      }
    }
    //console.log("trying", y.name);
    // now check everything else
    for (let i = 0; i < xs.length; i++) {
      if (xs[i].type != "Literal" && ys[i].type != "Literal") {
        env = env.unify(xs[i], ys[i]);
        if (env == null) return null;
      }
    }

    return env;
  }
}
