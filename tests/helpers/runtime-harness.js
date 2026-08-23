'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

class FakeText {
  constructor(text) {
    this.textContent = text;
  }
}

class FakeElement {
  constructor(tagName = 'div', text = '', attributes = {}) {
    this.nodeName = tagName.toUpperCase();
    this.textContent = text;
    this.innerHTML = '';
    this.attributes = new Map(Object.entries(attributes));
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this.focused = false;
    this.classList = {
      add: (...names) => this.addClasses(names),
      remove: (...names) => this.removeClasses(names),
      contains: (name) => this.getClasses().has(name)
    };
  }

  get className() {
    return this.attributes.get('class') || '';
  }

  getClasses() {
    return new Set(this.className.split(/\s+/).filter(Boolean));
  }

  addClasses(names) {
    const classes = this.getClasses();
    names.filter(Boolean).forEach((name) => classes.add(name));
    this.attributes.set('class', [...classes].join(' '));
  }

  removeClasses(names) {
    const remove = new Set(names.filter(Boolean));
    const classes = [...this.getClasses()].filter((name) => !remove.has(name));
    this.attributes.set('class', classes.join(' '));
  }

  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    this.children.push(child);
    child.parentNode = this;
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.parentNode = null;
    }
    return child;
  }

  querySelector(selector) {
    return findDescendants(this, selector)[0] || null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type, properties = {}) {
    let prevented = false;
    const event = {
      type,
      target: this,
      currentTarget: this,
      preventDefault() { prevented = true; },
      ...properties
    };
    [...(this.listeners.get(type) || [])].forEach((listener) => listener(event));
    return { event, prevented };
  }

  focus() {
    this.focused = true;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function decodeHtml(value) {
  return String(value)
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

function stripHtml(value) {
  return decodeHtml(String(value).replace(/<[^>]*>/g, ''));
}

function parseAttributes(source) {
  const attributes = {};
  const pattern = /([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    attributes[match[1]] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attributes;
}

function elementMatches(element, selector) {
  if (!(element instanceof FakeElement)) return false;
  if (selector === ':last-child') return element.parentNode?.children.at(-1) === element;
  if (selector.startsWith('#')) return element.getAttribute('id') === selector.slice(1);

  const attributeMatch = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
  if (attributeMatch) {
    const actual = element.getAttribute(attributeMatch[1]);
    return attributeMatch[2] === undefined ? actual !== null : actual === attributeMatch[2];
  }

  const tagAndClass = selector.match(/^([a-z0-9]+)?(?:\.([\w-]+))?$/i);
  if (tagAndClass) {
    const [, tag, className] = tagAndClass;
    return (!tag || element.nodeName === tag.toUpperCase()) &&
      (!className || element.classList.contains(className));
  }
  return false;
}

function findDescendants(root, selector) {
  const selectors = selector.split(',').map((entry) => entry.trim());
  const matches = [];
  const visit = (element) => {
    element.children.forEach((child) => {
      if (selectors.some((candidate) => elementMatches(child, candidate))) matches.push(child);
      visit(child);
    });
  };
  visit(root);
  return matches;
}

function extractElements(html) {
  const elements = [];
  const pattern = /<(span|br)\s*([^>]*)>(?:([^]*?)<\/span>)?/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const tagName = match[1].toLowerCase();
    const attributes = parseAttributes(match[2]);
    const text = tagName === 'br' ? '' : decodeHtml(match[3] || '');
    elements.push(new FakeElement(tagName, text, attributes));
  }
  return elements;
}

class FakeQuery {
  constructor(elements) {
    this.elements = Array.isArray(elements) ? elements : [elements];
    this.length = this.elements.length;
    this.elements.forEach((element, index) => { this[index] = element; });
  }

  text(value) {
    if (value === undefined) return this.elements[0]?.textContent || '';
    this.elements.forEach((element) => { element.textContent = String(value); });
    return this;
  }

  html(value) {
    if (value === undefined) {
      const element = this.elements[0];
      return element?.innerHTML || escapeHtml(element?.textContent || '');
    }
    this.elements.forEach((element) => setInnerHtml(element, value));
    return this;
  }

  attr(name, value) {
    if (value === undefined) return this.elements[0]?.attributes.get(name);
    this.elements.forEach((element) => element.setAttribute(name, value));
    return this;
  }

  removeAttr(name) {
    this.elements.forEach((element) => element.removeAttribute(name));
    return this;
  }

  addClass(names) {
    const classNames = names.split(/\s+/).filter(Boolean);
    this.elements.forEach((element) => element.addClasses(classNames));
    return this;
  }

  removeClass(names) {
    const classNames = names.split(/\s+/).filter(Boolean);
    this.elements.forEach((element) => element.removeClasses(classNames));
    return this;
  }

  find(selector) {
    return new FakeQuery(this.elements.flatMap((element) => findDescendants(element, selector)));
  }

  each(callback) {
    this.elements.forEach((element, index) => callback.call(element, index, element));
    return this;
  }

  is(selector) {
    return elementMatches(this.elements[0], selector);
  }

  next() {
    const element = this.elements[0];
    if (!element?.parentNode) return new FakeQuery([]);
    const index = element.parentNode.children.indexOf(element);
    return new FakeQuery(element.parentNode.children[index + 1] ? [element.parentNode.children[index + 1]] : []);
  }

  parent(selector) {
    const parents = this.elements.map((element) => element.parentNode).filter(Boolean);
    return new FakeQuery(selector ? parents.filter((element) => elementMatches(element, selector)) : parents);
  }

  appendTo(target) {
    const parent = target instanceof FakeQuery ? target[0] : target;
    this.elements.forEach((element) => parent.appendChild(element));
    return this;
  }

  focus() {
    this.elements[0]?.focus();
    return this;
  }

  remove() {
    this.elements.forEach((element) => element.parentNode?.removeChild(element));
    return this;
  }

  toArray() {
    return [...this.elements];
  }
}

function setInnerHtml(element, html) {
  element.innerHTML = String(html);
  element.textContent = stripHtml(html);
  element.children = [];
  extractElements(html).forEach((child) => element.appendChild(child));
}

function jquery(value, properties = {}) {
  if (value instanceof FakeText || value instanceof FakeElement) return new FakeQuery(value);
  if (Array.isArray(value)) return new FakeQuery(value);
  if (typeof value === 'string' && value.startsWith('<')) {
    const tagName = value.match(/^<([a-z0-9]+)/i)?.[1] || 'div';
    const attributeSource = value.match(/^<[a-z0-9]+\s+([^>]*)>/i)?.[1] || '';
    const element = new FakeElement(tagName, '', parseAttributes(attributeSource));
    const inlineContent = value.match(/^<[a-z0-9]+[^>]*>([^]*)<\/[a-z0-9]+>$/i)?.[1];
    if (inlineContent !== undefined) setInnerHtml(element, inlineContent);

    Object.entries(properties).forEach(([name, propertyValue]) => {
      if (name === 'html') setInnerHtml(element, propertyValue);
      else if (name === 'text') element.textContent = String(propertyValue);
      else if (name === 'class') element.setAttribute('class', propertyValue);
      else if (name === 'tabIndex') element.setAttribute('tabindex', propertyValue);
      else element.setAttribute(name, propertyValue);
    });
    return new FakeQuery(element);
  }
  throw new Error(`Unsupported jQuery harness value: ${String(value)}`);
}

jquery.parseHTML = (html) => [new FakeText(html)];

function mergeDeep(target, source) {
  Object.entries(source || {}).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      target[key] = mergeDeep(target[key] && typeof target[key] === 'object' ? target[key] : {}, value);
    }
    else target[key] = value;
  });
  return target;
}

