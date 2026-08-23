'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { createInteraction } = require('./helpers/runtime-harness');

test('Check marks selected correct and incorrect words, scores, feeds back, locks, and emits answered', () => {
  const harness = createInteraction('*one* *two* wrong');
  harness.mouseSelect(0);
  harness.mouseSelect(2);
  harness.clickButton('check-answer');

  assert.deepEqual(harness.score(), { correct: 1, wrong: 1, missed: 1, score: 0 });
  assert.equal(harness.summary()[0].ariaDescribedBy, 'h5p-description-correct');
  assert.equal(harness.summary()[2].ariaDescribedBy, 'h5p-description-incorrect');
  assert.deepEqual(harness.task.__feedback, {
    text: 'Score 0/2',
    score: 0,
    maxScore: 2,
    scoreBarLabel: 'You got :num out of :total points'
  });
  assert.deepEqual(harness.buttonVisibility(), {
    'check-answer': false,
    'show-solution': true,
    'try-again': true
  });
  assert.equal(harness.task.$wordContainer.attr('role'), 'listbox');
  assert.equal(harness.task.$wordContainer.attr('aria-disabled'), 'true');
  assert.equal(harness.summary().every(({ tabindex }) => tabindex === undefined), true);
  assert.equal(harness.answeredEvents().length, 1);

  harness.mouseSelect(1);
  assert.equal(harness.summary()[1].selected, false);
});

test('Retry performs a full reset when keepCorrectAnswers is disabled', () => {
  const harness = createInteraction('*right* wrong');
  harness.mouseSelect(1);
  harness.clickButton('check-answer');
  harness.clickButton('try-again');

  assert.equal(harness.summary().every(({ selected }) => selected === false), true);
  assert.equal(harness.summary().every(({ ariaDescribedBy }) => ariaDescribedBy === undefined), true);
  assert.equal(harness.task.__feedback, null);
  assert.equal(harness.task.isAnswered, false);
  assert.deepEqual(harness.buttonVisibility(), {
    'check-answer': true,
    'show-solution': false,
    'try-again': false
  });
});

test('Retry keeps correct answer state and class when keepCorrectAnswers is enabled', () => {
  const harness = createInteraction('*right* wrong', {
    behaviour: { keepCorrectAnswers: true }
  });
  harness.mouseSelect(0);
  harness.mouseSelect(1);
  harness.clickButton('check-answer');
  harness.clickButton('try-again');

  assert.equal(harness.summary()[0].selected, true);
  assert.equal(harness.summary()[0].ariaDescribedBy, 'h5p-description-correct');
  assert.equal(harness.summary()[0].className.includes('keepanswer'), true);
  assert.equal(harness.summary()[1].selected, false);
  assert.equal(harness.summary()[1].ariaDescribedBy, undefined);
  assert.equal(harness.score().score, 1);
  assert.equal(harness.task.__feedback, null);
  assert.equal(harness.task.getAnswerGiven(), false);
});

test('resetTask clears answers retained by Retry', () => {
  const harness = createInteraction('*right* wrong', {
    behaviour: { keepCorrectAnswers: true }
  });
  harness.mouseSelect(0);
  harness.mouseSelect(1);
  harness.clickButton('check-answer');
  harness.clickButton('try-again');
  harness.task.resetTask();

  assert.equal(harness.summary().every(({ selected }) => selected === false), true);
  assert.equal(harness.summary().every(({ className }) => !className.includes('keepanswer')), true);
  assert.equal(harness.summary().every(({ role }) => role === 'option'), true);
  assert.equal(harness.task.__feedback, null);
});

test('Show Solution marks selected correct, selected incorrect, and missed answers', () => {
  const harness = createInteraction('*one* *two* wrong');
  harness.mouseSelect(0);
  harness.mouseSelect(2);
  harness.clickButton('check-answer');
  harness.clickButton('show-solution');

  assert.equal(harness.summary()[0].ariaDescribedBy, 'h5p-description-correct');
  assert.equal(harness.summary()[1].ariaDescribedBy, 'h5p-description-missed');
  assert.equal(harness.summary()[2].ariaDescribedBy, 'h5p-description-incorrect');
  assert.deepEqual(harness.buttonVisibility(), {
    'check-answer': false,
    'show-solution': false,
    'try-again': true
  });
  assert.deepEqual(harness.task.__reads, ['Task is updated to contain the solution.']);
});

