import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  collectFindings,
  type Finding,
} from '@/rules/index.js';

interface Case {
  label: string;
  language: string;
  lines: string[];
  rule: string | null;
}

const EMPTY_CATCH_HANDLER = '() => {}';
const NULL_CATCH_HANDLER = '(error) => null';
const UNDEFINED_CATCH_HANDLER = '(error) => undefined';
const REPORT_CATCH_HANDLER = '(error) => report(error)';

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
  {
    label: 'explicit any annotation',
    language: 'typescript',
    lines: ['export function load(value: any) {', '  return value', '}'],
    rule: 'explicit-any',
  },
  {
    label: 'explicit any alias',
    language: 'typescript',
    lines: ['type Payload = any;'],
    rule: 'explicit-any',
  },
  {
    label: 'explicit any generic',
    language: 'typescript',
    lines: ['const rows: Array<any> = [];'],
    rule: 'explicit-any',
  },
  {
    label: 'explicit any record',
    language: 'typescript',
    lines: ['const map: Record<string, any> = {};'],
    rule: 'explicit-any',
  },
  {
    label: 'explicit any assertion',
    language: 'typescript',
    lines: ['const value = input as any;'],
    rule: 'explicit-any',
  },
  {
    label: 'any in a string is not a type',
    language: 'typescript',
    lines: ['const label = \'any\';'],
    rule: null,
  },
  {
    label: 'any in a comment is not a type',
    language: 'typescript',
    lines: ['// any is not allowed here'],
    rule: null,
  },
  {
    label: 'a name containing any is fine',
    language: 'typescript',
    lines: ['const anyValue = 1;'],
    rule: null,
  },
  {
    label: 'javascript has no type any',
    language: 'javascript',
    lines: ['const value: any = 1;'],
    rule: null,
  },
  {
    label: 'suppressed type error',
    language: 'typescript',
    lines: ['// @ts-ignore'],
    rule: 'suppressed-type-errors',
  },
  {
    label: 'suppressed type error without a space',
    language: 'typescript',
    lines: ['//@ts-nocheck'],
    rule: 'suppressed-type-errors',
  },
  {
    label: 'suppressed type error in a block comment',
    language: 'typescript',
    lines: ['/* @ts-ignore */'],
    rule: 'suppressed-type-errors',
  },
  {
    label: 'ts expect error is allowed',
    language: 'typescript',
    lines: ['// @ts-expect-error: upstream bug'],
    rule: null,
  },
  {
    label: 'quoted suppression is not a comment',
    language: 'typescript',
    lines: ['const note = \'// @ts-ignore\';'],
    rule: null,
  },
  {
    label: 'a mention after the first token is fine',
    language: 'typescript',
    lines: ['// do not use @ts-ignore here'],
    rule: null,
  },
  {
    label: 'python except continue',
    language: 'python',
    lines: ['except Exception:', '    continue'],
    rule: 'swallowed-errors',
  },
  {
    label: 'python except return none',
    language: 'python',
    lines: ['except Exception:', '    return None'],
    rule: 'swallowed-errors',
  },
  {
    label: 'python inline except pass is not detected',
    language: 'python',
    lines: ['except Exception: pass'],
    rule: null,
  },
  {
    label: 'python inline except return none is not detected',
    language: 'python',
    lines: ['except Exception: return None'],
    rule: null,
  },
  {
    label: 'python except with an empty body',
    language: 'python',
    lines: ['except Exception:', '', '    pass'],
    rule: 'swallowed-errors',
  },
  {
    label: 'python except that logs is fine',
    language: 'python',
    lines: ['except Exception:', '    log(error)'],
    rule: null,
  },
  {
    label: 'python except that raises is fine',
    language: 'python',
    lines: ['except Exception:', '    raise'],
    rule: null,
  },
  {
    label: 'go empty block on separate lines is not detected',
    language: 'go',
    lines: ['if err != nil {', '}'],
    rule: null,
  },
  {
    label: 'go discarded error',
    language: 'go',
    lines: ['if err != nil {', '  _ = err', '}'],
    rule: 'swallowed-errors',
  },
  {
    label: 'go discarded error with a comment',
    language: 'go',
    lines: ['if err != nil {', '  // ignore', '  _ = err', '}'],
    rule: 'swallowed-errors',
  },
  {
    label: 'go handled error with a log is fine',
    language: 'go',
    lines: ['if err != nil {', '  _ = err', '  log(err)', '}'],
    rule: null,
  },
  {
    label: 'rust discarded result',
    language: 'rust',
    lines: ['let _ = result;'],
    rule: 'swallowed-errors',
  },
  {
    label: 'rust ok call',
    language: 'rust',
    lines: ['result.ok();'],
    rule: 'swallowed-errors',
  },
  {
    label: 'rust propagated result is fine',
    language: 'rust',
    lines: ['let value = result?;'],
    rule: null,
  },
  {
    label: 'catch with no binding on one line',
    language: 'typescript',
    lines: ['} catch { }'],
    rule: 'swallowed-errors',
  },
  {
    label: 'catch returning undefined',
    language: 'typescript',
    lines: ['} catch (error) { return undefined; }'],
    rule: 'swallowed-errors',
  },
  {
    label: 'catch returning false',
    language: 'typescript',
    lines: ['} catch (error) { return false; }'],
    rule: 'swallowed-errors',
  },
  {
    label: 'catch returning zero',
    language: 'typescript',
    lines: ['} catch (error) { return 0; }'],
    rule: 'swallowed-errors',
  },
  {
    label: 'catch returning an empty string',
    language: 'typescript',
    lines: ['} catch (error) { return \'\'; }'],
    rule: 'swallowed-errors',
  },
  {
    label: 'multiline catch returning null',
    language: 'typescript',
    lines: ['} catch (error) {', '  return null;', '}'],
    rule: 'swallowed-errors',
  },
  {
    label: 'multiline catch returning false',
    language: 'typescript',
    lines: ['} catch (error) {', '  return false;', '}'],
    rule: 'swallowed-errors',
  },
  {
    label: 'multiline catch returning void',
    language: 'typescript',
    lines: ['} catch (error) {', '  return void;', '}'],
    rule: 'swallowed-errors',
  },
  {
    label: 'multiline catch with only a log',
    language: 'typescript',
    lines: ['} catch (error) {', '  console.warn(error);', '}'],
    rule: 'swallowed-errors',
  },
  {
    label: 'multiline catch that rethrows is fine',
    language: 'typescript',
    lines: ['} catch (error) {', '  throw new Error("boom");', '}'],
    rule: null,
  },
  {
    label: 'multiline catch that logs and rethrows is fine',
    language: 'typescript',
    lines: ['} catch (error) {', '  report(error);', '  throw error;', '}'],
    rule: null,
  },
  {
    label: 'promise catch with an empty handler',
    language: 'typescript',
    lines: [`load().catch(${EMPTY_CATCH_HANDLER})`],
    rule: 'swallowed-errors',
  },
  {
    label: 'promise catch returning null',
    language: 'typescript',
    lines: [`load().catch(${NULL_CATCH_HANDLER})`],
    rule: 'swallowed-errors',
  },
  {
    label: 'promise catch returning undefined',
    language: 'typescript',
    lines: [`load().catch(${UNDEFINED_CATCH_HANDLER})`],
    rule: 'swallowed-errors',
  },
  {
    label: 'promise catch that handles the error is fine',
    language: 'typescript',
    lines: [`load().catch(${REPORT_CATCH_HANDLER})`],
    rule: null,
  },
  {
    label: 'if without braces on the same line',
    language: 'javascript',
    lines: ['if (ready) run();'],
    rule: 'braced-conditionals',
  },
  {
    label: 'if without braces on the next line',
    language: 'javascript',
    lines: ['if (ready)', '  run();'],
    rule: 'braced-conditionals',
  },
  {
    label: 'if with braces on the next line is fine',
    language: 'javascript',
    lines: ['if (ready)', '{', '  run();', '}'],
    rule: null,
  },
  {
    label: 'for without braces',
    language: 'javascript',
    lines: ['for (let index = 0; index < 1; index += 1) run();'],
    rule: 'braced-conditionals',
  },
  {
    label: 'while without braces',
    language: 'javascript',
    lines: ['while (ready) run();'],
    rule: 'braced-conditionals',
  },
  {
    label: 'else without braces',
    language: 'javascript',
    lines: ['} else run();'],
    rule: 'braced-conditionals',
  },
  {
    label: 'else with an if is fine',
    language: 'javascript',
    lines: ['} else if (ready) run();'],
    rule: null,
  },
  {
    label: 'else with braces is fine',
    language: 'javascript',
    lines: ['} else {', '  run();', '}'],
    rule: null,
  },
  {
    label: 'if at the end of the added lines is not flagged',
    language: 'javascript',
    lines: ['if (ready)'],
    rule: null,
  },
  {
    label: 'python one-line suite is not a brace rule',
    language: 'python',
    lines: ['if ready: run()'],
    rule: null,
  },
  {
    label: 'let data declaration',
    language: 'javascript',
    lines: ['let data = rows;'],
    rule: 'clear-names',
  },
  {
    label: 'var temp declaration',
    language: 'javascript',
    lines: ['var temp = 1;'],
    rule: 'clear-names',
  },
  {
    label: 'exported const result',
    language: 'typescript',
    lines: ['export const result = load();'],
    rule: 'clear-names',
  },
  {
    label: 'function parameter data',
    language: 'typescript',
    lines: ['function read(data: string) {', '  return data', '}'],
    rule: 'clear-names',
  },
  {
    label: 'function parameter with a default is fine',
    language: 'typescript',
    lines: ['function read(value: string = "x") {', '  return value', '}'],
    rule: null,
  },
  {
    label: 'arrow parameter is not a declaration',
    language: 'javascript',
    lines: ['const read = (data) => data;'],
    rule: null,
  },
  {
    label: 'destructured declaration is not checked',
    language: 'javascript',
    lines: ['const { data } = source;'],
    rule: null,
  },
  {
    label: 'for loop declaration is not a top-level declaration',
    language: 'javascript',
    lines: ['for (const data of rows) { run(data); }'],
    rule: null,
  },
  {
    label: 'console.debug is a debug artifact',
    language: 'javascript',
    lines: ['console.debug(value)'],
    rule: 'debug-artifacts',
  },
  {
    label: 'console.trace is a debug artifact',
    language: 'typescript',
    lines: ['console.trace(value)'],
    rule: 'debug-artifacts',
  },
  {
    label: 'console.warn is not a debug artifact',
    language: 'javascript',
    lines: ['console.warn(value)'],
    rule: null,
  },
  {
    label: 'debugger is a debug artifact',
    language: 'typescript',
    lines: ['debugger;'],
    rule: 'debug-artifacts',
  },
  {
    label: 'python breakpoint is a debug artifact',
    language: 'python',
    lines: ['breakpoint()'],
    rule: 'debug-artifacts',
  },
  {
    label: 'go fmt.Printf is a debug artifact',
    language: 'go',
    lines: ['fmt.Printf("value")'],
    rule: 'debug-artifacts',
  },
  {
    label: 'go fmt.Errorf is not a debug artifact',
    language: 'go',
    lines: ['fmt.Errorf("value")'],
    rule: null,
  },
  {
    label: 'rust dbg is a debug artifact',
    language: 'rust',
    lines: ['dbg!(value);'],
    rule: 'debug-artifacts',
  },
  {
    label: 'java System.out.print is a debug artifact',
    language: 'java',
    lines: ['System.out.println(value);'],
    rule: 'debug-artifacts',
  },
  {
    label: 'php var_dump is a debug artifact',
    language: 'php',
    lines: ['var_dump($value);'],
    rule: 'debug-artifacts',
  },
  {
    label: 'a general language has no debug patterns',
    language: 'general',
    lines: ['console.log(value)'],
    rule: null,
  },
  {
    label: 'explicit any in a union',
    language: 'typescript',
    lines: ['const value: string | any = load();'],
    rule: 'explicit-any',
  },
  {
    label: 'explicit any in a map',
    language: 'typescript',
    lines: ['const value: Map<any, string> = new Map();'],
    rule: 'explicit-any',
  },
  {
    label: 'explicit any with satisfies',
    language: 'typescript',
    lines: ['const value = input satisfies any;'],
    rule: 'explicit-any',
  },
  {
    label: 'explicit any with keyof',
    language: 'typescript',
    lines: ['type Keys = keyof any;'],
    rule: 'explicit-any',
  },
  {
    label: 'explicit any generic default',
    language: 'typescript',
    lines: ['type Box<T = any> = T;'],
    rule: 'explicit-any',
  },
  {
    label: 'explicit any interface property',
    language: 'typescript',
    lines: ['interface Box {', '  value: any;', '}'],
    rule: 'explicit-any',
  },
  {
    label: 'a string any is not a type',
    language: 'typescript',
    lines: ['const value = \'any\';'],
    rule: null,
  },
  {
    label: 'a value named any is not a type',
    language: 'typescript',
    lines: ['const value = any;'],
    rule: null,
  },
  {
    label: 'a property named any is not a type',
    language: 'typescript',
    lines: ['const value = record.any;'],
    rule: null,
  },
  {
    label: 'a typed string is not any',
    language: 'typescript',
    lines: ['const value: string = "x";'],
    rule: null,
  },
  {
    label: 'suppressed type error after code',
    language: 'typescript',
    lines: ['const value = 1; // @ts-ignore'],
    rule: 'suppressed-type-errors',
  },
  {
    label: 'suppressed type error in a block comment',
    language: 'typescript',
    lines: ['/* @ts-nocheck */'],
    rule: 'suppressed-type-errors',
  },
  {
    label: 'suppressed type error is typescript only',
    language: 'javascript',
    lines: ['// @ts-ignore'],
    rule: null,
  },
  {
    label: 'a stale marker with a hash comment',
    language: 'python',
    lines: ['# FIXME: remove this'],
    rule: 'stale-comments',
  },
  {
    label: 'a stale marker inside a block comment',
    language: 'typescript',
    lines: ['/* XXX */'],
    rule: 'stale-comments',
  },
  {
    label: 'a hash commented import',
    language: 'python',
    lines: ['# import os'],
    rule: 'commented-code',
  },
  {
    label: 'a commented return',
    language: 'typescript',
    lines: ['// return value;'],
    rule: 'commented-code',
  },
  {
    label: 'a commented if statement',
    language: 'javascript',
    lines: ['// if (ready) run();'],
    rule: 'commented-code',
  },
  {
    label: 'a prose comment is fine',
    language: 'typescript',
    lines: ['// explains why the retry exists'],
    rule: null,
  },
];

function findingsFor(entry: Case): Finding[] {
  return collectFindings({ lines: entry.lines, language: entry.language });
}

for (const entry of CASES) {
  test(`detects ${entry.label}`, () => {
    const findings = findingsFor(entry);
    if (entry.rule === null) {
      assert.deepEqual(
        findings.map((finding) => finding.rule),
        [],
      );
      return;
    }
    assert.ok(
      findings.some((finding) => finding.rule === entry.rule),
      `expected ${entry.rule} in ${JSON.stringify(findings)}`,
    );
  });
}
