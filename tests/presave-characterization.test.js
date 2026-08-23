'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

test('presave registers under the upstream machine name and not the PapiJo machine name', () => {
  const validatedScores = [];
  const context = {
    H5PPresave: {},
    H5PEditor: {
      Presave: {
        exceptions: {
          InvalidContentSemanticsException: class InvalidContentSemanticsException extends Error {}
        },
        checkNestedRequirements: () => true,
        validateScore: (score) => validatedScores.push(score)
      }
    }
  };
  vm.createContext(context);
  const filename = path.resolve(__dirname, '..', 'presave.js');
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });

  assert.equal(typeof context.H5PPresave['H5P.MarkTheWords'], 'function');
  assert.equal(context.H5PPresave['H5P.MarkTheWordsPapiJo'], undefined);

  let result;
  context.H5PPresave['H5P.MarkTheWords'](
    { textField: '*one* plain *two*' },
    (value) => { result = value; }
  );
  assert.deepEqual(validatedScores, [2]);
  assert.deepEqual({ ...result }, { maxScore: 2 });
});
