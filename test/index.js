var assert    = require('assert'),
    utils     = require('./utils'),
    bundle    = utils.bundle,
    dgraph    = require('../index'),
    through    = require('through');

var globalTransform = function(mod, graph) {
  return {source: mod.source.toString().replace(/__A__/g, '"REPLACED!"')};
}

describe('dgraph', function() {
  
  it('allows to specify global transform', function(done) {
    bundle('depend_on_mod.js', {globalTransform: globalTransform})
      .then(function(mods) { 
        assert.equal(mods.length, 2);
        var mod = mods[0];
        var pkg = mods[1];
        assert.equal(mod.source, 'module.exports = require(\'mod\') + "REPLACED!";\n');
        assert.equal(pkg.source, 'module.exports = function() {\n  return "REPLACED!";\n}\n');
        done();
      })
      .fail(done);
  });

  it('allows downstream to modify dependencies', function(done) {
    var mains = [].concat('depend_on_mod.js').map(utils.fixture);
    var count = 0;
    dgraph(mains, {globalTransform: globalTransform})
      .pipe(through(function(mod) {
        /* Dumbly emulate insert-module-globals */
        mod.deps.utils = require.resolve('./utils');
        count++;
        this.queue(mod);
      }))
      .pipe(through(function(mod) {
        if (count >= 2) {
          done();
        }
      }))
      .on('error', done);
  });
});
