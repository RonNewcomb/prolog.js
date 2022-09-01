### Accumulated standard library lives under here!

# unification and [ x, y, z; w ] support

[unify, an xxx, an xxx].

# [ a, b, c ] --> [conjunction, {a, b, c}]
[conjunction, {}].
[conjunction, {an xxx | the rest}] if [call, an xxx], [conjunction, the rest].

# [ a; b; c ] --> [disjunction, {a, b, c}]
[disjunction, {an xxx | the rest}] if [call, an xxx].
[disjunction, {an xxx | the rest}] if [disjunction, the rest].

# arithmetic
[add, an aaa, a bbb, C] if [external, "$1 + $2", {an aaa, a bbb}, C].   # an aaa + a bbb = C, etc.
[sub, an aaa, a bbb, C] if [external, "$1 - $2", {an aaa, a bbb}, C].
[mul, an aaa, a bbb, C] if [external, "$1 * $2", {an aaa, a bbb}, C].
[div, an aaa, a bbb, C] if [external, "$1 / $2", {an aaa, a bbb}, C].

# The canonical quicksort
[qsort, {}, {}].
[qsort, {an xxx|the rest}, an aaanswer] if [partition, an xxx, the rest, {}, a bbbefore, {}, an aaafter], [qsort, a bbbefore, a bbbsort], [qsort, an aaafter, an aaasort], [append, a bbbsort, {an xxx | an aaasort}, an aaanswer].
[partition, an xxx, {}, a bbbefore, a bbbefore, an aaafter, an aaafter].
[partition, an xxx, {a yyy | the rest}, a bbb, {a yyy | a bbbrest}, an aaa, an aaarest] if [leq, an xxx, a yyy], [partition, an xxx, the rest, a bbb, a bbbrest, an aaa, an aaarest].
[partition, an xxx, {a yyy | the rest}, a bbb, a bbbrest, an aaa, {a yyy | an aaarest}] if [gtr, an xxx, a yyy], [partition, an xxx, the rest, a bbb, a bbbrest, an aaa, an aaarest].

[leq, an xxx, a yyy] if [compare, an xxx, a yyy, gt].
[leq, an xxx, a yyy] if [compare, an xxx, a yyy, eq].
[gtr, an xxx, a yyy] if [compare, an xxx, a yyy, lt].

# Some list-processing stuff...
[append, {}, a zzzz, a zzzz].
[append, {an aaa|a bbb}, a zzzz, {an aaa|the differentz}] if [append, a bbb, a zzzz, the differentz].

[reverse, {}, {}].
[reverse, {an aaa|a bbb}, a zzzz] if [reverse, a bbb, a bbbrev], [append, a bbbrev, {an aaa}, a zzzz].

[length, {}, 0].
[length, {an hhhh|the tttt}, the nnn] if [length, the tttt, the mmm], [add, the mmm, 1, the nnn].

# Standard prolog not/1
[not, the tttterm] if [call, the tttterm], commit, [fail].
[not, the tttterm].

# Standard prolog var/1
[var, an xxx] if [bagof, l, [varTest, an xxx], {l, l}].
[varTest, a].
[tarTest, b].

#
# 
# Enter your ruleset in here.
[triple, sc, a, b].
[triple, sc, b, c].
[triple, sc, c, d].
[triple, sc, d, e].
[triple, sc, e, f].
[triple, sc, f, g].
[triple, type, sc, transitive].

[triple, the ppl, an xxx, a yyy] if NOTTHIS [triple, type, the ppl, transitive], NOTTHIS [triple, the ppl, an xxx, a zzzz], [triple, the ppl, a zzzz, a yyy].

[arcsOut, an xxx, the lost] if [bagof, the oolong, [triple, the ppl, an xxx, the oolong], the lost].

[bagof, c, [triple, sc, an aaa, a bbb], the lost], [length, the lost, the nnn]
[bagof, c, [triple, sc, an aaa, a bbb], the lost], [length, the lost, the nnn].
[bagof, c, [triple, sc, an aaa, a bbb], the lost],   [length, the lost, the nnn]?           # the lost should have 21 elements

[holds, "bucket", 834, yes].
[holds, "bucket", 834, yes]?
[holds, "bucket", 76, yes]?
[holds, "bucket", the capacity, yes]?
[holds, "bucket", the capacity, yes]
[holds, "bucket", ?, yes]
[holds, "box", 411, no].
[holds, "envelope", 1, yes].
[holds, a container, a capacity, any whether]?