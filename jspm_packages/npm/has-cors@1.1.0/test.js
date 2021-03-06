/* */ 
var expect = require('chai').expect;
describe('has-cors', function() {
  beforeEach(function() {
    delete require.cache[require.resolve('./')];
  });
  it('should not have cors', function() {
    var hasCors = require('./index');
    expect(hasCors).to.be.false;
  });
  it('should have cors', function() {
    global.XMLHttpRequest = function() {
      this.withCredentials = true;
    };
    var hasCors = require('./index');
    expect(hasCors).to.be.true;
  });
});
