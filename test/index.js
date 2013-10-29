var assert    = require('assert'),
    bundle    = require('./utils').bundle;

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
});
