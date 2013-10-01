var assert    = require('assert'),
    path      = require('path'),
    aggregate = require('stream-aggregate-promise'),
    dgraph    = require('../index');

function fixture(filename) {
  return path.join(__dirname, 'fixtures', filename);
}

function bundle(mains, opts) {
  mains = [].concat(mains).map(fixture);
  return aggregate(dgraph(mains, opts));
}

function assertCannotFindModule(err) {
  assert.ok(err.message.match(/cannot find module/i));
}

var shouldRaise = new Error('should raise an error instead');

describe('error propagation', function() {

  it('propagates require dep error', function(done) {
    bundle('failing_require_dep.js')
      .then(function(bundle) { done(shouldRaise); })
      .fail(function(err) {
        assertCannotFindModule(err);
        done();
      });
  });
  
  it('propagates transform require errors', function(done) {
    bundle('foo.js', {transform: 'oops'})
      .then(function(bundle) { done(shouldRaise); })
      .fail(function(err) {
        assertCannotFindModule(err);
        done();
      });
  });

  it('propagates package transform require errors', function(done) {
    bundle(
        'failing_require_pkg_transform.js',
        {transformKey: ['browserify', 'transform']})
      .then(function(bundle) { done(shouldRaise); })
      .fail(function(err) {
        assertCannotFindModule(err);
        done();
      });
  });

  it('propagates streaming transform errors', function(done) {
    bundle(
        'foo.js',
        {transform: './failing_streaming_transform'})
      .then(function(bundle) { done(shouldRaise); })
      .fail(function(err) {
        assert.equal(err.message, 'fail');
        done();
      });
  });

  it('propagates transform errors', function(done) {
    bundle(
        'foo.js',
        {transform: './failing_transform'})
      .then(function(bundle) { done(shouldRaise); })
      .fail(function(err) {
        assert.equal(err.message, 'fail');
        done();
      });
  });

  it('propagates transform errors (async)', function(done) {
    bundle(
        'foo.js',
        {transform: './failing_transform_async'})
      .then(function(bundle) { done(shouldRaise); })
      .fail(function(err) {
        assert.equal(err.message, 'fail');
        done();
      });
  });
});
