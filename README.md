# Projog

_Prolog in sweatpants_

`tsc && rollup -c`

There's a maxim in software development: once you know one language, you know them all. It's not hard to see why. Variables, loops, "if" statements, we see the same constructs in different clothes everywhere. But there's one language that really is quite different from the others, and that's Prolog.

Created in the early 1970s, Prolog's concept is that of executable logic proofs. Much of the terminology surrounding Prolog follows suit. Perhaps in the 70s everyone who worked with computers knew all about Horn clauses and the like so this seemed natural. Or at least there was much less consensus on how coding languages should be.

But nowadays computers and coding are quite distinct from math and logic, having more in common with natural language and with business. This makes Prolog doubly difficult to learn, and that's a shame because it challenges one to think about problems and solutions in a way that's quite distinct from nearly every other thing that isn't actually a descendent of Prolog.

Here, then, is Projog: trade the starchy white shirt for some comfy sweats and re-imagine Prolog for the everyday dev.

## Memorize and Recall

Let's assume you know javascript or something similar. It's a very common language, its syntax tends to be a grab-bag of common things from many other languages, and it's found on nearly anything with a keyboard attached.

```
[holds, "bucket", 834, yes].
```

This array literal is a statement all by itself. If entered into a Projog console it might elicit the response `Memorized.`

The bare word `holds` is a _symbol_. As with javascript you can't really do much with symbols other than hang things off of them or compare them to other symbols. The text, number, and boolean are pretty self-explanatory.

The final period has the same role as a final `;` semicolon in most languages.

```
[holds, "bucket", 834, yes]?
```

Here the period changes to a `?` question mark. If entered the console would reply `Yes.` But change any of the four values and it would reply `No.`

```
[holds, "bucket", ?, yes]
```

Quoth the console: `834`. If all four values are supplied the only question is, "do these values go together, yes or no?". But if one value is missing, the question becomes, "what value would go here?"

```
[holds, "box", 411, no].
[holds, "envelope", 1, yes].
```

After these two statements and including the bucket we now have three things memorized. It's the smallest database in the world.

## The...

```
[holds, "box", the capacity, no]?
```

Console: `The capacity is 411.`

The word `the` acts much like javascript's `var` or `const` keyword: it declares a new VARiable or CONSTant to exist in the world.

Asking a question with `the whatever` instead of a lone question mark like `[holds, "box", ?, no]` is how we can name things in order to reference them from elsewhere.

## If...

Here's a longer line.

```
[holds, "sack", the capacity, yes] if [lessthan, the capacity, 675].
```

Console: `Memorized.`

Asking questions about this sack can give a slew of answers without us writing out 675 different array literals to do so. When a question comes up in the form `[holds, "sack", 45, yes]?` it'll assign 45 to `the capacity` and then the yes/no answer will come from what follows the `if`, which seems self-explanatory here.

But why isn't assigning a number to `the capacity` different from getting the number back out again? Perhaps it's just a function call: the name and parameters are on the left, the body of the function is after the `if`.

But if so, then `holds` is a function name, and shouldn't it be named `canHold` or `isHolding` or even phrased as command `holdThis`?

Hold that thought.

## Functions That Run Backwards

By convention, the first item in one of these array literals, the so-called function name, will be a symbol or string that's named by a verb. But unlike most languages the verb does not need to be an imperative verb, as in issuing a command. It can be a verb of state such as "is", "dreams", "carries", "upholds", and so on.

These array literals are _relationships_. A binary _operation_ like addition is a _trinary_ relationship: the three nouns are the three numbers, two inputs and one output.

```
[add, 505, 40, the sum]?
```

Console: `The sum is 545.`

But that isn't actually a function call. This is Projog. That's a pattern match. So you can also subtract with it.

```
[add, 505, the difference, 545]
```

Console: `The difference is 40.`

Instead of thinking in terms of inputs and outputs, realize both are part of a relationship, like living together in the same row of a database table called `adds`. Given all but one value the remaining one can be sought.

## Variables are Just Constants We Haven't Met Yet

