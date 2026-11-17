import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  JevQuestionnaireState,
  JevTodoState,
} from '@/jev/model.js';
import {
  buildQuestionnaireRequestBody,
  buildTodoRequestBody,
  completedItems,
  formatQuestionnaireNotes,
  formatTodoNotes,
  readQuestionnaire,
  readTodoList,
} from '@/jev/workflow.js';

const ARGS = {
  questions: [
    {
      id: 'cleanup',
      question: 'Proceed?',
      header: 'Confirm',
      options: [
        { label: 'Yes (Recommended)', description: 'Removes them.' },
        { label: 'No' },
      ],
    },
    { question: 'Which directory?' },
  ],
};

test('the questionnaire is parsed with ids, options and recommendation', () => {
  const questions = readQuestionnaire(ARGS);
  assert.deepEqual(questions, [
    {
      id: 'cleanup',
      header: 'Confirm',
      text: 'Proceed?',
      multiSelect: false,
      options: [
        {
          label: 'Yes (Recommended)',
          description: 'Removes them.',
          recommended: true,
        },
        { label: 'No', description: undefined, recommended: false },
      ],
    },
    {
      id: 'q2',
      header: undefined,
      text: 'Which directory?',
      multiSelect: false,
      options: [],
    },
  ]);
});

test('invalid entries are ignored and an empty list is undefined', () => {
  assert.equal(readQuestionnaire(undefined), undefined);
  assert.equal(readQuestionnaire({}), undefined);
  assert.equal(readQuestionnaire({ questions: 'none' }), undefined);
  assert.equal(readQuestionnaire({ questions: [{ question: '  ' }] }), undefined);
  assert.equal(
    readQuestionnaire({ questions: [null, { question: 'Keep?' }] })?.length,
    1,
  );
});

test('a questionnaire without options asks only the bundled-decisions rule', () => {
  const request = buildQuestionnaireRequestBody({
    questions: [
      {
        id: 'q1',
        header: undefined,
        text: 'Proceed?',
        options: [],
        multiSelect: false,
      },
    ],
    model: 'jev-latest',
  });
  assert.ok('would-reject' in request.questions);
  assert.ok('questionnaire-bundled-decisions' in request.questions);
  assert.equal('questionnaire-overlapping-options' in request.questions, false);
  assert.equal(
    'questionnaire-unsupported-recommendation' in request.questions,
    false,
  );
});

test('a recommendation enables the recommendation rule', () => {
  const request = buildQuestionnaireRequestBody({
    questions: [
      {
        id: 'q1',
        header: undefined,
        text: 'Proceed?',
        options: [
          { label: 'Yes (Recommended)', description: undefined, recommended: true },
        ],
        multiSelect: false,
      },
    ],
    model: 'jev-latest',
  });
  assert.ok('questionnaire-unsupported-recommendation' in request.questions);
  assert.ok('questionnaire-overlapping-options' in request.questions);
});

test('the state carries the questionnaire kind and the questions', () => {
  const request = buildQuestionnaireRequestBody({
    questions: [
      {
        id: 'q1',
        header: 'Confirm',
        text: 'Proceed?',
        options: [
          { label: 'Yes', description: undefined, recommended: false },
        ],
        multiSelect: true,
      },
    ],
    model: 'jev-latest',
  });
  const state = request.state as JevQuestionnaireState;
  assert.equal(state.kind, 'questionnaire');
  assert.equal(state.questions.length, 1);
  assert.equal(state.questions[0]?.multiSelect, true);
});

