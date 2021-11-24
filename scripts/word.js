H5P.MarkTheWordsPapiJo = H5P.MarkTheWordsPapiJo || {};
H5P.MarkTheWordsPapiJo.Word = (function () {
  /**
   * @constant
   *
   * @type {string}
  */
  Word.ID_MARK_MISSED = "h5p-description-missed";
  Word.ID_MARK_MISSED_MISTAKE = "h5p-description-missed-mistake";
  /**
   * @constant
   *
   * @type {string}
   */
  Word.ID_MARK_CORRECT = "h5p-description-correct";
  Word.ID_MARK_IS_MISTAKE = "h5p-description-is-mistake";
  Word.ID_MARK_NOT_MISTAKE = "h5p-description-not-mistake";
  /**
   * @constant
   *
   * @type {string}
   */
  Word.ID_MARK_INCORRECT = "h5p-description-incorrect";

  /**
   * Class for keeping track of selectable words.
   *
   * @class
   * @param {jQuery} $word
   */
  function Word($word, params) {
    let self = this;
    self.params = params;
    H5P.EventDispatcher.call(self);

    let input = $word.text();
    let handledInput = input;

    // Check if word is an answer
    let isAnswer = checkForAnswer();

    // Remove single asterisk and escape double asterisks.
    handleAsterisks();

    if (isAnswer) {
      $word.text(handledInput);
    }

    // Check if word is a distractor (wrong answer)
    let isDistractor = checkForDistractor(self.params.distractorDelimiter);

    // Remove single asterisk and escape double asterisks.
    //handleAsterisks();

    if (isDistractor) {
      $word.text(handledInput);
    }


    const ariaText = document.createElement('span');
    ariaText.classList.add('hidden-but-read');
    $word[0].appendChild(ariaText);

    /**
     * Checks if the word is an answer by checking the first, second to last and last character of the word.
     *
     * @private
     * @return {Boolean} Returns true if the word is an answer.
     */
    function checkForAnswer() {
      // Check last and next to last character, in case of punctuations.
      let wordString = removeDoubleAsterisks(input);
      if (wordString.charAt(0) === ('*') && wordString.length > 2) {
        if (wordString.charAt(wordString.length - 1) === ('*')) {
          handledInput = input.slice(1, input.length - 1);
          return true;
        }
        if (wordString.charAt(wordString.length - 1) === ('_')) {
          handledInput = input.slice(1, input.length - 1);
          return false;
        }
        // If punctuation, add the punctuation to the end of the word.
        else if (wordString.charAt(wordString.length - 2) === ('*')) {
          handledInput = input.slice(1, input.length - 2);
          return true;
        }
        return false;
      }
      return false;
    }

    /**
     * Checks if the word is a distractor by checking the first, second to last and last character of the word.
     *
     * @private
     * @return {Boolean} Returns true if the word is a distractor.
     */
    function checkForDistractor(dl) {
      // Check last and next to last character, in case of punctuations.
      let wordString = removeDoubleAsterisks(input);
      if (wordString.charAt(0) === (dl) && wordString.length > 2) {
        if (wordString.charAt(wordString.length - 1) === (dl)) {
          handledInput = input.slice(1, input.length - 1);
          return true;
        }
        // If punctuation, add the punctuation to the end of the word.
        else if (wordString.charAt(wordString.length - 2) === (dl)) {
          handledInput = input.slice(1, input.length - 2);
          return true;
        }
        return false;
      }
      return false;
    }

    /**
     * Removes double asterisks from string, used to handle input.
     *
     * @private
     * @param {String} wordString The string which will be handled.
     * @return {String} Returns a string without double asterisks.
     */
    function removeDoubleAsterisks(wordString) {
      let asteriskIndex = wordString.indexOf('*');
      let slicedWord = wordString;

      while (asteriskIndex !== -1) {
        if (wordString.indexOf('*', asteriskIndex + 1) === asteriskIndex + 1) {
          slicedWord = wordString.slice(0, asteriskIndex) + wordString.slice(asteriskIndex + 2, input.length);
        }
        asteriskIndex = wordString.indexOf('*', asteriskIndex + 1);
      }
      return slicedWord;
    }

    /**
     * Escape double asterisks ** = *, and remove single asterisk.
     *
     * @private
     */
    function handleAsterisks() {
      let asteriskIndex = handledInput.indexOf('*');

      while (asteriskIndex !== -1) {
        handledInput = handledInput.slice(0, asteriskIndex) + handledInput.slice(asteriskIndex + 1, handledInput.length);
        asteriskIndex = handledInput.indexOf('*', asteriskIndex + 1);
      }
    }

    /**
     * Removes any score points added to the marked word.
     */
    self.clearScorePoint = function () {
      const scorePoint = $word[0].querySelector('div');
      if (scorePoint) {
        scorePoint.parentNode.removeChild(scorePoint);
      }
    };

    /**
     * Get Word as a string
     *
     * @return {string} Word as text
     */
    this.getText = function () {
      return input;
    };

    /**
     * Clears all marks from the word except if keepCorrectAnswers.
     *
     * @public
     */
    this.markClear = function (isFinished) {
      const className = $word.attr('class');
      const ariaAttr = $word.attr('aria-describedby');
      const keepCorrectAnswers = self.params.behaviour.keepCorrectAnswers;
      const hideMistakes = self.params.behaviour.hideMistakes;
      const markSelectables = self.params.behaviour.markSelectables;

      if (isFinished) {
        // Hide correctly spotted mistake at the very end of activity only; also hide potential pipe character.
        if (hideMistakes && (className === 'removePipe' || ariaAttr === Word.ID_MARK_IS_MISTAKE)) {
          $word.addClass('h5p-description-remove-mistake');
          return;
        }
      }
      else { // If this word is the pipe choice character, do not clear the removePipe class !
        let input = $word.text();
        if (input === '|') {
          return;
        }
      }

      let keep;
      if ((isFinished || keepCorrectAnswers) && ariaAttr) {
        keep = ariaAttr.match(/h5p-description-(correct|is-mistake)/g);
      }

      if (!keep) {
        $word
          .attr('aria-selected', false)
          .removeAttr('aria-describedby');
        if (markSelectables) {
          if (ariaAttr === Word.ID_MARK_IS_MISTAKE || ariaAttr === Word.ID_MARK_NOT_MISTAKE 
            || ariaAttr === Word.ID_MARK_CORRECT || ariaAttr === Word.ID_MARK_INCORRECT) {
            $word
              .attr('class', 'groups_unread');
          }
        }
        ariaText.innerHTML = '';
        this.clearScorePoint();
      } 
      else {
        $word
          .attr('aria-selected', true)
          .attr('aria-describedby', ariaAttr);
        if (!isFinished) {
          $word.addClass('keepanswer');
        }
      }
    };

    /**
     * Clears all marks from the word for reset task.
     *
     * @public
     */
    this.markClearAndResetTask = function () {
      $word
        .attr('aria-selected', false)
        .removeAttr('aria-describedby')
        .removeClass('h5p-description-remove-mistake')
        .attr('role', 'option');
      ariaText.innerHTML = '';
      this.clearScorePoint();
    };

    /**
     * Check if the word is correctly marked and style it accordingly.
     * Reveal result
     *
     * @public
     * @param {H5P.Question.ScorePoints} scorePoints
     */
    this.markCheck = function () {    
      const displayTicksMode = self.params.behaviour.displayTicksMode;
      const spotTheMistakes = self.params.behaviour.spotTheMistakes;
      if (this.isSelected()) {
        $word.attr('aria-describedby', isAnswer ? Word.ID_MARK_CORRECT : Word.ID_MARK_INCORRECT);
        ariaText.innerHTML = isAnswer
          ? self.params.correctAnswer
          : self.params.incorrectAnswer;
        
        if (displayTicksMode === 'ticksAndScorepoints') {
          const scorePoints = new H5P.Question.ScorePoints();
          $word[0].appendChild(scorePoints.getElement(isAnswer));
        } 
        else if (displayTicksMode === 'ticksAbove') {
          $word.addClass("hide-ticks");
          this.appendExplanationTo(isAnswer);
        }
        
        if (spotTheMistakes) {
          if (isAnswer) {
            $word.attr('aria-describedby', Word.ID_MARK_IS_MISTAKE);
            ariaText.innerHTML = self.params.isMistake;
          } 
          else {
            $word.attr('aria-describedby', Word.ID_MARK_NOT_MISTAKE);
            ariaText.innerHTML = self.params.notMistake;
          }
        }
      } 
      else if (isAnswer) {
        if (spotTheMistakes) {
          $word.attr('aria-describedby', Word.ID_MARK_MISSED_MISTAKE);
        } 
        else {
          $word.attr('aria-describedby', Word.ID_MARK_MISSED);
        }
        ariaText.innerHTML = self.params.missedAnswer;
      }
    };

    /**
     * Checks if the word is marked correctly.
     *
     * @public
     * @returns {Boolean} True if the marking is correct.
     */
    this.isCorrect = function () {
      return (isAnswer && this.isSelected());
    };

    /**
     * Checks if the word is marked wrong.
     *
     * @public
     * @returns {Boolean} True if the marking is wrong.
     */
    this.isWrong = function () {
      return (!isAnswer && this.isSelected());
    };

    /**
     * Checks if the word is correct, but has not been marked.
     *
     * @public
     * @returns {Boolean} True if the marking is missed.
     */
    this.isMissed = function () {
      return (isAnswer && !this.isSelected());
    };

    /**
     * Checks if the word is an answer.
     *
     * @public
     * @returns {Boolean} True if the word is an answer.
     */
    this.isAnswer = function () {
      return isAnswer;
    };

    /**
     * Checks if the word is selected.
     *
     * @public
     * @returns {Boolean} True if the word is selected.
     */
    this.isSelected = function () {
      return $word.attr('aria-selected') === 'true';
    };

    /**
     * Sets that the Word is selected
     *
     * @public
     */
    this.setSelected = function () {
      $word.attr('aria-selected', 'true');
    };
    
    /**
   * Append explanation to solution.
   * @param {object} $word.
   */
    this.appendExplanationTo = function (isAnswer) {
      const scorePoints = new H5P.Question.ScorePoints();
      const scoreExplanation = scorePoints.getElement(false);
      if (isAnswer) {
        scoreExplanation.classList.add('check');
      }
      else {
        scoreExplanation.classList.add('cross');
      }
      $word[0].appendChild(scoreExplanation);
    };

  }
  Word.prototype = Object.create(H5P.EventDispatcher.prototype);
  Word.prototype.constructor = Word;

  return Word;
})();
