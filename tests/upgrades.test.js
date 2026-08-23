'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const loadUpgrade = () => {
  const context = vm.createContext({});
  const source = fs.readFileSync(path.join(__dirname, '..', 'upgrades.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'upgrades.js' });
  return context.H5PUpgrades['H5P.MarkTheWordsPapiJo'][1][2].contentUpgrade;
};

const upgrade = (parameters) => {
  let result;
  loadUpgrade()(parameters, (error, upgradedParameters) => {
    assert.equal(error, null);
    result = upgradedParameters;
  });
  return result;
};

test('registers the 1.2 content upgrade for the PapiJo machine name', () => {
  assert.equal(typeof loadUpgrade(), 'function');
});

test('migrates enabled legacy score points to ticks and score points', () => {
  const parameters = { behaviour: { showScorePoints: true, enableRetry: true } };

  assert.deepEqual(upgrade(parameters), {
    behaviour: {
      displayTicksMode: 'ticksAndScorepoints',
      enableRetry: true
    }
  });
});

test('migrates disabled legacy score points to ticks only', () => {
  const parameters = { behaviour: { showScorePoints: false } };

  assert.deepEqual(upgrade(parameters), {
    behaviour: { displayTicksMode: 'ticksOnly' }
  });
});

test('leaves parameters unchanged when displayTicksMode already exists', () => {
  const parameters = {
    behaviour: {
      showScorePoints: false,
      displayTicksMode: 'ticksAbove'
    }
  };

  assert.strictEqual(upgrade(parameters), parameters);
  assert.deepEqual(parameters, {
    behaviour: {
      showScorePoints: false,
      displayTicksMode: 'ticksAbove'
    }
  });
});

test('leaves parameters unchanged when the legacy setting is absent', () => {
  const parameters = { behaviour: { enableRetry: true } };

  assert.strictEqual(upgrade(parameters), parameters);
  assert.deepEqual(parameters, { behaviour: { enableRetry: true } });
});
