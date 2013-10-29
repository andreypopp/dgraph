var assert    = require('assert'),
    aggregate = require('stream-aggregate-promise'),
    path      = require('path'),
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

module.exports = {
  fixture: fixture,
  bundle: bundle,
  assertCannotFindModule: assertCannotFindModule
};
