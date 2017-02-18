/* */ 
var assert = require('assert');
var prop = require('../index');
describe('transition-property', function() {
  it('should be transition', function() {
    assert.equal(/transition/.test(prop));
  });
});
