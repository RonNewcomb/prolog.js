
# nearleyc projama.ne -o projama.js
# nearley-unparse projama.js -s main
# nearley-test projama.js -qi "[drive, \"bob\", [downtown], the car]."  
# nearleyc projama.ne -o projama.js && nearley-test projama.js -qi "[drive, \"bob\", [downtown], the car]."  
# nearleyc projama.ne -o projama.js && nearley-test projama.js -qi "[holds, \"bucket\", 834, yes]?"
# nearleyc projama.ne -o projama.js && nearley-test projama.js -qi "[drive, \"bob\", [downtown], the car, 50.5, no] if [drive], [start]."  

main      -> line:+                                             {% d => ({ lines: d.flat(4)}) %}
line      -> rule | query                                      #{% d => ({ lines: d[0] }) %}
rule      -> _ tuple (__ "if" __ tuplelist):? "." _             {% d => ({ head: d[1], query: d.slice(2).flat(2).filter(x => !!x && typeof x !== 'string')[0]?.tuplelist ?? [] }) %}
query     -> _ tuplelist "?" _                                  {% d => ({ query: d[1] }) %}
tuplelist -> tuple (_ "," _ tuple):*                            {% d => d.flat(5).filter(x => !!x && typeof x !== 'string') %}
tuple     -> "[" _  tupleitem ( _ "," _ tupleitem ):* _ "]"     {% d => ({ tuple:     d.flat(5).filter(x => !!x && typeof x !== 'string') }) %}
tupleitem -> ( variable | literal | tuple )                    #{% d => ({ tupleitem: d[0][0] }) %}
literal   -> ( string | number |           bareword )           {% d => ({ literal: d[0][0] }) %}
string    -> ["] [^"]:* ["]                                     {% d => ({ str: d[1].join('') }) %}
number    -> [0-9]:+ ("." [0-9]:+):?                            {% d => ({ num: d.flat(3).join('') }) %}
boolean   -> "yes" | "no"                                       {% d => ({ boo: d[0] }) %}
bareword  -> [a-zA-Z_] [a-zA-Z0-9_]:*                           {% d => ({ bareword: d.flat().join('') }) %}
variable  -> "the" __ bareword                                  {% d => ({ variable: d[d.length - 1] }) %}
_       -> [ \t]:*                                              {% d => ('  ') %}
__      -> [ \t]:+                                              {% d => (' ') %}
## _         -> [ ]:?

