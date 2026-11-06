import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  collectFindings,
  evaluate,
  type Finding,
  type RulePolicy,
} from '../src/rules/index.js'
import type { RuleCounter as Counter } from '../src/state/store.js'

interface Case {
  label: string
  language: string
  lines: string[]
  rule: string | null
}

const CASES: readonly Case[] = [
  {
    label: 'braced same line',
    language: 'javascript',
    lines: ['if (!user) return 0;'],
    rule: 'braced-conditionals',
  },
  {
    label: 'braced next line',
    language: 'javascript',
    lines: ['if (!user)', '  return 0;'],
    rule: 'braced-conditionals',
  },
  {
    label: 'braced ok',
    language: 'javascript',
    lines: ['if (!user) {', '  return 0;', '}'],
    rule: null,
  },
  {
    label: 'else braceless',
    language: 'javascript',
    lines: ['} else return;'],
    rule: 'braced-conditionals',
  },
  {
    label: 'catch returns null',
    language: 'javascript',
    lines: ['  } catch (e) { return null; }'],
    rule: 'swallowed-errors',
  },
  {
    label: 'catch empty block',
    language: 'javascript',
    lines: ['} catch (error) {', '}'],
    rule: 'swallowed-errors',
  },
  {
    label: 'catch rethrow ok',
    language: 'javascript',
    lines: [
      '} catch (error) {',
      '  throw new Error(`x: ${error.message}`, { cause: error });',
      '}',
    ],
    rule: null,
  },
  {
    label: 'python except pass',
    language: 'python',
    lines: ['except Exception:', '    pass'],
    rule: 'swallowed-errors',
  },
  {
    label: 'python except raise ok',
    language: 'python',
    lines: [
      'except ValueError as error:',
      '    raise DomainError("bad") from error',
    ],
    rule: null,
  },
  {
    label: 'go empty err block',
    language: 'go',
    lines: ['if err != nil { }'],
    rule: 'swallowed-errors',
  },
  {
    label: 'go wrapped ok',
    language: 'go',
    lines: ['if err != nil {', '  return fmt.Errorf("load: %w", err)', '}'],
    rule: null,
  },
  {
    label: 'vague name',
    language: 'javascript',
    lines: ['const data = getRows();'],
    rule: 'clear-names',
  },
  {
    label: 'stale marker',
    language: 'javascript',
    lines: ['// TODO: remove this'],
    rule: 'stale-comments',
  },
  {
    label: 'commented code',
    language: 'javascript',
    lines: ['// const total = sum(items);'],
    rule: 'commented-code',
  },
  {
    label: 'comment prose ok',
    language: 'javascript',
    lines: ['// return the value the caller expects'],
    rule: null,
  },
  {
    label: 'clean',
    language: 'javascript',
    lines: [
      'export function total(items) {',
      '  return items.reduce((sum, item) => sum + item.price, 0);',
      '}',
    ],
    rule: null,
  },
]

function findingsFor(entry: Case): Finding[] {
  return collectFindings({ lines: entry.lines, language: entry.language })
}

for (const entry of CASES) {
  test(`detects ${entry.label}`, () => {
    const findings = findingsFor(entry)
    if (entry.rule === null) {
      assert.deepEqual(
        findings.map((finding) => finding.rule),
        []
      )
      return
    }
    assert.ok(
      findings.some((finding) => finding.rule === entry.rule),
      `expected ${entry.rule} in ${JSON.stringify(findings)}`
    )
  })
}

function breakerFrom(
  counters: Map<string, Counter>
): (agentId: string, rule: string) => Counter {
  return (agentId, rule) => {
    const key = `${agentId}/${rule}`
    let counter = counters.get(key)
    if (counter === undefined) {
      counter = { blocks: 0, clean: 0 }
      counters.set(key, counter)
    }
    return counter
  }
}

const POLICY: RulePolicy = {
  blocking: ['braced-conditionals'],
  notes: [],
  degradeAfter: 3,
  resetAfter: 5,
}

function violation(): Finding[] {
  return collectFindings({
    lines: ['if (!user) return 0;'],
    language: 'javascript',
  })
}

test('the breaker degrades the fourth violation to a note', () => {
  const counters = new Map<string, Counter>()
  const breaker = breakerFrom(counters)
  const outcomes = [1, 2, 3, 4].map(() =>
    evaluate({ findings: violation(), config: POLICY, breaker, agentId: 'a' })
  )
  assert.deepEqual(
    outcomes.map((outcome) => outcome.blocks.length),
    [1, 1, 1, 0]
  )
  assert.equal(outcomes[3].notes[0].degraded, true)
})

test('the breaker resets after five clean checks', () => {
  const counters = new Map<string, Counter>()
  const breaker = breakerFrom(counters)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    evaluate({ findings: violation(), config: POLICY, breaker, agentId: 'a' })
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const outcome = evaluate({
      findings: [],
      config: POLICY,
      breaker,
      agentId: 'a',
    })
    assert.equal(outcome.blocks.length, 0)
  }
  const again = evaluate({
    findings: violation(),
    config: POLICY,
    breaker,
    agentId: 'a',
  })
  assert.equal(again.blocks.length, 1)
})
