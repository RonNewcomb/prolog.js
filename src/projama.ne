
# nearleyc ./src/projama.ne -o ./tmp/projama.js
# nearley-unparse ./tmp/projama.js -s main
# nearley-test ./tmp/projama.js -qi "[drive, \"bob\", [downtown], the car]."  
# nearleyc ./src/projama.ne -o ./tmp/projama.js && nearley-test ./tmp/projama.js -qi "[drive, \"bob\", [downtown], the car]."  
# nearleyc ./src/projama.ne -o ./tmp/projama.js && nearley-test ./tmp/projama.js -qi "[holds, \"bucket\", 834, yes]?"
# nearleyc ./src/projama.ne -o ./tmp/projama.js && nearley-test ./tmp/projama.js -qi "[drive, \"bob\", [downtown], the car, 50.5, no] if [drive], [start]."  

main      -> statement:+                                        {% d => ({ statements: d.flat(4)}) %}
statement -> rule | query | command                            #{% d => ({ statements: d[0] }) %}
rule      -> _ tuple (__ "if" __ tuplelist):? "." _             {% d => ({ head: d[1], query: d.slice(2).flat(2).filter(x => !!x && typeof x !== 'string')[0]?.tuplelist ?? [] }) %}
query     -> _ tuplelist "?" _                                  {% d => ({ query: d[1] }) %}
command   -> _ bareword _ ";" _                                 {% d => ({ command: d[1] }) %}
tuplelist -> tuple (_ "," _ tuple):* _                          {% d => d.flat(5).filter(x => !!x && typeof x !== 'string') %}
tuple     -> "[" _  tupleitem ( _ "," _ tupleitem ):* _ "]"     {% d => ({ tuple:     d.flat(5).filter(x => !!x && typeof x !== 'string') }) %}
tupleitem -> ( variable | literal | tuple )                    #{% d => ({ tupleitem: d[0][0] }) %}
literal   -> ( string | number |           bareword )           {% d => ({ literal: d[0][0] }) %}
string    -> ["] [^"]:* ["]                                     {% d => ({ rtype: 'string', rvalue: d[1].join('') }) %}
number    -> [0-9]:+ ("." [0-9]:+):?                            {% d => ({ rtype: 'number', rvalue: d.flat(3).join('') }) %}
boolean   -> "yes" | "no"                                       {% d => ({ rtype: 'boolean', rvalue: d[0] }) %}
bareword  -> [a-zA-Z_] [a-zA-Z0-9_]:*                           {% d => ({ rtype: 'bareword', rvalue: d.flat().join(''), bareword: d.flat().join(''),  }) %}
variable  -> "the" __ bareword                                  {% d => ({ variable: d[d.length - 1] }) %}
_       -> [ \t]:*                                              {% d => ('  ') %}
__      -> [ \t]:+                                              {% d => (' ') %}
## _         -> [ ]:?

