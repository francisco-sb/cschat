/* */ 
var transports = require('./transports/index');
var Emitter = require('component-emitter');
var debug = require('debug')('engine.io-client:socket');
var index = require('indexof');
var parser = require('engine.io-parser');
var parseuri = require('parseuri');
var parsejson = require('parsejson');
var parseqs = require('parseqs');
module.exports = Socket;
function Socket(uri, opts) {
  if (!(this instanceof Socket))
    return new Socket(uri, opts);
  opts = opts || {};
  if (uri && 'object' === typeof uri) {
    opts = uri;
    uri = null;
  }
  if (uri) {
    uri = parseuri(uri);
    opts.hostname = uri.host;
    opts.secure = uri.protocol === 'https' || uri.protocol === 'wss';
    opts.port = uri.port;
    if (uri.query)
      opts.query = uri.query;
  } else if (opts.host) {
    opts.hostname = parseuri(opts.host).host;
  }
  this.secure = null != opts.secure ? opts.secure : (global.location && 'https:' === location.protocol);
  if (opts.hostname && !opts.port) {
    opts.port = this.secure ? '443' : '80';
  }
  this.agent = opts.agent || false;
  this.hostname = opts.hostname || (global.location ? location.hostname : 'localhost');
  this.port = opts.port || (global.location && location.port ? location.port : (this.secure ? 443 : 80));
  this.query = opts.query || {};
  if ('string' === typeof this.query)
    this.query = parseqs.decode(this.query);
  this.upgrade = false !== opts.upgrade;
  this.path = (opts.path || '/engine.io').replace(/\/$/, '') + '/';
  this.forceJSONP = !!opts.forceJSONP;
  this.jsonp = false !== opts.jsonp;
  this.forceBase64 = !!opts.forceBase64;
  this.enablesXDR = !!opts.enablesXDR;
  this.timestampParam = opts.timestampParam || 't';
  this.timestampRequests = opts.timestampRequests;
  this.transports = opts.transports || ['polling', 'websocket'];
  this.readyState = '';
  this.writeBuffer = [];
  this.prevBufferLen = 0;
  this.policyPort = opts.policyPort || 843;
  this.rememberUpgrade = opts.rememberUpgrade || false;
  this.binaryType = null;
  this.onlyBinaryUpgrades = opts.onlyBinaryUpgrades;
  this.perMessageDeflate = false !== opts.perMessageDeflate ? (opts.perMessageDeflate || {}) : false;
  if (true === this.perMessageDeflate)
    this.perMessageDeflate = {};
  if (this.perMessageDeflate && null == this.perMessageDeflate.threshold) {
    this.perMessageDeflate.threshold = 1024;
  }
  this.pfx = opts.pfx || null;
  this.key = opts.key || null;
  this.passphrase = opts.passphrase || null;
  this.cert = opts.cert || null;
  this.ca = opts.ca || null;
  this.ciphers = opts.ciphers || null;
  this.rejectUnauthorized = opts.rejectUnauthorized === undefined ? null : opts.rejectUnauthorized;
  this.forceNode = !!opts.forceNode;
  var freeGlobal = typeof global === 'object' && global;
  if (freeGlobal.global === freeGlobal) {
    if (opts.extraHeaders && Object.keys(opts.extraHeaders).length > 0) {
      this.extraHeaders = opts.extraHeaders;
    }
    if (opts.localAddress) {
      this.localAddress = opts.localAddress;
    }
  }
  this.id = null;
  this.upgrades = null;
  this.pingInterval = null;
  this.pingTimeout = null;
  this.pingIntervalTimer = null;
  this.pingTimeoutTimer = null;
  this.open();
}
Socket.priorWebsocketSuccess = false;
Emitter(Socket.prototype);
Socket.protocol = parser.protocol;
Socket.Socket = Socket;
Socket.Transport = require('./transport');
Socket.transports = require('./transports/index');
Socket.parser = require('engine.io-parser');
Socket.prototype.createTransport = function(name) {
  debug('creating transport "%s"', name);
  var query = clone(this.query);
  query.EIO = parser.protocol;
  query.transport = name;
  if (this.id)
    query.sid = this.id;
  var transport = new transports[name]({
    agent: this.agent,
    hostname: this.hostname,
    port: this.port,
    secure: this.secure,
    path: this.path,
    query: query,
    forceJSONP: this.forceJSONP,
    jsonp: this.jsonp,
    forceBase64: this.forceBase64,
    enablesXDR: this.enablesXDR,
    timestampRequests: this.timestampRequests,
    timestampParam: this.timestampParam,
    policyPort: this.policyPort,
    socket: this,
    pfx: this.pfx,
    key: this.key,
    passphrase: this.passphrase,
    cert: this.cert,
    ca: this.ca,
    ciphers: this.ciphers,
    rejectUnauthorized: this.rejectUnauthorized,
    perMessageDeflate: this.perMessageDeflate,
    extraHeaders: this.extraHeaders,
    forceNode: this.forceNode,
    localAddress: this.localAddress
  });
  return transport;
};
function clone(obj) {
  var o = {};
  for (var i in obj) {
    if (obj.hasOwnProperty(i)) {
      o[i] = obj[i];
    }
  }
  return o;
}
Socket.prototype.open = function() {
  var transport;
  if (this.rememberUpgrade && Socket.priorWebsocketSuccess && this.transports.indexOf('websocket') !== -1) {
    transport = 'websocket';
  } else if (0 === this.transports.length) {
    var self = this;
    setTimeout(function() {
      self.emit('error', 'No transports available');
    }, 0);
    return;
  } else {
    transport = this.transports[0];
  }
  this.readyState = 'opening';
  try {
    transport = this.createTransport(transport);
  } catch (e) {
    this.transports.shift();
    this.open();
    return;
  }
  transport.open();
  this.setTransport(transport);
};
Socket.prototype.setTransport = function(transport) {
  debug('setting transport %s', transport.name);
  var self = this;
  if (this.transport) {
    debug('clearing existing transport %s', this.transport.name);
    this.transport.removeAllListeners();
  }
  this.transport = transport;
  transport.on('drain', function() {
    self.onDrain();
  }).on('packet', function(packet) {
    self.onPacket(packet);
  }).on('error', function(e) {
    self.onError(e);
  }).on('close', function() {
    self.onClose('transport close');
  });
};
Socket.prototype.probe = function(name) {
  debug('probing transport "%s"', name);
  var transport = this.createTransport(name, {probe: 1});
  var failed = false;
  var self = this;
  Socket.priorWebsocketSuccess = false;
  function onTransportOpen() {
    if (self.onlyBinaryUpgrades) {
      var upgradeLosesBinary = !this.supportsBinary && self.transport.supportsBinary;
      failed = failed || upgradeLosesBinary;
    }
    if (failed)
      return;
    debug('probe transport "%s" opened', name);
    transport.send([{
      type: 'ping',
      data: 'probe'
    }]);
    transport.once('packet', function(msg) {
      if (failed)
        return;
      if ('pong' === msg.type && 'probe' === msg.data) {
        debug('probe transport "%s" pong', name);
        self.upgrading = true;
        self.emit('upgrading', transport);
        if (!transport)
          return;
        Socket.priorWebsocketSuccess = 'websocket' === transport.name;
        debug('pausing current transport "%s"', self.transport.name);
        self.transport.pause(function() {
          if (failed)
            return;
          if ('closed' === self.readyState)
            return;
          debug('changing transport and sending upgrade packet');
          cleanup();
          self.setTransport(transport);
          transport.send([{type: 'upgrade'}]);
          self.emit('upgrade', transport);
          transport = null;
          self.upgrading = false;
          self.flush();
        });
      } else {
        debug('probe transport "%s" failed', name);
        var err = new Error('probe error');
        err.transport = transport.name;
        self.emit('upgradeError', err);
      }
    });
  }
  function freezeTransport() {
    if (failed)
      return;
    failed = true;
    cleanup();
    transport.close();
    transport = null;
  }
  function onerror(err) {
    var error = new Error('probe error: ' + err);
    error.transport = transport.name;
    freezeTransport();
    debug('probe transport "%s" failed because of error: %s', name, err);
    self.emit('upgradeError', error);
  }
  function onTransportClose() {
    onerror('transport closed');
  }
  function onclose() {
    onerror('socket closed');
  }
  function onupgrade(to) {
    if (transport && to.name !== transport.name) {
      debug('"%s" works - aborting "%s"', to.name, transport.name);
      freezeTransport();
    }
  }
  function cleanup() {
    transport.removeListener('open', onTransportOpen);
    transport.removeListener('error', onerror);
    transport.removeListener('close', onTransportClose);
    self.removeListener('close', onclose);
    self.removeListener('upgrading', onupgrade);
  }
  transport.once('open', onTransportOpen);
  transport.once('error', onerror);
  transport.once('close', onTransportClose);
  this.once('close', onclose);
  this.once('upgrading', onupgrade);
  transport.open();
};
Socket.prototype.onOpen = function() {
  debug('socket open');
  this.readyState = 'open';
  Socket.priorWebsocketSuccess = 'websocket' === this.transport.name;
  this.emit('open');
  this.flush();
  if ('open' === this.readyState && this.upgrade && this.transport.pause) {
    debug('starting upgrade probes');
    for (var i = 0,
        l = this.upgrades.length; i < l; i++) {
      this.probe(this.upgrades[i]);
    }
  }
};
Socket.prototype.onPacket = function(packet) {
  if ('opening' === this.readyState || 'open' === this.readyState || 'closing' === this.readyState) {
    debug('socket receive: type "%s", data "%s"', packet.type, packet.data);
    this.emit('packet', packet);
    this.emit('heartbeat');
    switch (packet.type) {
      case 'open':
        this.onHandshake(parsejson(packet.data));
        break;
      case 'pong':
        this.setPing();
        this.emit('pong');
        break;
      case 'error':
        var err = new Error('server error');
        err.code = packet.data;
        this.onError(err);
        break;
      case 'message':
        this.emit('data', packet.data);
        this.emit('message', packet.data);
        break;
    }
  } else {
    debug('packet received with socket readyState "%s"', this.readyState);
  }
};
Socket.prototype.onHandshake = function(data) {
  this.emit('handshake', data);
  this.id = data.sid;
  this.transport.query.sid = data.sid;
  this.upgrades = this.filterUpgrades(data.upgrades);
  this.pingInterval = data.pingInterval;
  this.pingTimeout = data.pingTimeout;
  this.onOpen();
  if ('closed' === this.readyState)
    return;
  this.setPing();
  this.removeListener('heartbeat', this.onHeartbeat);
  this.on('heartbeat', this.onHeartbeat);
};
Socket.prototype.onHeartbeat = function(timeout) {
  clearTimeout(this.pingTimeoutTimer);
  var self = this;
  self.pingTimeoutTimer = setTimeout(function() {
    if ('closed' === self.readyState)
      return;
    self.onClose('ping timeout');
  }, timeout || (self.pingInterval + self.pingTimeout));
};
Socket.prototype.setPing = function() {
  var self = this;
  clearTimeout(self.pingIntervalTimer);
  self.pingIntervalTimer = setTimeout(function() {
    debug('writing ping packet - expecting pong within %sms', self.pingTimeout);
    self.ping();
    self.onHeartbeat(self.pingTimeout);
  }, self.pingInterval);
};
Socket.prototype.ping = function() {
  var self = this;
  this.sendPacket('ping', function() {
    self.emit('ping');
  });
};
Socket.prototype.onDrain = function() {
  this.writeBuffer.splice(0, this.prevBufferLen);
  this.prevBufferLen = 0;
  if (0 === this.writeBuffer.length) {
    this.emit('drain');
  } else {
    this.flush();
  }
};
Socket.prototype.flush = function() {
  if ('closed' !== this.readyState && this.transport.writable && !this.upgrading && this.writeBuffer.length) {
    debug('flushing %d packets in socket', this.writeBuffer.length);
    this.transport.send(this.writeBuffer);
    this.prevBufferLen = this.writeBuffer.length;
    this.emit('flush');
  }
};
Socket.prototype.write = Socket.prototype.send = function(msg, options, fn) {
  this.sendPacket('message', msg, options, fn);
  return this;
};
Socket.prototype.sendPacket = function(type, data, options, fn) {
  if ('function' === typeof data) {
    fn = data;
    data = undefined;
  }
  if ('function' === typeof options) {
    fn = options;
    options = null;
  }
  if ('closing' === this.readyState || 'closed' === this.readyState) {
    return;
  }
  options = options || {};
  options.compress = false !== options.compress;
  var packet = {
    type: type,
    data: data,
    options: options
  };
  this.emit('packetCreate', packet);
  this.writeBuffer.push(packet);
  if (fn)
    this.once('flush', fn);
  this.flush();
};
Socket.prototype.close = function() {
  if ('opening' === this.readyState || 'open' === this.readyState) {
    this.readyState = 'closing';
    var self = this;
    if (this.writeBuffer.length) {
      this.once('drain', function() {
        if (this.upgrading) {
          waitForUpgrade();
        } else {
          close();
        }
      });
    } else if (this.upgrading) {
      waitForUpgrade();
    } else {
      close();
    }
  }
  function close() {
    self.onClose('forced close');
    debug('socket closing - telling transport to close');
    self.transport.close();
  }
  function cleanupAndClose() {
    self.removeListener('upgrade', cleanupAndClose);
    self.removeListener('upgradeError', cleanupAndClose);
    close();
  }
  function waitForUpgrade() {
    self.once('upgrade', cleanupAndClose);
    self.once('upgradeError', cleanupAndClose);
  }
  return this;
};
Socket.prototype.onError = function(err) {
  debug('socket error %j', err);
  Socket.priorWebsocketSuccess = false;
  this.emit('error', err);
  this.onClose('transport error', err);
};
Socket.prototype.onClose = function(reason, desc) {
  if ('opening' === this.readyState || 'open' === this.readyState || 'closing' === this.readyState) {
    debug('socket close with reason: "%s"', reason);
    var self = this;
    clearTimeout(this.pingIntervalTimer);
    clearTimeout(this.pingTimeoutTimer);
    this.transport.removeAllListeners('close');
    this.transport.close();
    this.transport.removeAllListeners();
    this.readyState = 'closed';
    this.id = null;
    this.emit('close', reason, desc);
    self.writeBuffer = [];
    self.prevBufferLen = 0;
  }
};
Socket.prototype.filterUpgrades = function(upgrades) {
  var filteredUpgrades = [];
  for (var i = 0,
      j = upgrades.length; i < j; i++) {
    if (~index(this.transports, upgrades[i]))
      filteredUpgrades.push(upgrades[i]);
  }
  return filteredUpgrades;
};
