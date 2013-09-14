"use strict";

module.exports = function(mod, opts) {
  if (!/.*\.json/.exec(mod.filename)) return
  return {source: 'module.exports = ' +  mod.source}
}