So now we can answer the question, "why doesn't assigning a number to a variable look different from getting the number back out again? How can a language possibly work when it can't tell one from the other?"

When Projog is answering a question and hits something like `... if [holds, "sack", the capacity, 675]` it's already tracking whether `the capacity` has been assigned to or not. If it has _not_ been assigned to then it assigns it now. But it if _has_ been assigned to then `the capacity` is treated like a constant, so the value within is used to compare with. This means `[holds, "sack", the capacity, 675]` can change from being a which-one question (when `the capacity` is unknown) to being a yes/no question (when `the capacity` is known).

If add and subtract are the same relationship, one the opposite of the other, then reading and writing a variable is similarly a two-sided coin, a `known?` relationship between name (`the capacity`) and number (`545`).

## Many...

What happens when there are multiple answers to a question?

```
[holds, "bucket", 834, yes].
[holds, "box", 411, no].
[holds, "envelope", 1, yes].
[holds, the container, the capacity, yes]?
```

Projog will report the first answer it finds. But there's a few cases where it will dig for further answers.

1. All answers can be retrieved immediately as an array by using `many` instead of `the` for the variable. ((findall,bagof,setof))
1. If the first answer causes a failure later, the next answer will be fetched to retry. This is done under the hood using generators to yield-return items one at a time. The concept is related to async/await in saying "some of this is for a later time".
1. An explicit command can get the `next` answer.

```
[holds, many containers, the capacity, yes]?
```

Console: `The containers are "bucket", "envelope". The capacity is 834.`

## Destructuring The `Rest` of It

The `...` ellipsis can be used to get all of an array except the items explicity named. Typically in order to process all items of an array we process the first item then pass the rest of the array back to the function.

```
[shift, [the item, ...the rest], the rest, the item].
```

The array being destructured must have enough items to fill in the explicity named parameters. It does not need an extra parameter for the `...` variable, which will simply be an empty array in that case.

## Back up and try again

```
[holds, "sack", the capacity, yes] if
    [add, 500, the capacity, the availability],
    [lessthan, the availability, 675].
```

That's one long line, `Memorized.`

What the line doesn't have is `the availability = [add, 500, the capacity]` or something to that effect. It looks like what should be the result of `add` is instead an input, and if there's any output at all it's just a yes/no.

When Projog tries to answer a question about the sack, it sets `the capacity` to, say, 378, and then looks at `add`. `Add` has all values except one filled in, so it answers if `[add, 500, 378, ?]`. Sure enough, somewhere in projog's standard library is an array literal involving `add` and only the first two numbers. There's only one literal for that particular case, `878`, and so, `The availability is 878. Yes.`

Then projog proceeds to answer the `lessthan` question, which is a `No.` So projog asks `add` again if it has a second choice. Which is also a `No.`

At an impasse, the whole sentence is, for the case of 378, a no.

## Ask...

If a statement or question (i.e., an array literal with or without a question mark in it) is in a variable, `ask` can be used to ask it.

The `and` relationship is defined this way.

```
[and, []].
[and, [the question, ...the rest]] if [ask, the question], [and, the rest].
```

## Array Shift

The javascript function `array.shift()` removes the first element of the array, returning it. The array is permanently changed.

Projog has a similar functionality that works much like the `[add, x, y, sum]` example.

```
[shift, an array, the shorter array, the item].
```

Which, depending on the direction of execution, creates a longer array from a shorter array and an item, or shortens a long array by returning one of the items off of it. Either way an item is shifting onto or off of the beginning of the array. Its implementation:

```
[shift, [], [], nothing] if rollback.
[shift, [the item], [], the item].
[shift, [the item, ...the rest], [...the rest], the item].
```

## A... Type

```
[holds, "sack", a number, yes].
```

Console: `Memorized.`

```
[holds, "sack", 654, yes]?
[holds, "sack", "shoe", yes]?
```

Console: `Yes. No.`

The word `a` has synonyms `an` and `any`. Occasionally `some` is allowed when it doesn't conflict with its `many` interpretation.

`The` and `a` are actually somewhat interchangeable, but usually `a` implies an input while `the` implies an output. Unless the func is ran backwards of course then it's reversed.

