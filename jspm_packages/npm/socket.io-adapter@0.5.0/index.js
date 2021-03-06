/* */ 
(function(process) {
  var Emitter = require('events').EventEmitter;
  var parser = require('socket.io-parser');
  module.exports = Adapter;
  function Adapter(nsp) {
    this.nsp = nsp;
    this.rooms = {};
    this.sids = {};
    this.encoder = new parser.Encoder();
  }
  Adapter.prototype.__proto__ = Emitter.prototype;
  Adapter.prototype.add = function(id, room, fn) {
    this.sids[id] = this.sids[id] || {};
    this.sids[id][room] = true;
    this.rooms[room] = this.rooms[room] || Room();
    this.rooms[room].add(id);
    if (fn)
      process.nextTick(fn.bind(null, null));
  };
  Adapter.prototype.del = function(id, room, fn) {
    this.sids[id] = this.sids[id] || {};
    delete this.sids[id][room];
    if (this.rooms.hasOwnProperty(room)) {
      this.rooms[room].del(id);
      if (this.rooms[room].length === 0)
        delete this.rooms[room];
    }
    if (fn)
      process.nextTick(fn.bind(null, null));
  };
  Adapter.prototype.delAll = function(id, fn) {
    var rooms = this.sids[id];
    if (rooms) {
      for (var room in rooms) {
        if (this.rooms.hasOwnProperty(room)) {
          this.rooms[room].del(id);
          if (this.rooms[room].length === 0)
            delete this.rooms[room];
        }
      }
    }
    delete this.sids[id];
    if (fn)
      process.nextTick(fn.bind(null, null));
  };
  Adapter.prototype.broadcast = function(packet, opts) {
    var rooms = opts.rooms || [];
    var except = opts.except || [];
    var flags = opts.flags || {};
    var packetOpts = {
      preEncoded: true,
      volatile: flags.volatile,
      compress: flags.compress
    };
    var ids = {};
    var self = this;
    var socket;
    packet.nsp = this.nsp.name;
    this.encoder.encode(packet, function(encodedPackets) {
      if (rooms.length) {
        for (var i = 0; i < rooms.length; i++) {
          var room = self.rooms[rooms[i]];
          if (!room)
            continue;
          var sockets = room.sockets;
          for (var id in sockets) {
            if (sockets.hasOwnProperty(id)) {
              if (ids[id] || ~except.indexOf(id))
                continue;
              socket = self.nsp.connected[id];
              if (socket) {
                socket.packet(encodedPackets, packetOpts);
                ids[id] = true;
              }
            }
          }
        }
      } else {
        for (var id in self.sids) {
          if (self.sids.hasOwnProperty(id)) {
            if (~except.indexOf(id))
              continue;
            socket = self.nsp.connected[id];
            if (socket)
              socket.packet(encodedPackets, packetOpts);
          }
        }
      }
    });
  };
  Adapter.prototype.clients = function(rooms, fn) {
    if ('function' == typeof rooms) {
      fn = rooms;
      rooms = null;
    }
    rooms = rooms || [];
    var ids = {};
    var self = this;
    var sids = [];
    var socket;
    if (rooms.length) {
      for (var i = 0; i < rooms.length; i++) {
        var room = self.rooms[rooms[i]];
        if (!room)
          continue;
        var sockets = room.sockets;
        for (var id in sockets) {
          if (sockets.hasOwnProperty(id)) {
            if (ids[id])
              continue;
            socket = self.nsp.connected[id];
            if (socket) {
              sids.push(id);
              ids[id] = true;
            }
          }
        }
      }
    } else {
      for (var id in self.sids) {
        if (self.sids.hasOwnProperty(id)) {
          socket = self.nsp.connected[id];
          if (socket)
            sids.push(id);
        }
      }
    }
    if (fn)
      process.nextTick(fn.bind(null, null, sids));
  };
  Adapter.prototype.clientRooms = function(id, fn) {
    var rooms = this.sids[id];
    if (fn)
      process.nextTick(fn.bind(null, null, rooms ? Object.keys(rooms) : null));
  };
  function Room() {
    if (!(this instanceof Room))
      return new Room();
    this.sockets = {};
    this.length = 0;
  }
  Room.prototype.add = function(id) {
    if (!this.sockets.hasOwnProperty(id)) {
      this.sockets[id] = true;
      this.length++;
    }
  };
  Room.prototype.del = function(id) {
    if (this.sockets.hasOwnProperty(id)) {
      delete this.sockets[id];
      this.length--;
    }
  };
})(require('process'));