jquery.extend = function (...args) {
  const deep = args[0] === true;
  const target = args[deep ? 1 : 0] || {};
  args.slice(deep ? 2 : 1).forEach((source) => deep ? mergeDeep(target, source) : Object.assign(target, source));
  return target;
};

class FakeXAPIEvent {
  constructor(verb) {
    this.verb = verb;
    this.data = { statement: { object: { definition: {} }, result: {} } };
  }

  getVerifiedStatementValue(pathParts) {
    let current = this.data.statement;
    pathParts.forEach((part) => {
      current[part] = current[part] || {};
      current = current[part];
    });
    return current;
  }

  setScoredResult(score, maxScore, instance, completion, success) {
    this.data.statement.result.score = {
      raw: score,
      max: maxScore,
      scaled: maxScore === 0 ? 0 : score / maxScore
    };
    this.data.statement.result.completion = completion;
    this.data.statement.result.success = success;
  }
}

function loadRuntime() {
  function EventDispatcher() {
    this.__listeners = this.__listeners || {};
    this.__events = this.__events || [];
  }
  EventDispatcher.prototype.on = function (name, listener) {
    this.__listeners[name] = this.__listeners[name] || [];
    this.__listeners[name].push(listener);
  };
  EventDispatcher.prototype.trigger = function (event, data) {
    this.__events.push(event);
    if (typeof event === 'string') (this.__listeners[event] || []).forEach((listener) => listener(data));
  };

  function Question() {
    EventDispatcher.call(this);
    this.__buttons = {};
    this.__feedback = null;
    this.__reads = [];
    this.__triggeredXapi = [];
    this.addButton = (id, label, callback, visible, attributes, extras) => {
      this.__buttons[id] = { id, label, callback, visible, attributes, extras };
    };
    this.showButton = (id) => { if (this.__buttons[id]) this.__buttons[id].visible = true; };
    this.hideButton = (id) => { if (this.__buttons[id]) this.__buttons[id].visible = false; };
    this.setFeedback = (text, score, maxScore, scoreBarLabel) => {
      this.__feedback = { text, score, maxScore, scoreBarLabel };
    };
    this.updateFeedbackContent = (text) => {
      this.__feedback = this.__feedback || {};
      this.__feedback.text = text;
    };
    this.removeFeedback = () => { this.__feedback = null; };
    this.setIntroduction = (introduction) => { this.__introduction = introduction; };
    this.setContent = (content, options) => { this.__content = { content, options }; };
    this.setImage = (...args) => { this.__media = { type: 'image', args }; };
    this.setVideo = (...args) => { this.__media = { type: 'video', args }; };
    this.read = (text) => this.__reads.push(text);
    this.triggerXAPI = (verb) => this.__triggeredXapi.push(verb);
    this.createXAPIEventTemplate = (verb) => new FakeXAPIEvent(verb);
  }

  Question.ScorePoints = class ScorePoints {
    getElement(isCorrect) {
      return new FakeElement('div', '', {
        class: isCorrect ? 'h5p-question-plus-one' : 'h5p-question-minus-one'
      });
    }
  };
  Question.determineOverallFeedback = (feedback) => feedback?.[0]?.feedback || '';

  const context = {
    console,
    Text: FakeText,
    document: { createElement: (tagName) => new FakeElement(tagName) },
    H5P: {
      EventDispatcher,
      Question,
      jQuery: jquery,
      MarkTheWordsPapiJo: {},
      createTitle: (title) => title
    }
  };

  vm.createContext(context);
  let Word;
  [
    'scripts/keyboard-nav.js',
    'scripts/xAPI-generator.js',
    'scripts/word.js',
    'scripts/mark-the-words.js'
  ].forEach((relativePath) => {
    const filename = path.join(PROJECT_ROOT, relativePath);
    vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
    if (relativePath === 'scripts/word.js') Word = context.H5P.MarkTheWordsPapiJo.Word;
  });

  return { MarkTheWordsPapiJo: context.H5P.MarkTheWordsPapiJo, Word };
}

