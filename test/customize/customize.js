var simpleEvents = require('nodeunit').testCase;
var file = '../../lib/eventemitter2';

var EventEmitter2;

if (typeof require !== 'undefined') {
  EventEmitter2 = require(file).EventEmitter2;
}
else {
  EventEmitter2 = window.EventEmitter2;
}

module.exports = simpleEvents({

  '1. support namespace ': function (test) {

    var emitter = new EventEmitter2({
      wildcard: true
    });

    emitter.on('login_success.loginDialog', function () {
      test.ok(true, 'The event was raised once');
    });

    emitter.emit('login_success');
    emitter.off('login_success.loginDialog');
    emitter.emit('login_success');

    test.expect(1);
    test.done();
  },

  '2. namespace is isolate': function (test) {

    var emitter = new EventEmitter2({
      wildcard: true
    });

    emitter.on('login_success.loginDialog', function () {
      test.ok(true, 'The event was raised once');
    });

    emitter.on('login_success.logoutDialog', function () {
      test.ok(true, 'The event was raised once');
    });

    emitter.emit('login_success');
    emitter.off('login_success.loginDialog');
    emitter.emit('login_success');

    test.expect(3);
    test.done();
  }

});
