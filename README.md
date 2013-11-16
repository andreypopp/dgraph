# dgraph

`dgraph` is a replacement for `module-deps` which:

  * is almost fully compatible with `module-deps` for the exception of
    different caching mechanism, otherwise it reuses test suite from
    `module-deps`
  * allows you to extract dependencies and enrich modules via module transforms
    (in addition to source transform)

## Installation

    % npm install dgraph

## Usage

`dgraph` is fully compatible with `module-deps` so you all configuration options
and API are the same:

    var dgraph = require('dgraph'),
        JSONStream = require('JSONStream')

    dgraph('./app.coffee', {transform: 'coffeeify'})
      .pipe(JSONStream.stringify())
      .pipe(process.stdout)

### Global transforms

Transforms specified via command line or function arguments only works for
modules not in `node_modules/` (this is behaviour of `module-deps` also).

`dgraph` also supports `globalTransform` argument which allows to specify
transforms for all modules even those in `node_modules/`.

### Module transforms

In addition to source transforms which are supported by `module-deps`, there's
module transforms which can transform modules themselves.

For `dgraph` to distinguish between source and module transforms you should
define a module transform as a function of two arguments — `filename` and
`graph`. That way module transforms can use Graph API to resolve dependencies.

Even extraction of CommonJS dependencies implemented as a module transform:

    var detective = require('detective')

    module.exports = function(mod, graph) {
      if (graph.opts.noParse && graph.opts.noParse.indexOf(mod.id) > -1) return
      var deps = detective(mod.source)

      return graph.resolveMany(deps, mod)
        .then(function(deps) { return {deps: deps} })
    }