const runtimeClasses = loadRuntime();

function extractWordElements(html) {
  return extractElements(html).filter((element) => (
    element.getAttribute('role') === 'option' || element.classList.contains('removePipe')
  ));
}

function baseParams(options = {}) {
  return {
    distractorDelimiter: options.distractorDelimiter || '_',
    correctAnswer: 'Correct!',
    incorrectAnswer: 'Incorrect!',
    missedAnswer: 'Answer not found!',
    isMistake: 'Correctly spotted mistake!',
    notMistake: 'This is not a mistake!',
    behaviour: {
      markSelectables: false,
      spotTheMistakes: false,
      removeHyphens: false,
      keepCorrectAnswers: false,
      hideMistakes: false,
      displayTicksMode: 'ticksAndScorepoints',
      ...(options.behaviour || {})
    }
  };
}

function summarize(words, elements) {
  return Array.from(words, (word, index) => ({
    index,
    text: elements[index].textContent,
    source: word.getText(),
    answer: word.isAnswer(),
    selected: word.isSelected(),
    className: elements[index].className,
    role: elements[index].getAttribute('role') ?? undefined,
    ariaSelected: elements[index].getAttribute('aria-selected') ?? undefined,
    ariaDescribedBy: elements[index].getAttribute('aria-describedby') ?? undefined,
    tabindex: elements[index].getAttribute('tabindex') ?? undefined
  }));
}