Some functions can't be ran multidirectionally so there's an explicit type check to ensure a param is always input, or always output.

## Shortcut

Instead of `[holds, 'box', the capacity], [something, the capacity, something else]` we can use the `( )` round parenthesis to make the last parameter the returned value, so you don't need to declare a go-between var like `the capacity`: `[something, (holds, 'box'), something else]`. It's also a shortcut for a question mark that returns in-place if not used to talk to the console: `[something, [holds, 'box', ?], something else]`

## Try and Commit, Fail and Rollback

Backtracking.

## Input, Output, and Committing

I/O is tricky in a backtracking language. The execution will perform the I/O successfully, something later will break, backtrack before the I/O, then re-run the I/O on the next attempt, repeat.

So I/O doesn't happen until the `commit` operator is passed, at which point all I/O is flushed.

But what if the input is needed before the next commit? Well, if the input operation doesn't require any bound input vars or if those vars cannot be unbound then the input can happen immediately and self-cache. The next commit clears its cache.

## Compilation: Trying To Render Rules Redundant

Specifying type for a slot is done as a normal function call, where in most language that is statically checked, at build time. Then the types are removed from the resulting binary because they assuredly cannot fail at runtime; they have served their purpose.

Functions to check types are not special in any way. The goal of the compiler is to render useless every rule it can: type checking, chronological sorting, deterministic calculations. Ideally a runtime won't be created at all because the final answer can be outputted instead. That's the theoretical ideal anyway.

## But Is It Useful?

So projog gives us a few cool features.

1. Run functions backwards. Theoretically this means we can write half as many functions as normal languages and do the same work. Also the libraries we use have half as many functions to learn but still have their full power.
1. Backtracking. Even functions that return lists can instead return a single value. The correct value will be found eventually. Theoretically we can write all of our functions to work for single items and they will still work on lists of items automatically.
1. Creating solutions. Theoretically we don't need to specify how something is done as long as we both describe the problem and provide the proper building blocks so the compiler can figure out the rest.

We'd like to code by writing "thou shalt" declarations of relationships that must always be true even in a world of ever-changing values, and the compiler will crank out a program that does just that.

# Notes

### (arithmetic) term rewriting

For `add_3_and_double(X,Y) :- Y is (X+3)*2.` we might hope that posing the query `add_3_and_double(X,12)` would return the answer `X=3` but it errors instead because `is`, which performs arithmetic, is one-directional. It cannot do term-rewriting.

One side of the equals sign: https://github.com/SJasoria/Reduce-Algebraic-Expressions

Both sides: https://stackoverflow.com/questions/13690136/im-curious-if-logic-programs-can-do-algebra

See also clpfd-constraints library.

### destructuring and naming

Destructuring by `[H|T]` shortcut used in `[processEach, [H|T], somethingelse] if ...`?

The issue with that destructure is there's no names for what the user passes in. The first param to `processEach` is a list of whats? With the parens I've also lost the opportunity to name something important, the thing that's at the interface between functions. This is why Prolog and Haskell are so hard to read.

`[pop, a list, the shorter list, the item]`
`[pop, a list, the item, the shorter list]`

`[processEach, many cards like [H|T], somethingelse] if ...`?

is `like` really required cause it reads weird

maybe auto-vars. `the first card`, `the second card`, `the other cards` / `the rest of the cards` seems good.

### other

`if not` = `unless`/`except if`

`X if Y.` ...also `X while Y` or `X until Y` for temporal assertions?

### When function name = name of retval var => property

`leng(List,Length) :- countItemsInFrom(List,0,Length).` The 'function' name is the same as the return var. `(length, List)` is still `[length, List, the length]`. But also `the length of the List`, a property. So definition `[length, a list, the length] if [countItemsInFrom, the list, 0, the length].` written as `(length, a list) if (countItemsInFrom, the list, 0).` like that? Is that enough info, to know the `( )` vars unify? What about multiple `( )` terms in the body? All unify with each other since they are written at top-level? Sure.

Accumulator code to reverse a list