test('the questionnaire notes name the model and the rules', () => {
  const text = formatQuestionnaireNotes([
    {
      path: 'questionnaire',
      ruleId: 'questionnaire-bundled-decisions',
      probability: 0.9,
      model: 'jev-1.14.0',
    },
  ]);
  assert.match(text, /Jev questionnaire review \(model jev-1\.14\.0/);
  assert.match(text, /\[questionnaire-bundled-decisions\] p=0\.90/);
  assert.match(text, /never change an answer the user already gave/);
});

test('the questionnaire notes omit an unknown model', () => {
  const text = formatQuestionnaireNotes([
    {
      path: 'questionnaire',
      ruleId: 'questionnaire-bundled-decisions',
      probability: 0.9,
      model: undefined,
    },
  ]);
  assert.match(text, /Jev questionnaire review \(advisory, never a gate\):/);
});

test('invalid options are skipped', () => {
  const questions = readQuestionnaire({
    questions: [
      {
        id: 'q1',
        question: 'Pick?',
        options: [null, { label: '  ' }, { label: 'Yes' }],
      },
    ],
  });
  assert.deepEqual(questions?.[0]?.options, [
    { label: 'Yes', description: undefined, recommended: false },
  ]);
});

test('a blank id falls back and a blank header stays undefined', () => {
  const questions = readQuestionnaire({
    questions: [{ id: '  ', header: ' ', question: 'Keep going?', multiSelect: 'yes' }],
  });
  assert.equal(questions?.[0]?.id, 'q1');
  assert.equal(questions?.[0]?.header, undefined);
  assert.equal(questions?.[0]?.multiSelect, false);
});

test('only the first option is treated as recommended', () => {
  const questions = readQuestionnaire({
    questions: [
      {
        id: 'q1',
        question: 'Pick?',
        options: [
          { label: 'Yes' },
          { label: 'No (Recommended)' },
        ],
      },
    ],
  });
  assert.deepEqual(
    questions?.[0]?.options.map((option) => option.recommended),
    [false, false],
  );
});

test('one question with options enables the option rules for the batch', () => {
  const request = buildQuestionnaireRequestBody({
    questions: [
      {
        id: 'q1',
        header: undefined,
        text: 'Pick?',
        options: [{ label: 'Yes', description: undefined, recommended: false }],
        multiSelect: false,
      },
      {
        id: 'q2',
        header: undefined,
        text: 'Explain?',
        options: [],
        multiSelect: false,
      },
    ],
    model: 'jev-latest',
  });
  assert.ok('questionnaire-overlapping-options' in request.questions);
  assert.equal(
    'questionnaire-unsupported-recommendation' in request.questions,
    false,
  );
});

test('the notes block lists every finding', () => {
  const text = formatQuestionnaireNotes([
    {
      path: 'questionnaire',
      ruleId: 'questionnaire-overlapping-options',
      probability: 0.91,
      model: undefined,
    },
    {
      path: 'questionnaire',
      ruleId: 'questionnaire-bundled-decisions',
      probability: 0.85,
      model: undefined,
    },
  ]);
  assert.match(text, /\[questionnaire-overlapping-options\] p=0\.91/);
  assert.match(text, /\[questionnaire-bundled-decisions\] p=0\.85/);
});

test('the todo list is parsed and normalized', () => {
  assert.deepEqual(
    readTodoList({
      todos: [
        { content: '  Ship it  ', status: 'completed' },
        null,
        { content: '', status: 'pending' },
        { content: 'Missing status' },
      ],
    }),
    [{ content: 'Ship it', status: 'completed' }],
  );
  assert.equal(readTodoList(undefined), undefined);
  assert.equal(readTodoList({ todos: [] }), undefined);
  assert.equal(readTodoList({ todos: 'none' }), undefined);
});

test('only items newly completed count', () => {
  const previous = [
    { content: 'One', status: 'completed' },
    { content: 'Two', status: 'pending' },
  ];
  const next = [
    { content: 'One', status: 'completed' },
    { content: 'Two', status: 'completed' },
    { content: 'Three', status: 'pending' },
  ];
  assert.deepEqual(completedItems(previous, next), ['Two']);
  assert.deepEqual(completedItems([], next), ['One', 'Two']);
});

test('the todo state carries the items and the check', () => {
  const request = buildTodoRequestBody({
    items: ['Ship it'],
    check: { command: 'npm run check', status: 'failed' },
    model: 'jev-latest',
  });
  const state = request.state as JevTodoState;
  assert.equal(state.kind, 'todo');
  assert.deepEqual(state.items, ['Ship it']);
  assert.deepEqual(state.check, { command: 'npm run check', status: 'failed' });
  assert.ok('would-reject' in request.questions);
  assert.ok('todo-contradicts-check' in request.questions);
});

test('the todo notes name the model and the rules', () => {
  const text = formatTodoNotes([
    {
      path: 'todos',
      ruleId: 'todo-contradicts-check',
      probability: 0.9,
      model: 'jev-1.14.0',
    },
  ]);
  assert.match(text, /Jev task review \(model jev-1\.14\.0/);
  assert.match(text, /\[todo-contradicts-check\] p=0\.90/);
  assert.match(text, /failed or missing check is not proof/);
});
