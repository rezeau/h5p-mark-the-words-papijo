var H5PUpgrades = H5PUpgrades || {};

H5PUpgrades['H5P.MarkTheWordsPapiJo'] = (function () {
  return {
    1: {
      2: {
        contentUpgrade: function (parameters, finished) {
          var behaviour = parameters && parameters.behaviour;

          if (
            behaviour &&
            Object.prototype.hasOwnProperty.call(behaviour, 'showScorePoints') &&
            !Object.prototype.hasOwnProperty.call(behaviour, 'displayTicksMode')
          ) {
            behaviour.displayTicksMode = behaviour.showScorePoints
              ? 'ticksAndScorepoints'
              : 'ticksOnly';
            delete behaviour.showScorePoints;
          }

          finished(null, parameters);
        }
      }
    }
  };
})();
