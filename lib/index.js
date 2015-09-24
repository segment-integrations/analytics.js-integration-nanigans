
/**
 * Module dependencies.
 */

var Identify = require('facade').Identify;
var Track = require('facade').Track;
var integration = require('analytics.js-integration');
var normalize = require('to-no-case');
var qs = require('querystring');
var sha256 = require('js-sha256');

/**
 * Expose `Nanigans`.
 */

var Nanigans = module.exports = integration('Nanigans')
  .option('appId', '')
  .option('events', {})
  .tag('page', '<script>
  NaN_api = [
    [{{ appId }}, '{{ userId }}'],
    ['visit', 'landing']
  ]; 

  (function() {
    var s = document.createElement('script');
    s.async = true;
    s.src = '//cdn.nanigans.com/NaN_tracker.js';
    var h = document.getElementsByTagName('head')[0];
    h.appendChild(s);
  })();
</script>')

  .tag('track', '<script>
  NaN_api = [
    [{{ appId }}, '{{ userId }}'],
    ['{{ type }}', '{{ name }}' , {{value}} ,{
      'ut1': '{{ ut1 }}'
      'sku': '{{ sku }}'
    }]
  ]; 

  (function() {
    var s = document.createElement('script');
    s.async = true;
    s.src = '//cdn.nanigans.com/NaN_tracker.js';
    var h = document.getElementsByTagName('head')[0];
    h.appendChild(s);
  })();
</script>')
  .tag('product', '<script>
  NaN_api = [
    [{{ appId }}, '{{ userId }}'],
    ['user', 'product_view' , {{value}} ,{
      'ut1': '{{ ut1 }}'
      'sku': '{{ sku }}'
    }]
  ]; 

  (function() {
    var s = document.createElement('script');
    s.async = true;
    s.src = '//cdn.nanigans.com/NaN_tracker.js';
    var h = document.getElementsByTagName('head')[0];
    h.appendChild(s);
  })();
</script>')
  .tag('add_to_cart', '<script>
  NaN_api = [
    [{{ appId }}, '{{ userId }}'],
    ['user', 'add_to_cart' , {{value}} ,{
      'ut1': '{{ ut1 }}'
      'sku': '{{ sku }}'
       'qty': '{{ qty }}'
    }]
  ]; 

  (function() {
    var s = document.createElement('script');
    s.async = true;
    s.src = '//cdn.nanigans.com/NaN_tracker.js';
    var h = document.getElementsByTagName('head')[0];
    h.appendChild(s);
  })();
</script>')
  .tag('purchase', '<script>
  NaN_api = [
    [{{ appId }}, '{{ userId }}'],
    ['purchase', 'main' , {{value}} ,{
      'ut1': '{{ ut1 }}'
      'sku': '{{ sku }}'
       'qty': '{{ qty }}'
    }]
  ]; 

  (function() {
    var s = document.createElement('script');
    s.async = true;
    s.src = '//cdn.nanigans.com/NaN_tracker.js';
    var h = document.getElementsByTagName('head')[0];
    h.appendChild(s);
  })();
</script>');

/**
 * Initialize.
 *
 * https://s3.amazonaws.com/segmentio/docs/integrations/nanigans/docs.html
 *
 * @api public
 */

Nanigans.prototype.initialize = function() {
  // TODO: assert nan_pid URL parameter is present.
  this.ready();
};

/**
 * Loaded?
 *
 * @api public
 * @return {boolean}
 */

Nanigans.prototype.loaded = function() {
  // We load Nanigans pixels on conversions, so we don't need to preload anything
  return true;
};

/**
 * Page.
 *
 * @api public
 * @param {Page} page
 */

Nanigans.prototype.page = function() {
  this.load('page');
};

/**
 * Track.
 *
 * @api public
 * @param {Track} track
 */

Nanigans.prototype.track = function(track) {
  var user = this.analytics.user();
  if (!user.id()) return;

  var events = get(this.options.events, track.event());
  if (!events.length) return;
  var products = track.products();
  var data = {};

  data.app_id = this.options.appId;
  data.user_id = user.id();
  data.unique = track.orderId();
  data.sku = Array(products.length);
  data.qty = Array(products.length);
  data.value = Array(products.length);

  // see readme comment
  if (email(user) != null) {
    data.ut1 = sha256(email(user));
  }

  for (var i = 0; i < products.length; i++) {
    var item = new Track({ properties: products[i] });
    data.qty[i] = item.quantity();
    data.sku[i] = item.sku();
    data.value[i] = item.price();
  }

  // some events may create multiple pixels.
  for (var j = 0; j < events.length; j++) {
    var event = events[j];
    var params = {
      appId: data.app_id,
      name: renderByProxy(event.name, track),
      type: event.type,
      userId: data.user_id,
      ut1: data.ut1,
      products: {}
    };

    switch (event.type) {
      case 'purchase':
        params.orderId = data.unique;
        params.products.qty = data.qty;
        params.products.value = data.value;
        params.products.sku = data.sku;
        params.products = qs.stringify(params.products);
        this.load('purchase', params);
        break;
      case 'user':
        switch (event.name) {
          case 'product':
            params.sku = data.sku;
            break;
          case 'add_to_cart':
            params.products.qty = data.qty;
            params.products.value = data.value;
            params.products.sku = data.sku;
            params.products = qs.stringify(params.products);
            this.load('add_to_cart', params);
            break;
          default:
            this.load('track', params);
            break;
        }
        break;
      default:
        this.load('track', params);
        break;
    }
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
 * Get email from user.
 *
 * @param {Object} user
 * @return {String}
 */

function email(user) {
  var identify = new Identify({ userId: user.id(), traits: user.traits() });
  return identify.email();
}

/**
 * Render Nanigans event name from template.
 *
 * @param {Object} user
 * @return {String}
 */

function renderByProxy(template, facade) {
  return template.replace(/\{\{\ *(\w+?[\.\w+]*?)\ *\}\}/g, function(_, $1) {
    return facade.proxy($1) || '';
  });
}
