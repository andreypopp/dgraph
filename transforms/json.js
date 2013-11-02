"use strict";

var regexp = /\.json$/;

module.exports = function(mod, opts) {
  if (!regexp.exec(mod.filename)) return
  return {source: 'module.exports = ' +  mod.source}
}
