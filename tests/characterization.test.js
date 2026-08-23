'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { createRuntime } = require('./helpers/runtime-harness');

test('stylesheet scopes retry behavior and provides theme fallbacks', () => {
  const stylesheet = fs.readFileSync(
    path.resolve(__dirname, '..', 'styles', 'mark-the-words-papijo.css'),
    'utf8'
  );

  assert.doesNotMatch(stylesheet, /;0\s*(?:\r?\n|$)/);
  assert.match(
    stylesheet,
    /\.h5p-mark-the-words button\.h5p-retry-button\.h5p-retry-button\s*\{/
  );
  assert.doesNotMatch(
    stylesheet,
    /(?:^|\r?\n)[ \t]*button\.h5p-retry-button\.h5p-retry-button\s*\{/
  );
  assert.deepEqual(
    [...stylesheet.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)].map((match) => match[1]),
    []
  );
});

test('parses an ordinary asterisk-marked correct word', () => {
  const task = createRuntime('This is *correct*.');

  assert.deepEqual(
    task.summary().map(({ text, answer }) => ({ text, answer })),
    [
      { text: 'This', answer: false },
      { text: 'is', answer: false },
      { text: 'correct', answer: true }
    ]
  );
});

test('parses multiple correct words', () => {
  const task = createRuntime('*One* plain *two*.');

  assert.deepEqual(
    task.summary().filter(({ answer }) => answer).map(({ text }) => text),
    ['One', 'two']
  );
  assert.equal(task.getMaxScore(), 2);
});

test('keeps a multiword answer group as one selectable answer', () => {
  const task = createRuntime('Choose *the whole phrase* now.');

  assert.deepEqual(
    task.summary().map(({ text, answer }) => ({ text, answer })),
    [
      { text: 'Choose', answer: false },
      { text: 'the whole phrase', answer: true },
      { text: 'now', answer: false }
    ]
  );
});

for (const distractorDelimiter of ['_', '#', '@']) {
  test(`recognizes an explicit ${distractorDelimiter} distractor and removes its delimiters`, () => {
    const task = createRuntime(
      `*answer* ${distractorDelimiter}wrong group${distractorDelimiter}`,
      { distractorDelimiter }
    );

    assert.deepEqual(
      task.summary().map(({ text, answer }) => ({ text, answer })),
      [
        { text: 'answer', answer: true },
        { text: 'wrong group', answer: false }
      ]
    );
  });
}

test('renders a square-bracket group as plain non-selectable text', () => {
  const task = createRuntime('Choose *this* [but not this group] end.');

  assert.equal(task.html.includes('[but not this group]'), false);
  assert.equal(task.html.includes(' but not this group'), true);
  assert.deepEqual(task.summary().map(({ text }) => text), ['Choose', 'this', 'end']);
});

test('splits hyphenated syllables into adjacent selectable options', () => {
  const task = createRuntime('le-mo-*nade*');

  assert.deepEqual(
    task.summary().map(({ text, answer, className }) => ({ text, answer, className })),
    [
      { text: 'le', answer: false, className: '' },
      { text: 'mo', answer: false, className: 'noPadding' },
      { text: 'nade', answer: true, className: 'noPadding' }
    ]
  );
  assert.equal(task.html.includes('-'), true);
});

test('removeHyphens replaces visible syllable separators with word joiners', () => {
  const task = createRuntime('le-mo-*nade*', {
    behaviour: { removeHyphens: true }
  });

  const visibleText = task.html.replace(/<[^>]+>/g, '');
  assert.equal(visibleText.includes('-'), false);
  assert.equal(task.html.includes('\u2060'), true);
  assert.equal((visibleText.match(/\u2060/g) || []).length, 3);
  assert.deepEqual(task.summary().map(({ text }) => text), ['le', 'mo', 'nade']);
});

for (const [name, punctuation] of [
  ['comma', ','],
  ['period', '.'],
  ['question mark', '?'],
  ['exclamation mark', '!']
]) {
  test(`preserves a trailing ${name} outside a parenthesized marked word`, () => {
    const task = createRuntime(`Say (*hello*)${punctuation} please.`);
    const answer = task.summary().find(({ answer: isAnswer }) => isAnswer);

    assert.equal(task.html.includes('(<span'), true);
    assert.equal(task.html.includes(`</span>)${punctuation}`), true);
    assert.equal(answer.text, 'hello');

    task.select(answer.index);
    assert.equal(task.getScoreDetails().score, 1);
  });
}

test('characterizes pipe handling as ordinary content without selectable ARIA semantics', () => {
  const task = createRuntime('left | right');
  const pipe = task.summary().find(({ text }) => text === '|');

  assert.deepEqual(pipe, {
    index: 1,
    text: '|',
    source: '|',
    answer: false,
    selected: false,
    className: 'removePipe',
    role: undefined,
    ariaSelected: undefined
  });
});

test('Spot the Mistakes swaps answer and distractor markers before classification', () => {
  const task = createRuntime('*originally correct* _original mistake_', {
    behaviour: { spotTheMistakes: true }
  });

  assert.deepEqual(
    task.summary().map(({ text, answer }) => ({ text, answer })),
    [
      { text: 'originally correct', answer: false },
      { text: 'original mistake', answer: true }
    ]
  );
});

test('awards one point for one correctly selected answer', () => {
  const task = createRuntime('*right* wrong');
  task.select(0);

  assert.deepEqual(task.getScoreDetails(), {
    correct: 1,
    wrong: 0,
    missed: 0,
    score: 1
  });
});

test('subtracts one point for an incorrect selection', () => {
  const task = createRuntime('*one* *two* wrong');
  task.select(0);
  task.select(1);
  task.select(2);

  assert.deepEqual(task.getScoreDetails(), {
    correct: 2,
    wrong: 1,
    missed: 0,
    score: 1
  });
});

test('clamps a score with only incorrect selections to zero', () => {
  const task = createRuntime('*right* wrong');
  task.select(1);

  assert.deepEqual(task.getScoreDetails(), {
    correct: 0,
    wrong: 1,
    missed: 1,
    score: 0
  });
});

test('calculates maximum score from the number of answer groups', () => {
  const task = createRuntime('*one* *two words* plain *three*');

  assert.equal(task.getMaxScore(), 3);
});

test('characterizes no-answer content as max score 1 and initially correct', () => {
  const task = createRuntime('plain content only');

  assert.equal(task.getMaxScore(), 1);
  assert.deepEqual(task.getScoreDetails(), {
    correct: 1,
    wrong: 0,
    missed: 0,
    score: 1
  });
});

test('selecting a word in no-answer content changes the score from 1 to 0', () => {
  const task = createRuntime('plain content only');
  task.select(0);

  assert.deepEqual(task.getScoreDetails(), {
    correct: 0,
    wrong: 1,
    missed: 0,
    score: 0
  });
});

test('Mark selectable words mode excludes unmarked text from scoring', () => {
  const task = createRuntime('plain *answer* _distractor_ text', {
    behaviour: { markSelectables: true }
  });

  assert.deepEqual(task.summary().map(({ text }) => text), ['answer', 'distractor']);
  task.select(0);
  assert.equal(task.getScoreDetails().score, 1);
  task.select(1);
  assert.equal(task.getScoreDetails().score, 0);
});

test('Spot the Mistakes scores the original distractor as the answer', () => {
  const task = createRuntime('*original answer* _mistake_', {
    behaviour: { spotTheMistakes: true }
  });

  task.select(1);
  assert.deepEqual(task.getScoreDetails(), {
    correct: 1,
    wrong: 0,
    missed: 0,
    score: 1
  });

  task.select(0);
  assert.deepEqual(task.getScoreDetails(), {
    correct: 1,
    wrong: 1,
    missed: 0,
    score: 0
  });
});
