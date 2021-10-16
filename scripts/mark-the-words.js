/*global H5P*/

/**
 * Mark The Words module
 * @external {jQuery} $ H5P.jQuery
 */
H5P.MarkTheWordsPapiJo = (function ($, Question, Word, KeyboardNav, XapiGenerator) {
  /**
   * Initialize module.
   *
   * @class H5P.MarkTheWordsPapiJo
   * @extends H5P.Question
   * @param {Object} params Behavior settings
   * @param {Number} contentId Content identification
   * @param {Object} contentData Object containing task specific content data
   *
   * @returns {Object} MarkTheWordsPapiJo Mark the words instance
   */
  function MarkTheWordsPapiJo(params, contentId, contentData) {
    this.contentId = contentId;
    this.contentData = contentData;
    this.introductionId = 'mark-the-words-introduction-' + contentId;

    Question.call(this, 'mark-the-words');

    // Set default behavior.
    this.params = $.extend(true, {
      taskDescription: "",
      textField: "This is a *nice*, *flexible* content type.",
      overallFeedback: [],
      behaviour: {
        enableRetry: true,
        enableSolutionsButton: true,
        enableCheckButton: true,
        showScorePoints: true
      },
      checkAnswerButton: "Check",
      tryAgainButton: "Retry",
      showSolutionButton: "Show solution",
      correctAnswer: "Correct!",
      incorrectAnswer: "Incorrect!",
      missedAnswer: "Answer not found!",
      displaySolutionDescription:  "Task is updated to contain the solution.",
      scoreBarLabel: 'You got :num out of :total points',
      a11yFullTextLabel: 'Full readable text',
      a11yClickableTextLabel: 'Full text where words can be marked',
      a11ySolutionModeHeader: 'Solution mode',
      a11yCheckingHeader: 'Checking mode',
      a11yCheck: 'Check the answers. The responses will be marked as correct, incorrect, or unanswered.',
      a11yShowSolution: 'Show the solution. The task will be marked with its correct solution.',
      a11yRetry: 'Retry the task. Reset all responses and start the task over again.',
    }, params);

    this.contentData = contentData;
    if (this.contentData !== undefined && this.contentData.previousState !== undefined) {
      this.previousState = this.contentData.previousState;
    }
    
    this.keyboardNavigators = [];
    this.initMarkTheWordsPapiJo();
    this.XapiGenerator = new XapiGenerator(this);
    
  }

  MarkTheWordsPapiJo.prototype = Object.create(H5P.EventDispatcher.prototype);
  MarkTheWordsPapiJo.prototype.constructor = MarkTheWordsPapiJo;

  /**
   * Initialize Mark The Words task
   */
  MarkTheWordsPapiJo.prototype.initMarkTheWordsPapiJo = function () {
    this.$inner = $('<div class="h5p-word-inner"></div>');

    this.addTaskTo(this.$inner);

    // Set user state
    this.setH5PUserState();
  };

  /**
   * Recursive function that creates html for the words
   * @method createHtmlForWords
   * @param  {Array}           nodes Array of dom nodes
   * @return {string}
   */
  MarkTheWordsPapiJo.prototype.createHtmlForWords = function (nodes) {
    var self = this;
    
    var html = '';
    var wordsLink = '_';
    // Papi Jo added syllables detection.
    // TODO make $sep an option in edit content parametres. For the time being we shall use the hyphen character (-).    
    var $sep = "-";
    
    // Routine by Sebastian to accept group of words inside asterisks.
    // See https://github.com/sr258/h5p-mark-the-words/tree/HFP-1095    
    var getSelectableStrings = function (text) {
      var outputStrings = [];
      // Detect presence of words between square brackets.
      var match = text.match(/\[(.*?)\]/g);
      if (match) {
        for (let i = 0; i < match.length; i++) {
          var replace = match[i].replace(/ /g, wordsLink)
          text = text.replace(match[i], replace)
        }
      }
      
      /*
       * Temporarily replace double asterisks with a replacement character,
       * so they don't tamper with the detection of words/phrases to be marked
       */
      var DOUBLE_ASTERISK_REPLACEMENT = '\u250C'; // no-width space character     
      var rgsep = new RegExp('(&nbsp;|\r\n|\n|\r|)' + $sep, 'g');
      var rgwordsLink = new RegExp(wordsLink, 'g');
      
      // END PAPI JO
      
      text = text
        .replace(/\s\*\*\*/g, ' *' + DOUBLE_ASTERISK_REPLACEMENT) // Cover edge case with escaped * in front
        .replace(/\*\*\*\s/g, DOUBLE_ASTERISK_REPLACEMENT + '* ') // Cover edge case with escaped * behind
        .replace(/\*\*/g, DOUBLE_ASTERISK_REPLACEMENT) // Regular escaped *
        .replace(rgsep, ' '+ $sep) // syllable separator
        .replace(rgwordsLink, '\u00a0'); // Added papi Jo to replace underscores with no-break space character  \u00a0
        text = ' ' + text + ' '; // To deal with beginning and end of paragraphs.
      
      var pos;
      do {
        pos = -1;
        // Added papi Jo "OR NOT whitespace" front and back.
        // Replaced the \s whitespace operator with a few operators in order to preserve the nonbreaking characters.
        var rg = /(\ |[^\w\u0020\f\n\r\t\v])\*[^\*]+\*(\ |[^\w\u0020\f\n\r\t\v])/;
        var match = text.match(rg);
        // Eliminate potential redundant $sep here.
        if (match !== null && match[1] !== $sep) {
          pos = match.index;
          // Front part (bunch of regular strings), can each be added to the output          
          outputStrings = outputStrings.concat(text.slice(0, pos + 1).match(/[^\u0020\f\n\r\t\v]+/g) || []);
          // Middle part (word/phrase to be marked), can be added as one word/phrase
          outputStrings.push(match[0]);
          // back part (could be anything), still needs to be checked
          text = text.slice(pos + match[0].length - 1);
        }
      } while (pos != -1);
      // Add each remaining word to output
      outputStrings = outputStrings.concat(text.match(/[^\u0020\f\n\r\t\v]+/g) || []);
      // Should be map() in ES6
      outputStrings.forEach(function(string, index) {
        outputStrings[index] = string.replace(new RegExp(DOUBLE_ASTERISK_REPLACEMENT, 'g'), '**');
      });

      // Return null to match the behavior of the old word/phrase detection routine
      return (outputStrings.length === 0) ? null : outputStrings;
    };
    // END OF SEBASTIAN ROUTINE.
    
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];

      if (node instanceof Text) {
        var text = $(node).text();
        var selectableStrings = getSelectableStrings(text);  
        if (selectableStrings) {
          selectableStrings.forEach(function (entry) {

            entry = entry.trim();            
            // Deal with unselectable words (between square brackets).
            if (entry.startsWith('[')) {
              entry = ' ' + entry.substring(1, entry.length-1);  // remove [] and add initial space for good measure?              
              html += entry;
              return;
            }
            if (!entry.startsWith($sep)) {
              $sepElements = ' ';
            } else { // Case syllables.
              entry = entry.substring(1);
              $sepElements = $sep;
            }
            // Words
            if (html) {
              html += $sepElements;
            }
            
            // Papi Jo added removal of the '/' character used as phonemics delimiter from prefix & suffix.
            
            // Remove prefix punctuations from word
            var prefix = entry.match(/^[\[\({⟨¿¡“"«„/]+/);
            // Papi Jo added remove extra punctuations left over before group of words.
            if (entry == prefix) {
              return;
            }
            var start = 0;
            if (prefix !== null) {
              start = prefix[0].length;
              html += prefix;
            }

            // Remove suffix punctuations from word            
            var suffix = entry.match(/[",….:;?!\]\)}⟩»”/]+$/);
            // Papi Jo added remove extra punctuations left over after group of words.
            if (entry == suffix) {
              return;
            }
            var end = entry.length - start;
            if (suffix !== null) {
              end -= suffix[0].length;
            }
            
            // Word
            entry = entry.substr(start, end);
            if (entry.length) {
              html += '<span role="option" aria-selected="false">' + self.escapeHTML(entry) + '</span>';
            }

            if (suffix !== null) {
              html += suffix;
            }
          });
        }
        else if ((selectableStrings !== null) && text.length) {
          html += '<span role="option" aria-selected="false">' + this.escapeHTML(text) + '</span>';
        }
      }
      else {
        if (node.nodeName === 'BR') {
          html += '<br/>';
        }
        else {
          var attributes = ' ';
          for (var j = 0; j < node.attributes.length; j++) {
            attributes +=node.attributes[j].name + '="' + node.attributes[j].nodeValue + '" ';
          }
          html += '<' + node.nodeName +  attributes + '>';
          html += self.createHtmlForWords(node.childNodes);
          html += '</' + node.nodeName + '>';
        }
      }
    }
    return html;
  };

  /**
   * Escapes HTML
   *
   * @param html
   * @returns {jQuery}
   */
  MarkTheWordsPapiJo.prototype.escapeHTML = function (html) {
    return $('<div>').text(html).html();
  };

  /**
   * Search for the last children in every paragraph and
   * return their indexes in an array
   *
   * @returns {Array}
   */
  MarkTheWordsPapiJo.prototype.getIndexesOfLineBreaks = function () {

    var indexes = [];
    var selectables = this.$wordContainer.find('span.h5p-word-selectable');

    selectables.each(function (index, selectable) {
      if ($(selectable).next().is('br')) {
        indexes.push(index);
      }

      if ($(selectable).parent('p') && !$(selectable).parent().is(':last-child') && $(selectable).is(':last-child')) {
        indexes.push(index);
      }
    });

    return indexes;
  };

  /**
   * Handle task and add it to container.
   * @param {jQuery} $container The object which our task will attach to.
   */
  MarkTheWordsPapiJo.prototype.addTaskTo = function ($container) {
    var self = this;
    self.selectableWords = [];
    self.answers = 0;

    // Wrapper
    var $wordContainer = $('<div/>', {
      'class': 'h5p-word-selectable-words',
      'aria-labelledby': self.introductionId,
      'aria-multiselectable': 'true',
      'role': 'listbox',
      html: self.createHtmlForWords($.parseHTML(self.params.textField))
    });

    let isNewParagraph = true;
    $wordContainer.find('[role="option"], br').each(function () {
      if ($(this).is('br')) {
        isNewParagraph = true;
        return;
      }

      if (isNewParagraph) {
        // Add keyboard navigation helper
        self.currentKeyboardNavigator = new KeyboardNav();

        // on word clicked
        self.currentKeyboardNavigator.on('select', function () {
          self.isAnswered = true;
          self.triggerXAPI('interacted');
        });

        self.keyboardNavigators.push(self.currentKeyboardNavigator);
        isNewParagraph = false;
      }
      self.currentKeyboardNavigator.addElement(this);

      // Add keyboard navigation to this element
      var selectableWord = new Word($(this), self.params);
      if (selectableWord.isAnswer()) {
        self.answers += 1;
      }
      self.selectableWords.push(selectableWord);
    });

    self.blankIsCorrect = (self.answers === 0);
    if (self.blankIsCorrect) {
      self.answers = 1;
    }

    // A11y full readable text
    const $ariaTextWrapper = $('<div>', {
      'class': 'hidden-but-read',
    }).appendTo($container);
    $('<div>', {
      html: self.params.a11yFullTextLabel,
    }).appendTo($ariaTextWrapper);

    // Add space after each paragraph to read the sentences better
    const ariaText = $('<div>', {
      'html': $wordContainer.html().replace('</p>', ' </p>'),
    }).text();

    $('<div>', {
      text: ariaText,
    }).appendTo($ariaTextWrapper);

    // A11y clickable list label
    this.$a11yClickableTextLabel = $('<div>', {
      'class': 'hidden-but-read',
      html: self.params.a11yClickableTextLabel,
      tabIndex: '-1',
    }).appendTo($container);

    $wordContainer.appendTo($container);
    self.$wordContainer = $wordContainer;
  };

  /**
   * Add check solution and retry buttons.
   */
  MarkTheWordsPapiJo.prototype.addButtons = function () {
    var self = this;
    self.$buttonContainer = $('<div/>', {
      'class': 'h5p-button-bar'
    });

    if (this.params.behaviour.enableCheckButton) {
      this.addButton('check-answer', this.params.checkAnswerButton, function () {
        self.isAnswered = true;
        var answers = self.calculateScore();
        self.feedbackSelectedWords();

        if (!self.showEvaluation(answers)) {
          // Only show if a correct answer was not found.
          if (self.params.behaviour.enableSolutionsButton && (answers.correct < self.answers)) {
            self.showButton('show-solution');
          }
          if (self.params.behaviour.enableRetry) {
            self.showButton('try-again');
          }
        }
        // Set focus to start of text
        self.$a11yClickableTextLabel.html(self.params.a11yCheckingHeader + ' - ' + self.params.a11yClickableTextLabel);
        self.$a11yClickableTextLabel.focus();

        self.hideButton('check-answer');
        self.trigger(self.XapiGenerator.generateAnsweredEvent());
        self.toggleSelectable(true);
      }, true, {
        'aria-label': this.params.a11yCheck,
      });
    }

    this.addButton('try-again', this.params.tryAgainButton, this.resetTask.bind(this), false, {
      'aria-label': this.params.a11yRetry,
    });

    this.addButton('show-solution', this.params.showSolutionButton, function () {
      self.setAllMarks();

      self.$a11yClickableTextLabel.html(self.params.a11ySolutionModeHeader + ' - ' + self.params.a11yClickableTextLabel);
      self.$a11yClickableTextLabel.focus();

      if (self.params.behaviour.enableRetry) {
        self.showButton('try-again');
      }
      self.hideButton('check-answer');
      self.hideButton('show-solution');

      self.read(self.params.displaySolutionDescription);
      self.toggleSelectable(true);
    }, false, {
      'aria-label': this.params.a11yShowSolution,
    });
  };

  /**
   * Toggle whether words can be selected
   * @param {Boolean} disable
   */
  MarkTheWordsPapiJo.prototype.toggleSelectable = function (disable) {
    this.keyboardNavigators.forEach(function (navigator) {
      if (disable) {
        navigator.disableSelectability();
        navigator.removeAllTabbable();
      }
      else {
        navigator.enableSelectability();
        navigator.setTabbableAt((0));
      }
    });

    if (disable) {
      this.$wordContainer.removeAttr('aria-multiselectable').removeAttr('role');
    }
    else {
      this.$wordContainer.attr('aria-multiselectable', 'true')
        .attr('role', 'listbox');
    }
  };

  /**
   * Get Xapi Data.
   *
   * @see used in contracts {@link https://h5p.org/documentation/developers/contracts#guides-header-6}
   * @return {Object}
   */
  MarkTheWordsPapiJo.prototype.getXAPIData = function () {
    return {
      statement: this.XapiGenerator.generateAnsweredEvent().data.statement
    };
  };

  /**
   * Mark the words as correct, wrong or missed.
   *
   * @fires MarkTheWordsPapiJo#resize
   */
  MarkTheWordsPapiJo.prototype.setAllMarks = function () {
    this.selectableWords.forEach(function (entry) {
      entry.markCheck();
      entry.clearScorePoint();
    });

    /**
     * Resize event
     *
     * @event MarkTheWordsPapiJo#resize
     */
    this.trigger('resize');
  };

  /**
   * Mark the selected words as correct or wrong.
   *
   * @fires MarkTheWordsPapiJo#resize
   */
  MarkTheWordsPapiJo.prototype.feedbackSelectedWords = function () {
    var self = this;

    var scorePoints;
    if (self.params.behaviour.showScorePoints) {
      scorePoints = new H5P.Question.ScorePoints();
    }

    this.selectableWords.forEach(function (entry) {
      if (entry.isSelected()) {
        entry.markCheck(scorePoints);
      }
    });

    this.$wordContainer.addClass('h5p-disable-hover');
    this.trigger('resize');
  };

  /**
   * Evaluate task and display score text for word markings.
   *
   * @fires MarkTheWordsPapiJo#resize
   * @return {Boolean} Returns true if maxScore was achieved.
   */
  MarkTheWordsPapiJo.prototype.showEvaluation = function (answers) {
    this.hideEvaluation();
    var score = answers.score;

    //replace editor variables with values, uses regexp to replace all instances.
    var scoreText = H5P.Question.determineOverallFeedback(this.params.overallFeedback, score / this.answers).replace(/@score/g, score.toString())
      .replace(/@total/g, this.answers.toString())
      .replace(/@correct/g, answers.correct.toString())
      .replace(/@wrong/g, answers.wrong.toString())
      .replace(/@missed/g, answers.missed.toString());

    this.setFeedback(scoreText, score, this.answers, this.params.scoreBarLabel);

    this.trigger('resize');
    return score === this.answers;
  };

  /**
   * Clear the evaluation text.
   *
   * @fires MarkTheWordsPapiJo#resize
   */
  MarkTheWordsPapiJo.prototype.hideEvaluation = function () {
    this.removeFeedback();
    this.trigger('resize');
  };

  /**
   * Calculate the score.
   *
   * @return {Answers}
   */
  MarkTheWordsPapiJo.prototype.calculateScore = function () {
    var self = this;

    /**
     * @typedef {Object} Answers
     * @property {number} correct The number of correct answers
     * @property {number} wrong The number of wrong answers
     * @property {number} missed The number of answers the user missed
     * @property {number} score The calculated score
     */
    var initial = {
      correct: 0,
      wrong: 0,
      missed: 0,
      score: 0
    };

    // iterate over words, and calculate score
    var answers = self.selectableWords.reduce(function (result, word) {
      if (word.isCorrect()) {
        result.correct++;
      }
      else if (word.isWrong()) {
        result.wrong++;
      }
      else if (word.isMissed()) {
        result.missed++;
      }

      return result;
    }, initial);

    // if no wrong answers, and black is correct
    if (answers.wrong === 0 && self.blankIsCorrect) {
      answers.correct = 1;
    }

    // no negative score
    answers.score = Math.max(answers.correct - answers.wrong, 0);

    return answers;
  };

  /**
   * Clear styling on marked words.
   *
   * @fires MarkTheWordsPapiJo#resize
   */
  MarkTheWordsPapiJo.prototype.clearAllMarks = function () {
    this.selectableWords.forEach(function (entry) {
      entry.markClear();
    });

    this.$wordContainer.removeClass('h5p-disable-hover');
    this.trigger('resize');
  };

  /**
   * Returns true if task is checked or a word has been clicked
   *
   * @see {@link https://h5p.org/documentation/developers/contracts|Needed for contracts.}
   * @returns {Boolean} Always returns true.
   */
  MarkTheWordsPapiJo.prototype.getAnswerGiven = function () {
    return this.blankIsCorrect ? true : this.isAnswered;
  };

  /**
   * Counts the score, which is correct answers subtracted by wrong answers.
   *
   * @see {@link https://h5p.org/documentation/developers/contracts|Needed for contracts.}
   * @returns {Number} score The amount of points achieved.
   */
  MarkTheWordsPapiJo.prototype.getScore = function () {
    return this.calculateScore().score;
  };

  /**
   * Gets max score for this task.
   *
   * @see {@link https://h5p.org/documentation/developers/contracts|Needed for contracts.}
   * @returns {Number} maxScore The maximum amount of points achievable.
   */
  MarkTheWordsPapiJo.prototype.getMaxScore = function () {
    return this.answers;
  };

  /**
   * Get title
   * @returns {string}
   */
  MarkTheWordsPapiJo.prototype.getTitle = function () {
    return H5P.createTitle((this.contentData && this.contentData.metadata && this.contentData.metadata.title) ? this.contentData.metadata.title : 'Mark the Words');
  };

  /**
   * Display the evaluation of the task, with proper markings.
   *
   * @fires MarkTheWordsPapiJo#resize
   * @see {@link https://h5p.org/documentation/developers/contracts|Needed for contracts.}
   */
  MarkTheWordsPapiJo.prototype.showSolutions = function () {
    var answers = this.calculateScore();
    this.showEvaluation(answers);
    this.setAllMarks();
    this.read(this.params.displaySolutionDescription);
    this.hideButton('try-again');
    this.hideButton('show-solution');
    this.hideButton('check-answer');
    this.$a11yClickableTextLabel.html(this.params.a11ySolutionModeHeader + ' - ' + this.params.a11yClickableTextLabel);

    this.toggleSelectable(true);
    this.trigger('resize');
  };

  /**
   * Resets the task back to its' initial state.
   *
   * @fires MarkTheWordsPapiJo#resize
   * @see {@link https://h5p.org/documentation/developers/contracts|Needed for contracts.}
   */
  MarkTheWordsPapiJo.prototype.resetTask = function () {
    this.isAnswered = false;
    this.clearAllMarks();
    this.hideEvaluation();
    this.hideButton('try-again');
    this.hideButton('show-solution');
    this.showButton('check-answer');
    this.$a11yClickableTextLabel.html(this.params.a11yClickableTextLabel);

    this.toggleSelectable(false);
    this.trigger('resize');
  };

  /**
   * Returns an object containing the selected words
   *
   * @public
   * @returns {object} containing indexes of selected words
   */
  MarkTheWordsPapiJo.prototype.getCurrentState = function () {
    var selectedWordsIndexes = [];
    if (this.selectableWords === undefined) {
      return undefined;
    }

    this.selectableWords.forEach(function (selectableWord, swIndex) {
      if (selectableWord.isSelected()) {
        selectedWordsIndexes.push(swIndex);
      }
    });
    return selectedWordsIndexes;
  };

  /**
   * Sets answers to current user state
   */
  MarkTheWordsPapiJo.prototype.setH5PUserState = function () {
    var self = this;

    // Do nothing if user state is undefined
    if (this.previousState === undefined || this.previousState.length === undefined) {
      return;
    }

    // Select words from user state
    this.previousState.forEach(function (answeredWordIndex) {
      if (isNaN(answeredWordIndex) || answeredWordIndex >= self.selectableWords.length || answeredWordIndex < 0) {
        throw new Error('Stored user state is invalid');
      }
      self.selectableWords[answeredWordIndex].setSelected();
    });
  };

  /**
   * Register dom elements
   *
   * @see {@link https://github.com/h5p/h5p-question/blob/1558b6144333a431dd71e61c7021d0126b18e252/scripts/question.js#L1236|Called from H5P.Question}
   */
  MarkTheWordsPapiJo.prototype.registerDomElements = function () {
    var self = this;
    // Check for task media
    var media = this.params.media;
    if (media && media.type && media.type.library) {
      media = media.type;
      var type = media.library.split(' ')[0];
      if (type === 'H5P.Image') {
        if (media.params.file) {
          // Register task image
          self.setImage(media.params.file.path, {
            disableImageZooming: this.params.media.disableImageZooming || false,
            alt: media.params.alt
          });
        }
      } else if (type === 'H5P.Video') {
          if (media.params.sources) {
            // Register task video
            self.setVideo(media);
          }
      } else if (type === 'H5P.Audio') {
        if (media.params.files) {
          // Register task video also works for audio!
          self.setVideo(media); 
        } 
      }
    }
    // wrap introduction in div with id
    var introduction = '<div id="' + this.introductionId + '">' + this.params.taskDescription + '</div>';

    // Register description
    this.setIntroduction(introduction);

    // creates aria descriptions for correct/incorrect/missed
    this.createDescriptionsDom().appendTo(this.$inner);

    // Register content
    this.setContent(this.$inner, {
      'class': 'h5p-word'
    });

    // Register buttons
    this.addButtons();
  };

  /**
   * Creates dom with description to be used with aria-describedby
   * @return {jQuery}
   */
  MarkTheWordsPapiJo.prototype.createDescriptionsDom = function () {
    var self = this;
    var $el = $('<div class="h5p-mark-the-words-descriptions"></div>');

    $('<div id="' + Word.ID_MARK_CORRECT + '">' + self.params.correctAnswer + '</div>').appendTo($el);
    $('<div id="' + Word.ID_MARK_INCORRECT + '">' + self.params.incorrectAnswer + '</div>').appendTo($el);
    $('<div id="' + Word.ID_MARK_MISSED + '">' + self.params.missedAnswer + '</div>').appendTo($el);

    return $el;
  };

  return MarkTheWordsPapiJo;
}(H5P.jQuery, H5P.Question, H5P.MarkTheWordsPapiJo.Word, H5P.KeyboardNav, H5P.MarkTheWordsPapiJo.XapiGenerator));

/**
 * Static utility method for parsing H5P.MarkTheWordsPapiJo content item questions
 * into format useful for generating reports.
 * 
 * Example input: "<p lang=\"en\">I like *pizza* and *burgers*.</p>"
 * 
 * Produces the following:
 * [
 *   {
 *     type: 'text',
 *     content: 'I like '
 *   },
 *   {
 *     type: 'answer',
 *     correct: 'pizza',
 *   },
 *   {
 *     type: 'text',
 *     content: ' and ',
 *   },
 *   {
 *     type: 'answer',
 *     correct: 'burgers'
 *   },
 *   {
 *     type: 'text',
 *     content: '.'
 *   }
 * ]
 * 
 * @param {string} question MarkTheWordsPapiJo textField (html)
 */
H5P.MarkTheWordsPapiJo.parseText = function (question) {

  /**
   * Separate all words surrounded by a space and an asterisk and any other
   * sequence of non-whitespace characters from str into an array.
   * 
   * @param {string} str 
   * @returns {string[]} array of all words in the given string
   */
  function getWords(str) { 
    return str.match(/ \*[^\*]+\* |[^\s]+/g);
  }

  /**
   * Replace each HTML tag in str with the provided value and return the resulting string
   * 
   * Regexp expression explained:
   *   <     - first character is '<'
   *   [^>]* - followed by zero or more occurences of any character except '>'
   *   >     - last character is '>'
   **/ 
  function replaceHtmlTags(str, value) {
    return str.replace(/<[^>]*>/g, value);
  }

  function startsAndEndsWith(char, str) {
    return str.startsWith(char) && str.endsWith(char);
  }

  function removeLeadingPunctuation(str) {
    return str.replace(/^[\[\({⟨¿¡“"«„]+/, '');
  }

  function removeTrailingPunctuation(str) {
    return str.replace(/[",….:;?!\]\)}⟩»”]+$/, '');
  }

  /**
   * Escape double asterisks ** = *, and remove single asterisk.
   * @param {string} str 
   */
  function handleAsterisks(str) {
    var asteriskIndex = str.indexOf('*');

    while (asteriskIndex !== -1) {
      str = str.slice(0, asteriskIndex) + str.slice(asteriskIndex + 1, str.length);
      asteriskIndex = str.indexOf('*', asteriskIndex + 1);
    }
    return str;
  }

  /**
   * Decode HTML entities (e.g. &nbsp;) from the given string using the DOM API
   * @param {string} str 
   */
  function decodeHtmlEntities(str) {
    const el = document.createElement('textarea');
    el.innerHTML = str;
    return el.value;
  }
  /**
   * An audio player to display above the task.
   *
   * @param {object} params
   */
  function setAudio(params) {
    params.params = params.params || {};

    sections.audio = {
      $element: $('<div/>', {
        'class': 'h5p-question-audio',
      })
    };

    if (disableAutoPlay) {
      params.params.autoplay = false;
    }
    else if (params.params.playerMode === 'transparent') {
      params.params.autoplay = true; // false doesn't make sense for transparent audio
    }

    sections.audio.instance = H5P.newRunnable(params, self.contentId, sections.audio.$element, true);
    // The height value that is set by H5P.Audio is counter-productive here.
    if (sections.audio.instance.audio) {
      sections.audio.instance.audio.style.height = '';
    }

    return self;
  };

  const wordsWithAsterisksNotRemovedYet = getWords(replaceHtmlTags(decodeHtmlEntities(question), ' '))
    .map(function (w) {
      return w.trim();
    })
    .map(function (w) {
      return removeLeadingPunctuation(w);
    })
    .map(function (w) {
      return removeTrailingPunctuation(w);
    });

  const allSelectableWords = wordsWithAsterisksNotRemovedYet.map(function (w) {
    return handleAsterisks(w); 
  });

  const correctWordIndexes = [];

  const correctWords = wordsWithAsterisksNotRemovedYet
    .filter(function (w, i) { 
      if (startsAndEndsWith('*', w)) {
        correctWordIndexes.push(i);
        return true;
      }
      return false;
    })
    .map(function (w) {
      return handleAsterisks(w);
    });
  
  const printableQuestion = replaceHtmlTags(decodeHtmlEntities(question), ' ')
    .replace('\xa0', '\x20');

  return {
    alternatives: allSelectableWords,
    correctWords: correctWords,
    correctWordIndexes: correctWordIndexes,
    textWithPlaceholders: printableQuestion.match(/[^\s]+/g)
      .reduce(function (textWithPlaceholders, word, index) {
        word = removeTrailingPunctuation(
          removeLeadingPunctuation(word));
        
        return textWithPlaceholders.replace(word, '%' + index);
      }, printableQuestion)
  };
};