var through = require('through');

module.exports = function(filename) {
  return through(function() {
    this.emit('error', new Error('fail'));
  });
}
