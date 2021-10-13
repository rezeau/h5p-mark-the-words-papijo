H5P.MarkTheWordsPapiJo = H5P.MarkTheWordsPapiJo || {};

/**
 * Mark the words XapiGenerator
 */
H5P.MarkTheWordsPapiJo.XapiGenerator = (function ($) {

  /**
   * Xapi statements Generator
   * @param {H5P.MarkTheWordsPapiJo} MarkTheWordsPapiJo
   * @constructor
   */
  function XapiGenerator(MarkTheWordsPapiJo) {

    /**
     * Generate answered event
     * @return {H5P.XAPIEvent}
     */
    this.generateAnsweredEvent = function () {
      var xAPIEvent = MarkTheWordsPapiJo.createXAPIEventTemplate('answered');

      // Extend definition
      var objectDefinition = createDefinition(MarkTheWordsPapiJo);
      $.extend(true, xAPIEvent.getVerifiedStatementValue(['object', 'definition']), objectDefinition);

      // Set score
      xAPIEvent.setScoredResult(MarkTheWordsPapiJo.getScore(),
        MarkTheWordsPapiJo.getMaxScore(),
        MarkTheWordsPapiJo,
        true,
        MarkTheWordsPapiJo.getScore() === MarkTheWordsPapiJo.getMaxScore()
      );

      // Extend user result
      var userResult = {
        response: getUserSelections(MarkTheWordsPapiJo)
      };

      $.extend(xAPIEvent.getVerifiedStatementValue(['result']), userResult);

      return xAPIEvent;
    };
  }

  /**
   * Create object definition for question
   *
   * @param {H5P.MarkTheWordsPapiJo} MarkTheWordsPapiJo
   * @return {Object} Object definition
   */
  function createDefinition(MarkTheWordsPapiJo) {
    var definition = {};
    definition.description = {
      'en-US': replaceLineBreaks(MarkTheWordsPapiJo.params.taskDescription)
    };
    definition.type = 'http://adlnet.gov/expapi/activities/cmi.interaction';
    definition.interactionType = 'choice';
    definition.correctResponsesPattern = [getCorrectResponsesPattern(MarkTheWordsPapiJo)];
    definition.choices = getChoices(MarkTheWordsPapiJo);
    definition.extensions = {
      'https://h5p.org/x-api/line-breaks': MarkTheWordsPapiJo.getIndexesOfLineBreaks()
    };
    return definition;
  }

  /**
   * Replace line breaks
   *
   * @param {string} description
   * @return {string}
   */
  function replaceLineBreaks(description) {
    var sanitized = $('<div>' + description + '</div>').text();
    return sanitized.replace(/(\n)+/g, '<br/>');
  }

  /**
   * Get all choices that it is possible to choose between
   *
   * @param {H5P.MarkTheWordsPapiJo} MarkTheWordsPapiJo
   * @return {Array}
   */
  function getChoices(MarkTheWordsPapiJo) {
    return MarkTheWordsPapiJo.selectableWords.map(function (word, index) {
      var text = word.getText();
      if (text.charAt(0) === '*' && text.charAt(text.length - 1) === '*') {
        text = text.substr(1, text.length - 2);
      }

      return {
        id: index.toString(),
        description: {
          'en-US': $('<div>' + text + '</div>').text()
        }
      };
    });
  }

  /**
   * Get selected words as a user response pattern
   *
   * @param {H5P.MarkTheWordsPapiJo} MarkTheWordsPapiJo
   * @return {string}
   */
  function getUserSelections(MarkTheWordsPapiJo) {
    return MarkTheWordsPapiJo.selectableWords
      .reduce(function (prev, word, index) {
        if (word.isSelected()) {
          prev.push(index);
        }
        return prev;
      }, []).join('[,]');
  }

  /**
   * Get correct response pattern from correct words
   *
   * @param {H5P.MarkTheWordsPapiJo} MarkTheWordsPapiJo
   * @return {string}
   */
  function getCorrectResponsesPattern(MarkTheWordsPapiJo) {
    return MarkTheWordsPapiJo.selectableWords
      .reduce(function (prev, word, index) {
        if (word.isAnswer()) {
          prev.push(index);
        }
        return prev;
      }, []).join('[,]');
  }

  return XapiGenerator;
})(H5P.jQuery);
