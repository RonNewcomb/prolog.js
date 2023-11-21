// Generated automatically by nearley, version 2.20.1
// http://github.com/Hardmath123/nearley
(function () {
function id(x) { return x[0]; }
var grammar = {
    Lexer: undefined,
    ParserRules: [
    {"name": "main$ebnf$1", "symbols": ["line"]},
    {"name": "main$ebnf$1", "symbols": ["main$ebnf$1", "line"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "main", "symbols": ["main$ebnf$1"], "postprocess": d => ({ lines: d.flat(4)})},
    {"name": "line", "symbols": ["rule"]},
    {"name": "line", "symbols": ["query"]},
    {"name": "rule$ebnf$1$subexpression$1$string$1", "symbols": [{"literal":"i"}, {"literal":"f"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "rule$ebnf$1$subexpression$1", "symbols": ["__", "rule$ebnf$1$subexpression$1$string$1", "__", "tuplelist"]},
    {"name": "rule$ebnf$1", "symbols": ["rule$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "rule$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "rule", "symbols": ["_", "tuple", "rule$ebnf$1", {"literal":"."}, "_"], "postprocess": d => ({ rule: { head: d[1], body: d.slice(2).flat(2).filter(x => !!x && typeof x !== 'string')[0]?.tuplelist ?? [] } })},
    {"name": "query", "symbols": ["_", "tuplelist", {"literal":"?"}, "_"], "postprocess": d => ({ query: d[1] })},
    {"name": "tuplelist$ebnf$1", "symbols": []},
    {"name": "tuplelist$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "tuple"]},
    {"name": "tuplelist$ebnf$1", "symbols": ["tuplelist$ebnf$1", "tuplelist$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "tuplelist", "symbols": ["tuple", "tuplelist$ebnf$1"], "postprocess": d => ({ tuplelist: d.flat(5).filter(x => !!x && typeof x !== 'string') })},
    {"name": "tuple$ebnf$1", "symbols": []},
    {"name": "tuple$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "tupleitem"]},
    {"name": "tuple$ebnf$1", "symbols": ["tuple$ebnf$1", "tuple$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "tuple", "symbols": [{"literal":"["}, "_", "tupleitem", "tuple$ebnf$1", "_", {"literal":"]"}], "postprocess": d => ({ tuple:     d.flat(5).filter(x => !!x && typeof x !== 'string') })},
    {"name": "tupleitem$subexpression$1", "symbols": ["variable"]},
    {"name": "tupleitem$subexpression$1", "symbols": ["literal"]},
    {"name": "tupleitem$subexpression$1", "symbols": ["tuple"]},
    {"name": "tupleitem", "symbols": ["tupleitem$subexpression$1"], "postprocess": d => ({ tupleitem: d[0][0] })},
    {"name": "literal$subexpression$1", "symbols": ["string"]},
    {"name": "literal$subexpression$1", "symbols": ["number"]},
    {"name": "literal$subexpression$1", "symbols": ["boolean"]},
    {"name": "literal$subexpression$1", "symbols": ["bareword"]},
    {"name": "literal", "symbols": ["literal$subexpression$1"], "postprocess": d => ({ literal: d[0][0] })},
    {"name": "string$ebnf$1", "symbols": []},
    {"name": "string$ebnf$1", "symbols": ["string$ebnf$1", /[^"]/], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "string", "symbols": [/["]/, "string$ebnf$1", /["]/], "postprocess": d => ({ str: d[1].join('') })},
    {"name": "number$ebnf$1", "symbols": [/[0-9]/]},
    {"name": "number$ebnf$1", "symbols": ["number$ebnf$1", /[0-9]/], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "number$ebnf$2$subexpression$1$ebnf$1", "symbols": [/[0-9]/]},
    {"name": "number$ebnf$2$subexpression$1$ebnf$1", "symbols": ["number$ebnf$2$subexpression$1$ebnf$1", /[0-9]/], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "number$ebnf$2$subexpression$1", "symbols": [{"literal":"."}, "number$ebnf$2$subexpression$1$ebnf$1"]},
    {"name": "number$ebnf$2", "symbols": ["number$ebnf$2$subexpression$1"], "postprocess": id},
    {"name": "number$ebnf$2", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "number", "symbols": ["number$ebnf$1", "number$ebnf$2"], "postprocess": d => ({ num: d.flat(3).join('') })},
    {"name": "boolean$string$1", "symbols": [{"literal":"y"}, {"literal":"e"}, {"literal":"s"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "boolean", "symbols": ["boolean$string$1"]},
    {"name": "boolean$string$2", "symbols": [{"literal":"n"}, {"literal":"o"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "boolean", "symbols": ["boolean$string$2"], "postprocess": d => ({ boo: d[0] })},
    {"name": "bareword$ebnf$1", "symbols": []},
    {"name": "bareword$ebnf$1", "symbols": ["bareword$ebnf$1", /[a-zA-Z0-9_]/], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "bareword", "symbols": [/[a-zA-Z_]/, "bareword$ebnf$1"], "postprocess": d => ({ bareword: d.flat().join('') })},
    {"name": "variable$string$1", "symbols": [{"literal":"t"}, {"literal":"h"}, {"literal":"e"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "variable", "symbols": ["variable$string$1", "__", "bareword"], "postprocess": d => ({ variable: d[d.length - 1] })},
    {"name": "_$ebnf$1", "symbols": []},
    {"name": "_$ebnf$1", "symbols": ["_$ebnf$1", /[ \t]/], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "_", "symbols": ["_$ebnf$1"], "postprocess": d => ('  ')},
    {"name": "__$ebnf$1", "symbols": [/[ \t]/]},
    {"name": "__$ebnf$1", "symbols": ["__$ebnf$1", /[ \t]/], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "__", "symbols": ["__$ebnf$1"], "postprocess": d => (' ')}
]
  , ParserStart: "main"
}
if (typeof module !== 'undefined'&& typeof module.exports !== 'undefined') {
   module.exports = grammar;
} else {
   window.grammar = grammar;
}
})();
