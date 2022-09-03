// type jstBindable = jstAtom | jstVariable;
// type jstRValue = jstVariable | jstTuple | jstAtom;
// type jstAtom = string;
// type jstVariable = string;
// type jstTuple = jstRValue[];
// type jstRule = jstTuple[];
// type jstEnvironment = Record<jstBindable, jstRValue>;

// const unify = (struct1: jstRValue, struct2: jstRValue, binding: jstEnvironment) => {
//   const workers: jstRValue[] = [struct1, struct2];
//   while (workers.length) {
//     (struct1 = workers.pop()!), (struct2 = workers.pop()!);
//     if (Array.isArray(struct1) && Array.isArray(struct2)) {
//       if (struct1[0] !== struct2[0] || struct1.length !== struct2.length) return false;
//       for (const i = 1, l = struct1.length; i < l; i++) workers.push(struct1[i], struct2[i]);
//     } else if (struct1 !== "_" && struct2 !== "_") {
//       if (Array.isArray(struct1))
//         var tmp = struct1,
//           struct1 = struct2,
//           struct2 = tmp;
//       if (contain(struct2, struct1)) {
//         if (struct1 !== struct2) return false;
//       } else {
//         const eliminate = x => (x === struct1 ? struct2 : x);
//         for (let i = 0, l = workers.length; i < l; i++) workers[i] = substitute(workers[i], eliminate);
//         merge(binding, eliminate, binding);
//         binding[struct1] = struct2;
//       }
//     }
//   }
//   return true;
// };

// const contain = (struct: jstTuple | jstVariable, variable: jstVariable) => {
//   if (Array.isArray(struct)) for (let i = 1, l = struct.length; i < l; i++) if (contain(struct[i], variable)) return true;
//   return struct === variable;
// };

// const substitute = (struct: jstRValue, map: (s: string) => jstRValue): jstRValue => {
//   if (Array.isArray(struct)) {
//     const result = [struct[0]];
//     for (let i = 1, l = struct.length; i < l; i++) result.push(substitute(struct[i], map));
//     return result;
//   }
//   return map(struct);
// };

// const merge = (binding: jstEnvironment, map: (s: string) => jstRValue, result: jstEnvironment): jstEnvironment => {
//   const ks = Object.getOwnPropertyNames(binding);
//   Array.prototype.push.apply(ks, Object.getOwnPropertySymbols(binding));
//   for (let i = 0, l = ks.length; i < l; i++) result[ks[i]] = substitute(binding[ks[i]], map);
//   return result;
// };

// let identifier = 0;
// const rename = (fresh: jstEnvironment) => (x: string) => fresh[x] || (fresh[x] = Symbol(++identifier));

// module.exports = (rules: jstRule[]): Generator<jstEnvironment, jstEnvironment, jstEnvironment> => {
//   function* disjunction(goal: jstTuple): Generator<jstEnvironment, jstEnvironment, jstEnvironment> {
//     debugger;
//     const fresh = Object.create(null);
//     goal = substitute(goal, rename(fresh));
//     for (let i = 0, l = rules.length; i < l; i++) {
//       const binding = Object.create(null);
//       if (unify(goal, rules[i][0], binding)) yield* conjunction(rules[i], 1, binding, fresh);
//     }
//   }
//   function* conjunction(
//     rule: jstRule,
//     index: number,
//     binding: jstEnvironment,
//     fresh: jstEnvironment
//   ): Generator<jstEnvironment, jstEnvironment, jstEnvironment> {
//     if (index === rule.length) {
//       const map = rename(Object.create(null));
//       yield merge(fresh, x => (x in binding ? substitute(binding[x], map) : map(x)), Object.create(null));
//     } else {
//       for (let solution of disjunction(substitute(rule[index], x => binding[x] || x)))
//         yield* conjunction(
//           rule,
//           index + 1,
//           merge(binding, x => solution[x] || x, solution),
//           fresh
//         );
//     }
//   }
//   return disjunction;
// };
