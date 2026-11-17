export const NOUL_TYPE = 'noul';
export const GATE_RULE_ID = 'would-reject';

export interface JevNoulQuestion {
  type: typeof NOUL_TYPE;
  instructions: string;
  criteria: { true: string; false: string };
}

export interface JevRule {
  id: string;
  question: JevNoulQuestion;
}

export const JEV_GATE_QUESTION: JevRule = {
  id: GATE_RULE_ID,
  question: {
    type: NOUL_TYPE,
    instructions:
      'Would a senior reviewer reject this change in code review because of a design, correctness or maintainability problem that is visible in `file.body`, `change.addedLines` or `context.files`? Judge only what is visible; do not speculate about unseen code or requirements.',
    criteria: {
      true: 'Visible evidence shows a problem a reviewer would raise',
      false:
        'The change is acceptable, or the evidence is insufficient to claim a problem',
    },
  },
};

export const JEV_RULES: readonly JevRule[] = [
  {
    id: 'guard-clauses',
    question: {
      type: NOUL_TYPE,
      instructions:
        'In `change.addedLines`, is the control flow nested so the main path is buried, instead of validating and exiting early?',
      criteria: {
        true: 'Conditionals nest two or more levels deep, or the main path sits inside a condition that could have returned early',
        false:
          'Each condition is handled with an early return or a flat sequence',
      },
    },
  },
  {
    id: 'fail-fast',
    question: {
      type: NOUL_TYPE,
      instructions:
        'In `change.addedLines`, is an invalid or impossible state papered over with a silent fallback instead of failing immediately?',
      criteria: {
        true: 'A default value or a silent coercion hides a broken dependency or a state that should never happen',
        false:
          'An impossible or invalid case throws with a clear message, or no such case appears',
      },
    },
  },
  {
    id: 'command-query',
    question: {
      type: NOUL_TYPE,
      instructions:
        'In `change.addedLines`, does a function return a value while changing a parameter, shared state or an external resource, or does a getter/query cause such a side effect? Ignore changes to local collections created inside the function to build its result.',
      criteria: {
        true: 'A function returns data while changing caller-visible state, or a getter/query mutates that state',
        false:
          'Local accumulation and read-only file access do not change caller-visible state',
      },
    },
  },
  {
    id: 'null-handling',
    question: {
      type: NOUL_TYPE,
      instructions:
        'In `change.addedLines`, is the same empty value reused to mean several different states, or are `null` and `undefined` mixed for one meaning?',
      criteria: {
        true: 'One empty value carries more than one business meaning, or null and undefined stand for the same thing in different places',
        false:
          'One convention is used and each distinct state has its own value',
      },
    },
  },
  {
    id: 'immutability',
    question: {
      type: NOUL_TYPE,
      instructions:
        'In `change.addedLines`, is an object or array received as a parameter modified in place?',
      criteria: {
        true: 'A parameter is pushed, assigned or deleted into, or a transform writes to state outside itself',
        false: 'New values are returned instead of changing the inputs',
      },
    },
  },
  {
    id: 'validate-once',
    question: {
      type: NOUL_TYPE,
      instructions:
        'Does `change.addedLines` repeat a required, type or range check that is visibly performed at the input boundary in `file.body` or `context.files`? Do not infer unseen validation.',
      criteria: {
        true: 'The same check is visible both at the boundary and in the added lines',
        false:
          'The boundary check is not visible, or the added lines do not repeat it',
      },
    },
  },
  {
    id: 'single-responsibility',
    question: {
      type: NOUL_TYPE,
      instructions:
        'Do the added lines give the changed function or class two unrelated reasons to change, visible in its body? Do not flag a function merely for coordinating focused collaborators.',
      criteria: {
        true: 'The changed unit itself performs two unrelated responsibilities with visible evidence',
        false:
          'The unit has one responsibility or only coordinates separate focused units',
      },
    },
  },
  {
    id: 'dependency-direction',
    question: {
      type: NOUL_TYPE,
      instructions:
        'Do the added lines introduce an import from business/domain code to infrastructure, HTTP, or a framework? Use paths and bodies in `context.files` as evidence; never infer a layer from an unavailable file.',
      criteria: {
        true: 'A new inward-to-outward dependency is visible in the import and its related file',
        false:
          'No such dependency is visible, or the roles of the files are unclear',
      },
    },
  },
  {
    id: 'comments',
    question: {
      type: NOUL_TYPE,
      instructions:
        'Does a comment in `change.addedLines` merely narrate obvious code instead of explaining non-obvious intent, a trade-off or a hazard?',
      criteria: {
        true: 'A newly added comment repeats what the adjacent code already says',
        false: 'No comment was added, or it explains non-obvious intent',
      },
    },
  },
  {
    id: 'testability',
    question: {
      type: NOUL_TYPE,
      instructions:
        'Do the added lines hardcode clock, network or randomness inside business logic, making deterministic tests difficult? Do not flag infrastructure adapters or entry points merely for using their own APIs.',
      criteria: {
        true: 'Business behavior directly depends on an uncontrollable external dependency with no visible injection point',
        false:
          'Dependencies are supplied, or the code is the adapter/composition boundary itself',
      },
    },
  },
  {
    id: 'contract-compatibility',
    question: {
      type: NOUL_TYPE,
      instructions:
        'Do added lines change a function signature, return shape or behavior in a way that demonstrably conflicts with a supplied non-test consumer? Require a concrete mismatch in visible code; do not speculate about unseen callers.',
      criteria: {
        true: 'A supplied consumer calls or interprets the changed contract incompatibly',
        false:
          'Visible consumers remain compatible, or there is insufficient evidence',
      },
    },
  },
  {
    id: 'test-quality',
    question: {
      type: NOUL_TYPE,
      instructions:
        'For behavior touched by the added lines, do supplied related tests have a demonstrable blind spot: assertions that cannot detect that behavior failing, or an explicit changed error branch left untested? Use both production and test bodies. Never infer absent repository coverage from missing files or partial context. Do not request tests that mirror implementation or cover unrelated code.',
      criteria: {
        true: 'Visible relevant tests fail to assert the changed observable behavior or a visible changed error case, with concrete evidence',
        false:
          'Assertions cover the behavior, the change is low-impact, or evidence is incomplete',
      },
    },
  },
  {
    id: 'decomposition-by-intent',
    question: {
      type: NOUL_TYPE,
      instructions:
        'In `change.addedLines`, does the changed function obscure orchestration with a coherent implementation operation that a named function with a clear contract would make understandable without reading its implementation, or does a new split make tightly coupled steps harder to understand? Require the operation and its surrounding orchestration or helper caller to be visible in `file.body` or `context.files`; do not infer unseen bodies. One caller is sufficient for a useful extraction. Never flag function length alone or require a split that introduces shared mutable state, excessive parameters, or functions that must be read together.',
      criteria: {
        true: 'Visible bodies show added implementation details obscuring the caller flow, with a coherent extractable operation and a clear independent contract, or a new split demonstrably harms comprehension by separating tightly coupled steps',
        false:
          'Names and contracts already convey the flow, coupled steps belong together, length is the only signal, or evidence is insufficient',
      },
    },
  },
  {
    id: 'unnecessary-abstraction',
    question: {
      type: NOUL_TYPE,
      instructions:
        'Do the added lines introduce a demonstrably redundant layer or combine visibly different domain concepts solely for similar syntax? Require evidence in supplied bodies. A single caller, delegation, injection, compatibility or a clear responsibility is not by itself a violation. Never infer requirements are absent or recommend removing required behavior.',
      criteria: {
        true: 'The added abstraction duplicates an existing role without adding a contract, responsibility or testability, or mixes visibly distinct concepts',
        false:
          'It serves a present responsibility or contract, or evidence is insufficient',
      },
    },
  },
];

