"use strict";

var detective = require('detective')

module.exports = function(mod, graph) {
  if (graph.noParse(mod.id)) return

  try {
    var deps = detective(mod.source)
  } catch(e) {
    return
  }

  return graph.resolveMany(deps, mod)
    .then(function(deps) { return {deps: deps} })
}