test('minimum-score gate preserves learner markings while displaying the threshold warning', () => {
  const harness = createInteraction('*one* *two* wrong', {
    behaviour: { minScore: 50 }
  });
  harness.mouseSelect(2);
  harness.clickButton('check-answer');
  const stateBeforeShowSolution = harness.summary().map((entry) => ({
    selected: entry.selected,
    ariaDescribedBy: entry.ariaDescribedBy,
    className: entry.className
  }));
  harness.clickButton('show-solution');

  assert.deepEqual(
    harness.summary().map((entry) => ({
      selected: entry.selected,
      ariaDescribedBy: entry.ariaDescribedBy,
      className: entry.className
    })),
    stateBeforeShowSolution
  );
  assert.equal(harness.summary()[0].ariaDescribedBy, undefined);
  assert.equal(harness.summary()[1].ariaDescribedBy, undefined);
  assert.equal(harness.summary()[2].ariaDescribedBy, 'h5p-description-incorrect');
  assert.equal(harness.task.__feedback.text, "The solution won't be available until your score is at least 1/2");
  assert.equal(harness.buttonVisibility()['show-solution'], true);
  assert.deepEqual(harness.task.__reads, []);
});

test('minimum-score gate preserves Show Solution behavior when the threshold is met', () => {
  const harness = createInteraction('*one* *two* wrong', {
    behaviour: { minScore: 50 }
  });
  harness.mouseSelect(0);
  harness.clickButton('check-answer');
  harness.clickButton('show-solution');

  assert.equal(harness.summary()[0].ariaDescribedBy, 'h5p-description-correct');
  assert.equal(harness.summary()[1].ariaDescribedBy, 'h5p-description-missed');
  assert.equal(harness.buttonVisibility()['show-solution'], false);
  assert.deepEqual(harness.task.__reads, ['Task is updated to contain the solution.']);
});

test('hideMistakes hides the unselected distractor after perfect Mark Selectables completion', () => {
  const harness = createInteraction('plain *answer* _wrong_', {
    behaviour: { markSelectables: true, hideMistakes: true }
  });
  harness.mouseSelect(0);
  harness.clickButton('check-answer');

  assert.equal(harness.score().score, 1);
  assert.equal(harness.summary()[1].className.includes('h5p-description-remove-mistake'), true);
});

test('hideMistakes does not hide choices after imperfect completion', () => {
  const harness = createInteraction('*one* *two* _wrong_', {
    behaviour: { markSelectables: true, hideMistakes: true }
  });
  harness.mouseSelect(0);
  harness.clickButton('check-answer');

  assert.equal(harness.score().score, 1);
  assert.equal(harness.summary().some(({ className }) => className.includes('h5p-description-remove-mistake')), false);
});

test('hideMistakes hides a correctly spotted mistake after perfect Spot the Mistakes completion', () => {
  const harness = createInteraction('*original answer* _mistake_', {
    behaviour: { spotTheMistakes: true, hideMistakes: true }
  });
  harness.mouseSelect(1);
  harness.clickButton('check-answer');

  assert.equal(harness.summary()[1].ariaDescribedBy, 'h5p-description-is-mistake');
  assert.equal(harness.summary()[1].className.includes('h5p-description-remove-mistake'), true);
});

test('custom modes force keepCorrectAnswers off even when supplied as true', () => {
  const harness = createInteraction('*answer* _wrong_', {
    behaviour: { markSelectables: true, keepCorrectAnswers: true }
  });

  assert.equal(harness.task.params.behaviour.keepCorrectAnswers, false);
  assert.equal(harness.task.keepCorrectAnswers, false);
});

test('restores selected indexes and reports that an answer exists', () => {
  const harness = createInteraction('*answer* wrong', {
    contentData: { previousState: [1] }
  });

  assert.equal(harness.summary()[1].selected, true);
  assert.deepEqual(Array.from(harness.task.getCurrentState()), [1]);
  assert.equal(harness.task.isAnswered, true);
  assert.equal(harness.task.getAnswerGiven(), true);
  assert.deepEqual(harness.task.__triggeredXapi, []);
});

test('an empty previous state preserves unanswered reporting', () => {
  const harness = createInteraction('*answer* wrong', {
    contentData: { previousState: [] }
  });

  assert.deepEqual(Array.from(harness.task.getCurrentState()), []);
  assert.equal(harness.task.isAnswered, undefined);
  assert.equal(harness.task.getAnswerGiven(), undefined);
});

test('getCurrentState follows current mouse selections', () => {
  const harness = createInteraction('*one* *two* wrong');
  harness.mouseSelect(0);
  harness.mouseSelect(2);

  assert.deepEqual(Array.from(harness.task.getCurrentState()), [0, 2]);
  assert.equal(harness.task.getAnswerGiven(), true);
});