export const JEV_PLAN_GATE_QUESTION: JevRule = {
  id: GATE_RULE_ID,
  question: {
    type: NOUL_TYPE,
    instructions:
      'Would a senior reviewer ask for changes to this plan before approving it, because of a design, scope or verification problem visible in `plan.text` or `files`? Judge only what is visible.',
    criteria: {
      true: 'Visible evidence shows a plan problem a reviewer would raise',
      false: 'The plan is acceptable as written, or the evidence is insufficient',
    },
  },
};

export const JEV_PLAN_RULES: readonly JevRule[] = [
  {
    id: 'plan-duplicates-existing',
    question: {
      type: NOUL_TYPE,
      instructions:
        'Does `plan.text` introduce a module, type or abstraction that duplicates one already visible in `files`?',
      criteria: {
        true: 'A supplied file already provides the same responsibility and the plan adds another copy',
        false:
          'No visible duplicate exists, or the plan extends the existing one explicitly',
      },
    },
  },
  {
    id: 'plan-abstraction-justified',
    question: {
      type: NOUL_TYPE,
      instructions:
        'Does the plan add an abstraction with a single caller and no clear contract that improves comprehension or testability?',
      criteria: {
        true: 'The abstraction has one caller, no stated contract and no reason in the plan',
        false:
          'The plan states a present responsibility, compatibility or testability reason, or proposes no new abstraction',
      },
    },
  },
  {
    id: 'plan-bundled-decisions',
    question: {
      type: NOUL_TYPE,
      instructions:
        'Does the plan bundle independent decisions that the user or a reviewer should weigh separately?',
      criteria: {
        true: 'Two or more unrelated choices are presented as one, with no way to decide them apart',
        false: 'The decisions are separable or the plan states a single decision',
      },
    },
  },
  {
    id: 'plan-verification',
    question: {
      type: NOUL_TYPE,
      instructions:
        'Does the plan change behavior without any verification step (a test, a check or a manual confirmation) stated for it?',
      criteria: {
        true: 'Changed behavior has no stated verification step',
        false: 'The plan states how the changed behavior will be verified',
      },
    },
  },
  {
    id: 'plan-contradicts-evidence',
    question: {
      type: NOUL_TYPE,
      instructions:
        'Does the plan contradict a constraint visible in `files`, such as an existing API, contract or documented behavior?',
      criteria: {
        true: 'A supplied file shows a conflicting contract and the plan does not address it',
        false: 'No conflict is visible, or the plan addresses it',
      },
    },
  },
];