function normalizeScore(result) {
  return { correct: result.correct, wrong: result.wrong, missed: result.missed, score: result.score };
}

function createRuntime(text, options = {}) {
  const params = baseParams(options);
  const parser = Object.create(runtimeClasses.MarkTheWordsPapiJo.prototype);
  parser.params = params;
  const html = parser.createHtmlForWords([new FakeText(text)]);
  const elements = extractWordElements(html);
  const words = elements.map((element) => new runtimeClasses.Word(jquery(element), params));
  const answerCount = words.filter((word) => word.isAnswer()).length;
  const task = { selectableWords: words, answers: answerCount || 1, blankIsCorrect: answerCount === 0 };

  return {
    html,
    params,
    elements,
    words,
    getMaxScore: () => task.answers,
    getScoreDetails: () => normalizeScore(runtimeClasses.MarkTheWordsPapiJo.prototype.calculateScore.call(task)),
    select: (index) => words[index].setSelected(),
    summary: () => summarize(words, elements).map((entry) => ({
      index: entry.index,
      text: entry.text,
      source: entry.source,
      answer: entry.answer,
      selected: entry.selected,
      className: entry.className,
      role: entry.role,
      ariaSelected: entry.ariaSelected
    }))
  };
}

function createInteraction(text, options = {}) {
  const params = {
    textField: text,
    taskDescription: options.taskDescription || 'Select the answers.',
    overallFeedback: options.overallFeedback || [{ feedback: 'Score @score/@total' }],
    distractorDelimiter: options.distractorDelimiter || '_',
    behaviour: { ...(options.behaviour || {}) },
    ...(options.params || {})
  };
  const task = new runtimeClasses.MarkTheWordsPapiJo(
    params,
    options.contentId || 1,
    options.contentData || {}
  );
  task.registerDomElements();
  const elements = task.$wordContainer.find('[role="option"], .removePipe').toArray();

  return {
    task,
    elements,
    words: task.selectableWords,
    summary: () => summarize(task.selectableWords, elements),
    score: () => normalizeScore(task.calculateScore()),
    clickButton(id) {
      const button = task.__buttons[id];
      if (!button) throw new Error(`Button not registered: ${id}`);
      button.callback();
    },
    mouseSelect: (index) => elements[index].dispatch('click'),
    key: (index, which) => elements[index].dispatch('keydown', { which }),
    insertLineBreakAfter(index) {
      const element = elements[index];
      const parent = element.parentNode;
      const elementIndex = parent.children.indexOf(element);
      const lineBreak = new FakeElement('br');
      parent.children.splice(elementIndex + 1, 0, lineBreak);
      lineBreak.parentNode = parent;
    },
    buttonVisibility: () => Object.fromEntries(
      Object.entries(task.__buttons).map(([id, button]) => [id, button.visible])
    ),
    answeredEvents: () => task.__events.filter(
      (event) => event instanceof FakeXAPIEvent && event.verb === 'answered'
    )
  };
}

module.exports = { createInteraction, createRuntime };