test('keyboard navigation initially owns one tabindex and moves it with an arrow key', () => {
  const harness = createInteraction('*one* two three');

  assert.deepEqual(harness.summary().map(({ tabindex }) => tabindex), ['0', undefined, undefined]);
  const result = harness.key(0, 39);
  assert.equal(result.prevented, true);
  assert.deepEqual(harness.summary().map(({ tabindex }) => tabindex), [undefined, '0', undefined]);
  assert.equal(harness.elements[1].focused, true);
});

for (const [keyName, which] of [['Enter', 13], ['Space', 32]]) {
  test(`${keyName} selects a word and emits interacted xAPI`, () => {
    const harness = createInteraction('*answer* wrong');
    const result = harness.key(0, which);

    assert.equal(result.prevented, true);
    assert.equal(harness.summary()[0].selected, true);
    assert.deepEqual(harness.task.__triggeredXapi, ['interacted']);
  });
}

test('mouse selection moves tabindex ownership to the clicked word', () => {
  const harness = createInteraction('*answer* wrong');
  harness.mouseSelect(1);

  assert.deepEqual(harness.summary().map(({ tabindex }) => tabindex), [undefined, '0']);
  assert.equal(harness.elements[1].focused, true);
});

test('Check retains a disabled listbox with child option roles and no tab stops', () => {
  const harness = createInteraction('*answer* wrong');
  harness.mouseSelect(1);
  harness.clickButton('check-answer');

  assert.equal(harness.task.$wordContainer.attr('role'), 'listbox');
  assert.equal(harness.task.$wordContainer.attr('aria-multiselectable'), 'true');
  assert.equal(harness.task.$wordContainer.attr('aria-disabled'), 'true');
  assert.equal(harness.summary().every(({ role }) => role === 'option'), true);
  assert.equal(harness.summary().every(({ tabindex }) => tabindex === undefined), true);
});

test('Show Solution keeps the listbox disabled with valid child option roles', () => {
  const harness = createInteraction('*one* *two* wrong');
  harness.mouseSelect(2);
  harness.clickButton('check-answer');
  harness.clickButton('show-solution');

  assert.equal(harness.task.$wordContainer.attr('role'), 'listbox');
  assert.equal(harness.task.$wordContainer.attr('aria-disabled'), 'true');
  assert.equal(harness.summary().every(({ role }) => role === 'option'), true);
  harness.mouseSelect(0);
  assert.equal(harness.summary()[0].selected, false);
});

test('pipe/removePipe is skipped by keyboard navigation and cannot be toggled with Enter or Space', () => {
  const harness = createInteraction('| *answer*');

  assert.equal(harness.summary()[0].className, 'removePipe');
  assert.equal(harness.summary()[0].role, undefined);
  assert.equal(harness.summary()[0].tabindex, undefined);
  assert.equal(harness.summary()[1].tabindex, '0');
  assert.equal(harness.key(0, 13).prevented, false);
  assert.equal(harness.key(0, 32).prevented, false);
  assert.equal(harness.summary()[0].selected, false);
  assert.deepEqual(harness.task.__triggeredXapi, []);

  harness.mouseSelect(1);
  harness.clickButton('check-answer');
  harness.clickButton('try-again');
  assert.equal(harness.summary()[0].role, undefined);
  assert.equal(harness.summary()[0].ariaSelected, undefined);
  assert.equal(harness.summary()[1].role, 'option');
  assert.equal(harness.task.$wordContainer.attr('aria-disabled'), undefined);

  harness.task.resetTask();
  assert.equal(harness.summary()[0].role, undefined);
  assert.equal(harness.summary()[0].ariaSelected, undefined);
});

test('aria-describedby references one registered result description in the task DOM', () => {
  const harness = createInteraction('*answer* wrong');
  harness.mouseSelect(0);
  harness.clickButton('check-answer');

  assert.equal(harness.summary()[0].ariaDescribedBy, 'h5p-description-correct');
  assert.equal(harness.task.$inner.find('#h5p-description-correct').length, 1);
});

test('registers one localized description for every result state', () => {
  const harness = createInteraction('*answer* wrong');
  const expectedDescriptions = {
    'h5p-description-correct': 'Correct!',
    'h5p-description-incorrect': 'Incorrect!',
    'h5p-description-missed': 'Answer not found!',
    'h5p-description-is-mistake': 'Correctly spotted mistake!',
    'h5p-description-not-mistake': 'This is not a mistake!',
    'h5p-description-missed-mistake': 'Answer not found!'
  };

  Object.entries(expectedDescriptions).forEach(([id, text]) => {
    const $description = harness.task.$inner.find(`#${id}`);
    assert.equal($description.length, 1);
    assert.equal($description.text(), text);
  });
});

