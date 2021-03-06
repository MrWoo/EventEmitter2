/*!
 * EventEmitter2
 * https://github.com/hij1nx/EventEmitter2
 *
 * Copyright (c) 2013 hij1nx
 * Licensed under the MIT license.
 */
; !function (undefined) {

  var isArray = Array.isArray ? Array.isArray : function _isArray(obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
  };
  var defaultMaxListeners = 10;

  function init() {
    this._events = {};
    if (this._conf) {
      configure.call(this, this._conf);
    }
  }

  function configure(conf) {
    if (conf) {

      this._conf = conf;

      conf.delimiter && (this.delimiter = conf.delimiter);
      conf.maxListeners && (this._events.maxListeners = conf.maxListeners);
      conf.wildcard && (this.wildcard = conf.wildcard);
      conf.newListener && (this.newListener = conf.newListener);

      if (this.wildcard) {
        this.listenerTree = {};
      }
    }
  }

  function EventEmitter(conf) {
    this._events = {};
    this.newListener = false;
    configure.call(this, conf);
  }

  //
  // Attention, function return type now is array, always !
  // It has zero elements if no any matches found and one or more
  // elements (leafs) if there are matches
  //
  function searchListenerTree(handlers, type, tree, i) {
    if (!tree) {
      return [];
    }
    var listeners = [], leaf, len, branch, xTree, xxTree, isolatedBranch, endReached,
      typeLength = type.length, currentType = type[i], nextType = type[i + 1];
    if (i === typeLength && tree._listeners) {
      //
      // If at the end of the event(s) list and the tree has listeners
      // invoke those listeners.
      //
      if (typeof tree._listeners.fn === 'function') {
        handlers && handlers.push(tree._listeners);
        return [tree];
      } else {
        for (leaf = 0, len = tree._listeners.length; leaf < len; leaf++) {
          handlers && handlers.push(tree._listeners[leaf]);
        }
        return [tree];
      }
    }

    if ((currentType === '*' || currentType === '**') || tree[currentType]) {
      //
      // If the event emitted is '*' at this part
      // or there is a concrete match at this patch
      //
      if (currentType === '*') {
        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i + 1));
          }
        }
        return listeners;
      } else if (currentType === '**') {
        endReached = (i + 1 === typeLength || (i + 2 === typeLength && nextType === '*'));
        if (endReached && tree._listeners) {
          // The next element has a _listeners, add it to the handlers.
          listeners = listeners.concat(searchListenerTree(handlers, type, tree, typeLength));
        }

        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            if (branch === '*' || branch === '**') {
              if (tree[branch]._listeners && !endReached) {
                listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], typeLength));
              }
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            } else if (branch === nextType) {
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i + 2));
            } else {
              // No match on this one, shift into the tree but not in the type array.
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            }
          }
        }
        return listeners;
      }

      listeners = listeners.concat(searchListenerTree(handlers, type, tree[currentType], i + 1));
    }

    xTree = tree['*'];
    if (xTree) {
      //
      // If the listener tree will allow any match for this part,
      // then recursively explore all branches of the tree
      //
      searchListenerTree(handlers, type, xTree, i + 1);
    }

    xxTree = tree['**'];
    if (xxTree) {
      if (i < typeLength) {
        if (xxTree._listeners) {
          // If we have a listener on a '**', it will catch all, so add its handler.
          searchListenerTree(handlers, type, xxTree, typeLength);
        }

        // Build arrays of matching next branches and others.
        for (branch in xxTree) {
          if (branch !== '_listeners' && xxTree.hasOwnProperty(branch)) {
            if (branch === nextType) {
              // We know the next element will match, so jump twice.
              searchListenerTree(handlers, type, xxTree[branch], i + 2);
            } else if (branch === currentType) {
              // Current node matches, move into the tree.
              searchListenerTree(handlers, type, xxTree[branch], i + 1);
            } else {
              isolatedBranch = {};
              isolatedBranch[branch] = xxTree[branch];
              searchListenerTree(handlers, type, { '**': isolatedBranch }, i + 1);
            }
          }
        }
      } else if (xxTree._listeners) {
        // We have reached the end and still on a '**'
        searchListenerTree(handlers, type, xxTree, typeLength);
      } else if (xxTree['*'] && xxTree['*']._listeners) {
        searchListenerTree(handlers, type, xxTree['*'], typeLength);
      }
    }

    return listeners;
  }

  function growListenerTree(type, listener, context) {

    type = typeof type === 'string' ? type.split(this.delimiter) : type.slice();

    //
    // Looks for two consecutive '**', if so, don't add the event at all.
    //
    for (var i = 0, len = type.length; i + 1 < len; i++) {
      if (type[i] === '**' && type[i + 1] === '**') {
        return;
      }
    }

    var tree = this.listenerTree;
    var name = type.shift();

    while (name) {

      if (!tree[name]) {
        tree[name] = {};
      }

      tree = tree[name];

      if (type.length === 0) {

        if (!tree._listeners) {
          tree._listeners = { fn: listener, context: context };
        }
        else if (typeof tree._listeners.fn === 'function') {
          tree._listeners = [tree._listeners, { fn: listener, context: context }];
        }
        else if (isArray(tree._listeners)) {

          tree._listeners.push({ fn: listener, context: context });

          if (!tree._listeners.warned) {

            var m = defaultMaxListeners;

            if (typeof this._events.maxListeners !== 'undefined') {
              m = this._events.maxListeners;
            }

            if (m > 0 && tree._listeners.length > m) {

              tree._listeners.warned = true;
              console.error('(node) warning: possible EventEmitter memory ' +
                'leak detected. %d listeners added. ' +
                'Use emitter.setMaxListeners() to increase limit.',
                tree._listeners.length);
              if (console.trace) {
                console.trace();
              }
            }
          }
        }
        return true;
      }
      name = type.shift();
    }
    return true;
  }

  // By default EventEmitters will print a warning if more than
  // 10 listeners are added to it. This is a useful default which
  // helps finding memory leaks.
  //
  // Obviously not all Emitters should be limited to 10. This function allows
  // that to be increased. Set to zero for unlimited.

  EventEmitter.prototype.delimiter = '.';

  EventEmitter.prototype.setMaxListeners = function (n) {
    this._events || init.call(this);
    this._events.maxListeners = n;
    if (!this._conf) this._conf = {};
    this._conf.maxListeners = n;
  };

  EventEmitter.prototype.event = '';

  EventEmitter.prototype.once = function (event, fn, context) {
    this.many(event, 1, fn, context);
    return this;
  };

  EventEmitter.prototype.many = function (event, ttl, fn, context) {
    var self = this;

    if (typeof fn !== 'function') {
      throw new Error('many only accepts instances of Function');
    }

    function listener() {
      if (--ttl === 0) {
        self.off(event, listener, context);
      }
      fn.apply(this, arguments);
    }

    listener._origin = { fn: fn, context: context };

    this.on(event, listener, context);

    return self;
  };

  EventEmitter.prototype.emit = function () {
    this._events || init.call(this);

    var type = arguments[0];
    if (this.wildcard && type.indexOf(this.delimiter + '*') === -1 && type.indexOf('*' + this.delimiter) === -1 &&
      type.indexOf(this.delimiter + '**') === -1 && type.indexOf('**' + this.delimiter) == -1) {
      type = type + '.**';
    }

    if (type === 'newListener' && !this.newListener) {
      if (!this._events.newListener) { return Promise.resolve(); }
    }

    // If there is no 'error' event listener then throw.
    if (type === 'error') {

      if (!this._all &&
        !this._events.error &&
        !(this.wildcard && this.listenerTree.error)) {

        if (arguments[1] instanceof Error) {
          throw arguments[1]; // Unhandled 'error' event
        } else {
          throw new Error("Uncaught, unspecified 'error' event.");
        }
        return Promise.resolve();
      }
    }

    var handler, context, listener, results = [], originalEvent;

    if (this.wildcard) {
      handler = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handler, ns, this.listenerTree, 0);
    }
    else {
      handler = this._events[type];
    }

    if (typeof handler.fn === 'function') {
      context = handler.context || this;
      originalEvent = context.event;
      context.event = type;
      if (arguments.length === 1) {
        results.push(handler.fn.call(context));
      }
      else if (arguments.length > 1)
        switch (arguments.length) {
          case 2:
            results.push(handler.fn.call(context, arguments[1]));
            break;
          case 3:
            results.push(handler.fn.call(context, arguments[1], arguments[2]));
            break;
          // slower
          default:
            var l = arguments.length;
            var args = new Array(l - 1);
            for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
            results.push(handler.fn.apply(context, args));
        }
      context.event = originalEvent;
    }
    else if (handler) {
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) args[i - 1] = arguments[i];

      var listeners = handler.slice();
      for (var i = 0, l = listeners.length; i < l; i++) {
        listener = listeners[i];
        context = listener.context || this;
        originalEvent = context.event;
        context.event = type;
        results.push(listeners[i].fn.apply(context, args));
        context.event = originalEvent;
      }
    }
    
    // Loop through the *_all* functions and invoke them.
    if (this._all) {
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
      for (i = 0, l = this._all.length; i < l; i++) {
        listener = this._all[i];
        context = listener.context || this;
        originalEvent = context.event;
        context.event = type;
        results.push(listener.fn.apply(context, args));
        context.event = originalEvent;
      }
    }
    return results.length ? Promise.all(results) : Promise.resolve();
  };
  
  EventEmitter.prototype.trigger = EventEmitter.prototype.emit;

  EventEmitter.prototype.on = function (type, listener, context) {

    if (typeof type === 'function') {
      this.onAny(type, context || listener);
      return this;
    }

    if (typeof listener !== 'function') {
      throw new Error('on only accepts instances of Function');
    }
    this._events || init.call(this);

    // To avoid recursion in the case that type == "newListeners"! Before
    // adding it to the listeners, first emit "newListeners".
    this.emit('newListener', type, listener, context);

    if (this.wildcard) {
      growListenerTree.call(this, type, listener, context);
      return this;
    }

    if (!this._events[type]) {
      // Optimize the case of one listener. Don't need the extra array object.
      this._events[type] = { fn: listener, context: context };
    }
    else if (typeof this._events[type].fn === 'function') {
      // Adding the second element, need to change to array.
      this._events[type] = [this._events[type], { fn: listener, context: context }];
    }
    else if (isArray(this._events[type])) {
      // If we've already got an array, just append.
      this._events[type].push({ fn: listener, context: context });

      // Check for listener leak
      if (!this._events[type].warned) {

        var m = defaultMaxListeners;

        if (typeof this._events.maxListeners !== 'undefined') {
          m = this._events.maxListeners;
        }

        if (m > 0 && this._events[type].length > m) {

          this._events[type].warned = true;
          console.error('(node) warning: possible EventEmitter memory ' +
            'leak detected. %d listeners added. ' +
            'Use emitter.setMaxListeners() to increase limit.',
            this._events[type].length);
          if (console.trace) {
            console.trace();
          }
        }
      }
    }
    return this;
  };

  EventEmitter.prototype.onAny = function (fn, context) {

    if (typeof fn !== 'function') {
      throw new Error('onAny only accepts instances of Function');
    }

    if (!this._all) {
      this._all = [];
    }

    // Add the function to the event listener collection.
    this._all.push({ fn: fn, context: context });
    return this;
  };

  EventEmitter.prototype.addListener = EventEmitter.prototype.on;

  EventEmitter.prototype.off = function (type, listener, context) {
    if (typeof listener !== 'function') {
      return this.removeAllListeners(type);
    }

    var handlers, leafs = [];

    if (this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);
    }
    else {
      // does not use listeners(), so no side effect of creating _events[type]
      if (!this._events[type]) return this;
      handlers = this._events[type];
      leafs.push({ _listeners: handlers });
    }

    for (var iLeaf = 0; iLeaf < leafs.length; iLeaf++) {
      var leaf = leafs[iLeaf];
      handlers = leaf._listeners;
      if (isArray(handlers)) {

        for (var i = 0, length = handlers.length; i < length; i++) {
          if ((handlers[i].fn === listener ||
            (handlers[i].listener && handlers[i].listener.fn === listener) ||
            (handlers[i]._origin && handlers[i]._origin.fn === listener)) &&
            (!context || (handlers[i].context === context ||
              (handlers[i].listener && handlers[i].listener.context === context) ||
              (handlers[i]._origin && handlers[i]._origin.context === context)))) {
            if (this.wildcard) {
              leaf._listeners.splice(i, 1);
            }
            else {
              this._events[type].splice(i, 1);
            }
          }
        }

        if (handlers.length === 0) {
          if (this.wildcard) {
            delete leaf._listeners;
          }
          else {
            delete this._events[type];
          }
        }
      }
      else if ((handlers.fn === listener ||
        (handlers.listener && handlers.listener.fn === listener) ||
        (handlers._origin && handlers._origin.fn === listener)) &&
        (!context || (handlers.context === context ||
          (handlers.listener && handlers.listener.context === context) ||
          (handlers._origin && handlers._origin.context === context)))
        ) {
        if (this.wildcard) {
          delete leaf._listeners;
        }
        else {
          delete this._events[type];
        }
      }
    }

    function recursivelyGarbageCollect(root) {
      if (root === undefined) {
        return;
      }
      var keys = Object.keys(root);
      for (var i in keys) {
        var key = keys[i];
        var obj = root[key];
        if ((obj.fn instanceof Function) || (typeof obj !== "object"))
          continue;
        if (Object.keys(obj).length > 0) {
          recursivelyGarbageCollect(root[key]);
        }
        if (Object.keys(obj).length === 0) {
          delete root[key];
        }
      }
    }
    recursivelyGarbageCollect(this.listenerTree);
    return this;
  };

  EventEmitter.prototype.offAny = function (fn, context) {
    var i = 0, l = 0, fns;
    if (fn && this._all && this._all.length > 0) {
      fns = this._all;
      for (i = 0, l = fns.length; i < l; i++) {
        if (fn === fns[i].fn && (!context || context === fns[i].context)) {
          fns.splice(i, 1);
          return this;
        }
      }
    } else {
      this._all = [];
    }
    return this;
  };

  EventEmitter.prototype.removeListener = EventEmitter.prototype.off;

  EventEmitter.prototype.removeAllListeners = function (type) {
    if (arguments.length === 0) {
      !this._events || init.call(this);
      return this;
    }

    if (this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      var leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);

      for (var iLeaf = 0; iLeaf < leafs.length; iLeaf++) {
        var leaf = leafs[iLeaf];
        leaf._listeners = null;
      }
    }
    else {
      if (!this._events || !this._events[type]) return this;
      this._events[type] = null;
    }
    return this;
  };

  EventEmitter.prototype.listeners = function (type) {
    if (this.wildcard) {
      var handlers = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handlers, ns, this.listenerTree, 0);
      return handlers;
    }

    this._events || init.call(this);

    if (!this._events[type]) this._events[type] = [];
    if (!isArray(this._events[type])) {
      this._events[type] = [this._events[type]];
    }
    return this._events[type];
  };

  EventEmitter.prototype.listenersAny = function () {

    if (this._all) {
      return this._all;
    }
    else {
      return [];
    }

  };

  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(function () {
      return EventEmitter;
    });
  } else if (typeof exports === 'object') {
    // CommonJS
    exports.EventEmitter2 = EventEmitter;
  }
  else {
    // Browser global.
    window.EventEmitter2 = EventEmitter;
  }
} ();