export const JEV_QUESTIONNAIRE_GATE_QUESTION: JevRule = {
  id: GATE_RULE_ID,
  question: {
    type: NOUL_TYPE,
    instructions:
      'Would a senior reviewer ask to reword these questions before showing them to the user, because of an option design or a recommendation problem visible in `questions`? Judge only what is visible.',
    criteria: {
      true: 'Visible evidence shows a question problem a reviewer would raise',
      false: 'The questions are acceptable, or the evidence is insufficient',
    },
  },
};

export const JEV_QUESTIONNAIRE_RULES: readonly JevRule[] = [
  {
    id: 'questionnaire-overlapping-options',
    question: {
      type: NOUL_TYPE,
      instructions:
        'Do two options in the same single-choice question cover the same intent, so either could be chosen for one need?',
      criteria: {
        true: 'Two options describe the same outcome and only the wording differs',
        false: 'Every option names a distinct outcome',
      },
    },
  },
  {
    id: 'questionnaire-bundled-decisions',
    question: {
      type: NOUL_TYPE,
      instructions:
        'Does one question combine independent decisions that deserve separate answers?',
      criteria: {
        true: 'One answer would have to settle two unrelated choices',
        false: 'The question asks one decision, or the choices are dependent by design',
      },
    },
  },
  {
    id: 'questionnaire-unsupported-recommendation',
    question: {
      type: NOUL_TYPE,
      instructions:
        'Is the recommended option inconsistent with the question or with another option, or does it assert a fact that the visible text does not support?',
      criteria: {
        true: 'The recommended option contradicts the question, an option description, or states an unsupported claim',
        false: 'No inconsistency is visible, or nothing is recommended',
      },
    },
  },
];

export const JEV_TODO_GATE_QUESTION: JevRule = {
  id: GATE_RULE_ID,
  question: {
    type: NOUL_TYPE,
    instructions:
      'Would a senior reviewer reject a completion claim in `items` because the observed check state in `check` contradicts it? Judge only what is visible.',
    criteria: {
      true: 'A completed item claims work that the failed check contradicts',
      false: 'No contradiction is visible, or the evidence is insufficient',
    },
  },
};

export const JEV_TODO_RULES: readonly JevRule[] = [
  {
    id: 'todo-contradicts-check',
    question: {
      type: NOUL_TYPE,
      instructions:
        'Does a completed item in `items` claim behavior that the observed check state in `check` contradicts?',
      criteria: {
        true: 'The check is observed as failed and an item claims that work is complete',
        false: 'No completion claim conflicts with the visible check state',
      },
    },
  },
  {
    id: 'todo-unsupported-claim',
    question: {
      type: NOUL_TYPE,
      instructions:
        'Does a completed item claim a verification or behavior that the visible item text does not support, such as claiming tests passed when the item does not mention running them?',
      criteria: {
        true: 'The item asserts evidence that its own text does not describe',
        false: 'The item text is consistent with what it claims',
      },
    },
  },
];
