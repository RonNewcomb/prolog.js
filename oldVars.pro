### Accumulated standard library lives under here!

# unification and [ x, y, z; w ] support

[unify, X, X].

# [ a, b, c ] --> [conjunction, {a, b, c}]
[conjunction, {}].
[conjunction, {X | Rest}] if [call, X], [conjunction, Rest].

# [ a; b; c ] --> [disjunction, {a, b, c}]
[disjunction, {X | Rest}] if [call, X].
[disjunction, {X | Rest}] if [disjunction, Rest].

# Arithmetic
[add, A, B, C] if [external, "$1 + $2", {A, B}, C].   # A + B = C, etc.
[sub, A, B, C] if [external, "$1 - $2", {A, B}, C].
[mul, A, B, C] if [external, "$1 * $2", {A, B}, C].
[div, A, B, C] if [external, "$1 / $2", {A, B}, C].

# The canonical quicksort
[qsort, {}, {}].
[qsort, {X|Rest}, Answer] if [partition, X, Rest, {}, Before, {}, After], [qsort, Before, Bsort], [qsort, After, Asort], [append, Bsort, {X | Asort}, Answer].
[partition, X, {}, Before, Before, After, After].
[partition, X, {Y | Rest}, B, {Y | Brest}, A, Arest] if [leq, X, Y], [partition, X, Rest, B, Brest, A, Arest].
[partition, X, {Y | Rest}, B, Brest, A, {Y | Arest}] if [gtr, X, Y], [partition, X, Rest, B, Brest, A, Arest].

[leq, X, Y] if [compare, X, Y, gt].
[leq, X, Y] if [compare, X, Y, eq].
[gtr, X, Y] if [compare, X, Y, lt].

# Some list-processing stuff...
[append, {}, Z, Z].
[append, {A|B}, Z, {A|ZZ}] if [append, B, Z, ZZ].

[reverse, {}, {}].
[reverse, {A|B}, Z] if [reverse, B, Brev], [append, Brev, {A}, Z].

[length, {}, 0].
[length, {H|T}, N] if [length, T, M], [add, M, 1, N].

# Standard prolog not/1
[not, Term] if [call, Term], commit, [fail].
[not, Term].

# Standard prolog var/1
[var, X] if [bagof, l, [varTest, X], {l, l}].
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

[triple, P, X, Y] if NOTTHIS [triple, type, P, transitive], NOTTHIS [triple, P, X, Z], [triple, P, Z, Y].

[arcsOut, X, L] if [bagof, O, [triple, P, X, O], L].

[bagof, c, [triple, sc, A, B], L],   [length, L, N]?           # L should have 21 elements

[bagof, c, [triple, sc, A, B], L], [length, L, N]

[bagof, c, [triple, sc, A, B], L], [length, L, N].

[holds, "bucket", 834, yes].
[holds, "bucket", 834, yes]?
[holds, "bucket", 76, yes]?
[holds, "bucket", ?, yes]
[holds, "box", 411, no].
[holds, "envelope", 1, yes].
[holds, Container, Capacity, Whether]?