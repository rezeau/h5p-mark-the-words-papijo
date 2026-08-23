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
  assert.equal(harness.task.$wordContainer.attr('role'), undefined);
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

test('restores selected indexes but leaves isAnswered and getAnswerGiven unset', () => {
  const harness = createInteraction('*answer* wrong', {
    contentData: { previousState: [1] }
  });

  assert.equal(harness.summary()[1].selected, true);
  assert.deepEqual(Array.from(harness.task.getCurrentState()), [1]);
  assert.equal(harness.task.isAnswered, undefined);
  assert.equal(harness.task.getAnswerGiven(), undefined);
  assert.deepEqual(harness.task.__triggeredXapi, []);
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

test('mouse selection leaves both the initial and clicked words with tabindex zero', () => {
  const harness = createInteraction('*answer* wrong');
  harness.mouseSelect(1);

  assert.deepEqual(harness.summary().map(({ tabindex }) => tabindex), ['0', '0']);
});

test('Check removes listbox state and tab stops but leaves orphaned option roles', () => {
  const harness = createInteraction('*answer* wrong');
  harness.mouseSelect(1);
  harness.clickButton('check-answer');

  assert.equal(harness.task.$wordContainer.attr('role'), undefined);
  assert.equal(harness.task.$wordContainer.attr('aria-multiselectable'), undefined);
  assert.equal(harness.summary().every(({ role }) => role === 'option'), true);
  assert.equal(harness.summary().every(({ tabindex }) => tabindex === undefined), true);
});

test('Show Solution keeps selection disabled and option roles orphaned', () => {
  const harness = createInteraction('*one* *two* wrong');
  harness.mouseSelect(2);
  harness.clickButton('check-answer');
  harness.clickButton('show-solution');

  assert.equal(harness.task.$wordContainer.attr('role'), undefined);
  assert.equal(harness.summary().every(({ role }) => role === 'option'), true);
  harness.mouseSelect(0);
  assert.equal(harness.summary()[0].selected, false);
});

test('pipe/removePipe participates in keyboard focus and can be selected with Enter', () => {
  const harness = createInteraction('| *answer*');

  assert.equal(harness.summary()[0].className, 'removePipe');
  assert.equal(harness.summary()[0].tabindex, '0');
  harness.key(0, 13);
  assert.equal(harness.summary()[0].selected, true);
  assert.deepEqual(harness.task.__triggeredXapi, ['interacted']);
});

test('aria-describedby points to an ID that is not registered in the task DOM', () => {
  const harness = createInteraction('*answer* wrong');
  harness.mouseSelect(0);
  harness.clickButton('check-answer');

  assert.equal(harness.summary()[0].ariaDescribedBy, 'h5p-description-correct');
  assert.equal(harness.task.$inner.find('#h5p-description-correct').length, 0);
});

test('xAPI records interacted and answered with score, patterns, hard-coded language, and distractor markers', () => {
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
  assert.equal(statement.object.definition.choices[0].description['en-US'], 'right');
  assert.equal(statement.object.definition.choices[1].description['en-US'], '_wrong_');
  assert.deepEqual(Array.from(statement.object.definition.extensions['https://h5p.org/x-api/line-breaks']), []);
});

test('a perfect answered xAPI result is marked successful', () => {
  const harness = createInteraction('*right* wrong');
  harness.mouseSelect(0);
  harness.clickButton('check-answer');

  const result = harness.answeredEvents()[0].data.statement.result;
  assert.equal(result.success, true);
  assert.equal(result.completion, true);
});

test('H5P.Question button registration captures initial visibility and undefined submit text', () => {
  const harness = createInteraction('*answer* wrong');

  assert.deepEqual(harness.buttonVisibility(), {
    'check-answer': true,
    'show-solution': false,
    'try-again': false
  });
  assert.equal(harness.task.__buttons['check-answer'].extras.textIfSubmitting, undefined);
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