test('xAPI records interacted and answered with score, patterns, language, and visible choice text', () => {
  const harness = createInteraction('*right* _wrong_', {
    taskDescription: '<strong>Choose</strong> now.'
  });
  harness.mouseSelect(0);
  harness.mouseSelect(1);
  harness.clickButton('check-answer');

  assert.deepEqual(harness.task.__triggeredXapi, ['interacted', 'interacted']);
  const statement = harness.answeredEvents()[0].data.statement;
  assert.deepEqual(statement.result.score, { raw: 0, max: 1, scaled: 0 });
  assert.equal(statement.result.success, false);
  assert.equal(statement.result.response, '0[,]1');
  assert.deepEqual(Array.from(statement.object.definition.correctResponsesPattern), ['0']);
  assert.equal(statement.object.definition.description['en-US'], 'Choose now.');
  assert.deepEqual(Array.from(statement.object.definition.choices, (choice) => choice.id), ['0', '1']);
  assert.equal(statement.object.definition.choices[0].description['en-US'], 'right');
  assert.equal(statement.object.definition.choices[1].description['en-US'], 'wrong');
  assert.deepEqual(Array.from(statement.object.definition.extensions['https://h5p.org/x-api/line-breaks']), []);
});

for (const delimiter of ['_', '#', '@']) {
  test(`xAPI strips ${delimiter} distractor delimiters from choice descriptions`, () => {
    const harness = createInteraction(`*right* ${delimiter}wrong${delimiter}`, {
      distractorDelimiter: delimiter
    });
    harness.clickButton('check-answer');

    const choices = harness.answeredEvents()[0].data.statement.object.definition.choices;
    assert.deepEqual(
      Array.from(choices, (choice) => choice.description['en-US']),
      ['right', 'wrong']
    );
  });
}

test('xAPI line-break extension records the preceding rendered choice index', () => {
  const harness = createInteraction('*one* two *three*');
  harness.insertLineBreakAfter(1);
  harness.clickButton('check-answer');

  const extension = harness.answeredEvents()[0].data.statement.object.definition
    .extensions['https://h5p.org/x-api/line-breaks'];
  assert.deepEqual(Array.from(extension), [1]);
});

test('a perfect answered xAPI result is marked successful', () => {
  const harness = createInteraction('*right* wrong');
  harness.mouseSelect(0);
  harness.clickButton('check-answer');

  const result = harness.answeredEvents()[0].data.statement.result;
  assert.equal(result.success, true);
  assert.equal(result.completion, true);
});

test('ordinary standalone context keeps the Check button label', () => {
  const harness = createInteraction('*answer* wrong', {
    contentData: { standalone: true }
  });

  assert.equal(harness.task.__buttons['check-answer'].label, 'Check');
  assert.equal(harness.task.__buttons['check-answer'].extras.textIfSubmitting, 'Submit');
});

for (const flag of ['isScoringEnabled', 'isReportingEnabled']) {
  test(`standalone context with ${flag} uses submitAnswerButton without changing Check behavior`, () => {
    const harness = createInteraction('*answer* wrong', {
      contentData: { standalone: true, [flag]: true },
      params: { submitAnswerButton: 'Send answer' }
    });

    assert.equal(harness.task.__buttons['check-answer'].label, 'Send answer');
    harness.mouseSelect(0);
    harness.clickButton('check-answer');
    assert.equal(harness.score().score, 1);
    assert.equal(harness.answeredEvents().length, 1);
    assert.equal(harness.buttonVisibility()['check-answer'], false);
  });
}

test('nested context keeps the Check button label when reporting is enabled', () => {
  const harness = createInteraction('*answer* wrong', {
    contentData: { standalone: false, isReportingEnabled: true },
    params: { submitAnswerButton: 'Send answer' }
  });

  assert.equal(harness.task.__buttons['check-answer'].label, 'Check');
});

test('H5P.Question button registration retains initial visibility and content data', () => {
  const harness = createInteraction('*answer* wrong');

  assert.deepEqual(harness.buttonVisibility(), {
    'check-answer': true,
    'show-solution': false,
    'try-again': false
  });
  assert.equal(harness.task.__buttons['check-answer'].extras.textIfSubmitting, 'Submit');
  assert.equal(harness.task.__buttons['check-answer'].extras.contentData, harness.task.contentData);
});

test('button visibility transitions from Check to result controls and back on Retry', () => {
  const harness = createInteraction('*answer* wrong');
  harness.mouseSelect(1);
  harness.clickButton('check-answer');
  assert.deepEqual(harness.buttonVisibility(), {
    'check-answer': false,
    'show-solution': true,
    'try-again': true
  });

  harness.clickButton('try-again');
  assert.deepEqual(harness.buttonVisibility(), {
    'check-answer': true,
    'show-solution': false,
    'try-again': false
  });
});
