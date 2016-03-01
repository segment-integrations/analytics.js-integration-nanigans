
/**
 * Module dependencies.
 */

var integration = require('analytics.js-integration');
var normalize = require('to-no-case');
var sha256 = require('js-sha256');
var push = require('global-queue')('NaN_api');

/**
 * Expose `Nanigans`.
 */

var Nanigans = module.exports = integration('Nanigans')
  .global('NaN_api')
  .option('appId', '')
  .option('events', {})
  .tag('<script src="//cdn.nanigans.com/NaN_tracker.js">');


/**
 * Initialize.
 *
 * https://s3.amazonaws.com/segmentio/docs/integrations/nanigans/docs.html
 *
 * @api public
 */

Nanigans.prototype.initialize = function() {
  window.NaN_api = [[this.options.appId]];
  this.load(this.ready);
};

/**
 * Loaded?
 *
 * @api public
 * @return {boolean}
 */

Nanigans.prototype.loaded = function() {
  return !!window.NaN_api;
};

/**
 * Page.
 *
 * @api public
 * @param {Page} page
 */

Nanigans.prototype.page = function() {
  push('visit', 'landing');
};

/**
 * Identify
 */

Nanigans.prototype.identify = function(identify) {
  var id = identify.userId();
  if (id) push(this.options.appId, id);
};

/**
 * Track.
 *
 * @api public
 * @param {Track} track
 */

Nanigans.prototype.track = function(track) {
  // if no userId, Nanigans will rely on their cookie or "fingerprint" to do attribution
  var id = track.userId() || this.analytics.user().id() || null;
  var events = get(this.options.events, track.event());
  var props = track.properties();

  // Send email hash for Custom Audiences
  if (track.email()) {
    props.ut1 = sha256(track.email());
    delete props.email;
  }

  // Tag all events as Segment's (asked by Nanigans)
  props['Segment-integration'] = true;

  // Formulate payload
  for (var i = 0; i < events.length; i++) {
    var event = events[i];
    var name = renderByProxy(event.name, track);
    push(event.type, name, id, props); // Queue event
  }
};

Nanigans.prototype.completedOrder = function(track) {
  var events = get(this.options.events, track.event());
  var products = track.products();
  var orderId = track.orderId();

  // Formulate payload for each mapped event
  for (var i = 0; i < events.length; i++) {
    var event = events[i];
    var extras = {
      sku: [],
      qty: [],
      unique: orderId,
      'Segment-integration': true // Requested by Nanigans
    };
    var prices = [];

    // Override default 'main' name
    var name = '';
    if (event.name !== 'main') {
      name = renderByProxy(event.name, track);
    } else {
      name = 'main';
    }

    for (var j = 0; j < products.length; j++) {
      var product = products[j];
      prices.push(product.price * 100 * product.quantity); // prices are in cents * qty
      extras.sku.push(product.sku);
      extras.qty.push(product.quantity);
    }

    // Send email hash for Custom Audiences
    if (track.email()) extras.push(sha256(track.email()));

    push('purchase', name, prices, extras);
  }
};

/**
 * Get an event of `name`.
 *
 * Given something like this:
 *
 * [
 *   { key: 'a', value: { type: 'user', name: 'register' } }
 *   { key: 'a', value: { type: 'user', name: 'invite' } }
 *   { key: 'b', value: { type: 'purchase', name: 'main' } }
 * ]
 *
 * If you do `get(events, 'a')`, it wll give you:
 *
 * [
 *   { type: 'user', name: 'register' },
 *   { type: 'user', name: 'invite' }
 * ]
 *
 * @param {Array} events
 * @param {String} name
 * @return {Object}
 */

function get(events, name) {
  var a = normalize(name);
  var ret = [];

  for (var i = 0; i < events.length; ++i) {
    var b = normalize(events[i].key);
    if (b === a) ret.push(events[i].value);
  }

  return ret;
}

/**
 * Render Nanigans event name from template.
 * In case they use the templates in the Nanigans event mappings
 *
 * @param {Object} user
 * @return {String}
 */

function renderByProxy(template, facade) {
  return template.replace(/\{\{\ *(\w+?[\.\w+]*?)\ *\}\}/g, function(_, $1) {
    return facade.proxy($1) || '';
  });
}