```
[accRev, many items {at least one!}, an accumulator, the returnedlist] if [accRev, the other items, [the first item | the accumulator], a returnedlist].
[accRev, [], an accumulator, the accumulator].
[reverse, many items, the returnedlist] if [accRev, many items, [], the Returnedlist].
```

### Arity of answers

- det A deterministic predicate always succeeds exactly once and does not leave a choicepoint.
- semidet A semi-deterministic predicate succeeds at most once. If it succeeds it does not leave a choicepoint.
- nondet A non-deterministic predicate is the most general case and no claims are made on the number of solutions (which may be zero, i.e., the predicate may fail) and whether or not the predicate leaves an choicepoint on the last solution.
- multi As nondet, but succeeds at least once.
- undefined Well founded semantics third value. See undefined/0.

### instances of unknown

Implementation note on Unification: the order doesn't matter. `x=5, x=y` obviously means y is 5, but also `x=y, ..time passes.., x=5` also means y is 5. `x=y` are both unknown but they're set to the _same_ unknown. This means `unknown` is a type not just a value. Each initialization to `unknown` gets a different, unique instance of `unknown`.

### types

A variable's name may or may not be a type: `a number` is obviously a type, but `a car` may or may not be depending on if `a car` was defined (by `is`?) elsewhere to be a datatype.

Base types have adjective forms that can be useful if multiple vars of the same type appear in a tuple: `[a numeric force, a numeric mass, a numeric acceleration]`.

How much of types are in the compiler and how much are 'just a default library of rules'? We usually attach info with basic facts: `[is, a Chevy, a car]`. But there's a lot of numbers and even more strings to categorize. Looking at an atom, parsing it for surrounding quotes or ensuring all chars are digits can be done with a library rule, but also, might want to have compiler help to be more efficient. The datatypes themselves are atoms/barewords.

```
[yes, is, datatype, boolean].
[no, is, datatype, boolean].
[_, is, datatype, boolean] if no.
```

Doing the above for, for example, numbers requires the ability to process symbols/literals as strings. And parsing should probably already be finished by that time anyway.

But if not, then units of measure wouldn't require compiler support. You write parse/print rules that work not only on input files but also on the source itself.

And does the type of a literal matter if it's not passed to something with a type restriction?

### assert and retract used to cache

Making and breaking relationships is done at runtime with `[cache, relationship, where]` and `[uncache, relationship]`, treating the whole program source as a self-modifying program. `where` is either the beginning of the code or the end.

This is best used to cache complex results.

It's similar to `new Object(...)` in that a relationship with all values filled in is basically a new row in a database table, which, with an ORM, is basically a new object. But garbage-collecting this kind of object is difficult because how would we ever know when its purpose is done? It isn't owned or pointed to by other objects or vars.

Caching is mutative, but if the global env (or at least the memory heap) appears in the code as a list then it's just another reversible relation-function.

```
[cache, globalEnvWithoutRelationship, relationship, globalEnvWithRelationship]
```

### findall

Returning all values instead of backtracking: `all cards`?

Instead of `?- descends(martha,X).` to yield-return 4 possible answers, `?- findall(X,descends(martha,X),Z).` returns one answer, a list of 4 values. It's like `const Z = globalEnv.findall(x => isDescendent(mary, x));`

```
descends(martha, joey)
descends(martha, johnnie)
descends(martha, jamie)
descends(martha, jane)
descends(wanda, tommie)
[findall, the kid, [descends, martha, the kid], the kids]?
```

(NOTE imperative languages need the lambda wrapper `x => descends(mary,x)` because without it, `descends` is immediately invoked and only a result is passed down to `findall`, where it wanted instead to pass down the func itself so `findall` could invoke and re-invoke it until it fails, so it can then return the completed list.)

`bagof` is if `martha` was instead a var, then it yield-returns multiple sets of var bindings.

```
[findall, the kid, [descends, the mother, the kid], the kids]?
```

Console: `Mother=martha Z=[jo,jo,ja,ja]; Mother=wanda Z=[tommie];`

`setof` removes duplicates (and sorts, incidentally)
