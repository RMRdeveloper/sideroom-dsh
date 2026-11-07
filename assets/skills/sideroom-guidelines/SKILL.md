---
name: sideroom-guidelines
description: Load the coding contract and the language guide before any write or edit. Covers Java, PHP/Laravel, JavaScript, TypeScript, Python, Go and Rust.
license: MIT
metadata:
  author: RMRdeveloper
---

# Sideroom guidelines

Load this contract before the first `write` or `edit` of a run. It is what unlocks the
mutation tools.

Call `sideroom_guidelines` with the target file's `path`: it returns this contract and
the matching language guide. A full `read` of the packaged files also counts; a partial
load does not, and a same-named file elsewhere does not. Load each additional target
language before editing it, and reload after compaction or a new run.

## Rules

- Apply the loaded guide to the code you change, under the full requirement and the
  project's contracts. A KISS, DRY or YAGNI argument never removes requested behavior,
  required error handling, compatibility or meaningful tests.
- Architectural rules need demonstrated evidence.
- No bypass through Bash or another mutation tool.
- Fail fast, keep control flow flat, validate once at the boundary.

## Decision gates

| Path | Guide |
| --- | --- |
| `.java` | `references/languages/java.md` |
| `.js` `.jsx` `.mjs` `.cjs` | `references/languages/javascript.md` |
| `.php` | `references/languages/php-laravel.md` |
| `.ts` `.tsx` | `references/languages/typescript.md` |
| `.py` | `references/languages/python.md` |
| `.go` | `references/languages/go.md` |
| `.rs` | `references/languages/rust.md` |
| other | this contract only |

## Steps

1. Load the contract and the guide for every language you touch.
2. Implement a focused change that satisfies the current requirements and preserves
   required behavior.
3. Re-read the lines you added against the guide and fix what violates it, without
   refactoring unrelated code.
4. Run the formatter, the linter, the type checks and the tests the project defines.

## Do / Don't

| Do | Don't |
| --- | --- |
| Braces around every `if` body (Python: a full indented suite) | Unbraced or one-line conditional bodies |
| Early return on bad input | Pyramid `if/else` nesting |
| Explicit error, fail now | Fallbacks that hide the real failure |
| One responsibility per unit | Validate + transform + persist + notify together |
| Extract for real duplication, a present responsibility, or testability | Abstract only for hypothetical future reuse |
| Decomposition by intent (rule 20): name a coherent operation so its caller reads the flow without implementation details, even with one caller | Split only to shorten functions, or separate coupled steps into shared mutable state, excessive parameters, or functions that must be read together |
| Simplest design that satisfies the full requirements | Omit necessary structure to minimize code |
| Implement current requirements and established contracts completely | Add capabilities only for hypothetical future cases |
| Compose small focused units | Deep inheritance for unrelated behavior |
| Talk only to immediate collaborators | Reach through another object's internals |
| A function either does or returns, not both | Side effects inside a getter |
| Validate once at the edge | Re-check the same invariant inward |
| One validator per input | Two validators for the same body/query |
| Let errors surface with context | Empty `catch` or catch-and-continue |
| Return new values instead of mutating input | Mutate parameters |
| One meaning per null/undefined | Overload null for several business states |
| Inject dependencies | Hardcode infra that blocks tests |
| Inner layers depend on nothing outward | Domain imports of DB/HTTP/framework types |
| Names that reveal role or domain meaning | `data`, `info`, `temp`, `result`, `obj` |
| Named const/enum/contract for domain literals | Magic strings |
| Depend on ports where variation is real | Couple a use case to a concrete implementation |
| Comments only for non-obvious intent | Narration, noise, or stale TODOs |

For JavaScript and TypeScript, a function with 3 or more parameters takes one
destructured object, unless an external or public contract fixes the signature.

## Output

Changed code follows the loaded guide. The final response names the validation you ran
and any check that could not run.
