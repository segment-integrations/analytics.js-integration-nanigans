
var Analytics = require('analytics.js-core').constructor;
var integration = require('analytics.js-integration');
var sandbox = require('clear-env');
var tester = require('analytics.js-integration-tester');
var Nanigans = require('../lib/');

describe('Nanigans', function() {
  var nanigans;
  var analytics;
  var options = {
    appId: 58557, // this is actual test account app Id
    events: [
      {
        key: 'testEvent1',
        value: {
          type: 'user',
          name: 'invite'
        }
      },
      {
        key: 'testEvent1',
        value: {
          type: 'install',
          name: 'register'
        }
      },
      {
        key: 'teemski',
        value: {
          type: 'user',
          name: 'pet'
        }
      },
      {
        key: 'Completed Order',
        value: {
          type: 'purchase',
          name: 'main'
        }
      },
      {
        key: 'Completed Order',
        value: {
          type: 'purchase',
          name: 'Purchased with {{ properties.coupon }}'
        }
      },
      {
        key: 'Watched Game',
        value: {
          type: 'visit',
          name: 'Watched {{ properties.league }} {{ properties.sport }} Game'
        }
      }
    ]
  };

  beforeEach(function() {
    analytics = new Analytics();
    nanigans = new Nanigans(options);
    analytics.use(Nanigans);
    analytics.use(tester);
    analytics.add(nanigans);
  });

  afterEach(function() {
    analytics.restore();
    analytics.reset();
    nanigans.reset();
    sandbox();
  });

  it('should have the correct settings', function() {
    analytics.compare(Nanigans, integration('Nanigans')
      .global('NaN_api')
      .option('appId', '')
      .option('events', {}));
  });

  describe('before loading', function() {
    beforeEach(function() {
      analytics.stub(nanigans, 'load');
      analytics.initialize();
      analytics.page();
    });

    describe('#initialize', function() {
      it('should create window.NaN_api', function() {
        analytics.assert(window.NaN_api instanceof Array);
      });
    });
  });

  describe('loading', function() {
    it('should load', function(done) {
      analytics.load(nanigans, done);
    });
  });

  describe('after loading', function() {
    beforeEach(function(done) {
      analytics.once('ready', done);
      analytics.initialize();
      analytics.page();
    });

    it('should create window.NaN_api', function() {
      analytics.assert(window.NaN_api);
    });

    describe('#page', function() {
      beforeEach(function(){
        analytics.stub(window.NaN_api, 'push');
      });

      it('should send stock page view data', function() {
        analytics.page('My Event');
        analytics.called(window.NaN_api.push, ['visit', 'landing']);
      });

      it('should send stock page view data even if props passed in', function() {
        analytics.page('My Event', { referrer: 'teemo.com' });
        analytics.called(window.NaN_api.push, ['visit', 'landing']);
      });
    });

    describe('#identify', function() {
      beforeEach(function(){
        analytics.stub(window.NaN_api, 'push');
      });

      it('should send appId and userId only', function() {
        analytics.identify('813', { pet: 'Teemo' });
        analytics.called(window.NaN_api.push, [58557, '813']);
      });
    });

    describe('#track', function() {
      beforeEach(function(){
        analytics.stub(window.NaN_api, 'push');
      });

      it('should send email hash', function() {
        analytics.track('testEvent1', { email: 'email@example.com' });
        analytics.called(window.NaN_api.push, ['user', 'invite', null, {
          'Segment-integration': true,
          ut1: '2a539d6520266b56c3b0c525b9e6128858baeccb5ee9b694a2906e123c8d6dd3'
        }]);
      });

      it('should not track unmapped event', function() {
        analytics.track('event');
        analytics.didNotCall(window.NaN_api.push);
      });

      it('should track mapped event', function() {
        analytics.track('teemski', { owner: 'Han' });
        analytics.called(window.NaN_api.push, ['user', 'pet', null, {
          'Segment-integration': true,
          owner: 'Han'
        }]);
      });

      it('should pass null as userId if none provided', function() {
        analytics.track('teemski', { owner: 'Han' });
        analytics.called(window.NaN_api.push, ['user', 'pet', null, {
          'Segment-integration': true,
          owner: 'Han'
        }]);
      });

      it('should userId if provided', function() {
        analytics.user().id('813');
        analytics.track('teemski', { owner: 'Han' });
        analytics.called(window.NaN_api.push, ['user', 'pet', '813', {
          'Segment-integration': true,
          owner: 'Han'
        }]);
      });

      it('should track multiple mapped events', function() {
        analytics.user().id('813');
        analytics.track('testEvent1');
        analytics.called(window.NaN_api.push, ['user', 'invite', '813', {
          'Segment-integration': true
        }]);
        analytics.called(window.NaN_api.push, ['install', 'register', '813', {
          'Segment-integration': true
        }]);
      });

      it('should interpolate mapped event name template strings', function() {
        analytics.user().id('813');
        analytics.track('Watched Game', { league: 'NFL', sport: 'Football' });
        analytics.called(window.NaN_api.push, ['visit', 'Watched NFL Football Game', '813', {
          league: 'NFL',
          sport: 'Football',
          'Segment-integration': true
        }]);
      });

      it('should send Completed Order', function() {
        analytics.track('Completed Order', {
          orderId: '50314b8e9bcf000000000000',
          total: 30,
          revenue: 25,
          shipping: 3,
          tax: 2,
          discount: 2.5,
          coupon: 'hasbros',
          currency: 'USD',
          products: [
            {
              id: '507f1f77bcf86cd799439011',
              sku: '45790-32',
              name: 'Monopoly: 3rd Edition',
              price: 19,
              quantity: 1,
              category: 'Games'
            },
            {
              id: '505bd76785ebb509fc183733',
              sku: '46493-32',
              name: 'Uno Card Game',
              price: 3,
              quantity: 2,
              category: 'Games'
            }
          ]
        });
        analytics.called(window.NaN_api.push, ['purchase', 'main', [1900, 600], {
          'Segment-integration': true,
          sku: ['45790-32', '46493-32'],
          qty: [1, 2],
          unique: '50314b8e9bcf000000000000'
        }]);
      });

      it('should send multiple mapped Completed Order', function() {
        analytics.track('Completed Order', {
          orderId: '50314b8e9bcf000000000000',
          total: 30,
          revenue: 25,
          shipping: 3,
          tax: 2,
          discount: 2.5,
          coupon: 'hasbros',
          currency: 'USD',
          products: [
            {
              id: '507f1f77bcf86cd799439011',
              sku: '45790-32',
              name: 'Monopoly: 3rd Edition',
              price: 19,
              quantity: 1,
              category: 'Games'
            },
            {
              id: '505bd76785ebb509fc183733',
              sku: '46493-32',
              name: 'Uno Card Game',
              price: 3,
              quantity: 2,
              category: 'Games'
            }
          ]
        });
        analytics.called(window.NaN_api.push, ['purchase', 'main', [1900, 600], {
          'Segment-integration': true,
          sku: ['45790-32', '46493-32'],
          qty: [1, 2],
          unique: '50314b8e9bcf000000000000'
        }]);
        analytics.called(window.NaN_api.push, ['purchase', 'Purchased with hasbros', [1900, 600], {
          'Segment-integration': true,
          sku: ['45790-32', '46493-32'],
          qty: [1, 2],
          unique: '50314b8e9bcf000000000000'
        }]);
      });
    });
  });
});
