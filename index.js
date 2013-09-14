"use strict";

var fs                          = require('fs'),
    path                        = require('path'),
    rng                         = require('crypto').rng,
    q                           = require('kew'),
    through                     = require('through'),
    nodeResolve                 = require('resolve'),
    browserResolve              = require('browser-resolve'),
    aggregate                   = require('stream-aggregate-promise'),
    asStream                    = require('as-stream'),
    utils                       = require('lodash'),
    depsTransform               = require('./transforms/deps'),
    jsonTransform               = require('./transforms/json')

module.exports = function(mains, opts) {
  return new Graph(mains, opts).toStream()
}

module.exports.Graph = Graph

function Graph(mains, opts) {
  var self = this

  self.opts = opts || {}
  self.output = through()
  self.basedir = self.opts.basedir || process.cwd()
  self.resolveImpl = resolveWith.bind(null, self.opts.resolve || browserResolve)
  self.resolved = {}
  self.seen = {}
  self.entries = [].concat(mains).filter(Boolean).map(function(m) {
    var mod = {entry: true}
    if (typeof m.pipe === 'function') {
      mod.id = path.join(self.basedir, rng(8).toString('hex') + '.js')
      mod.sourcePromise = aggregate(m)
    } else {
      mod.id = path.resolve(m)
    }
    return mod
  })
}

Graph.prototype = {

  resolve: function(id, parent) {
    var self = this
    if (self.opts.filter && !self.opts.filter(id)) {
      return q.resolve({id: false})
    } else {
      var relativeTo = {
        packageFilter: self.opts.packageFilter,
        extensions: self.opts.extensions,
        modules: self.opts.modules,
        paths: [],
        filename: parent.id,
        package: parent.package
      }
      return self.resolveImpl(id, relativeTo)
        .then(function(mod) {
          self.resolved[mod.id] = mod
          return mod
        })
        .fail(function(err) {
          err.message += [', module required from', parent.id].join(' ')
          throw err
        })
    }
  },

  resolveDeps: function(ids, parent) {
    var self = this
    var result = {},
        resolutions = q.all(ids.map(function(id) {
          return self.resolve(id, parent).then(function(r) {result[id] = r.id})
        }))
    return resolutions.then(function() { return result })
  },

  toStream: function() {
    var self = this
    q.all(self.entries.map(function(mod) {return self.walk(mod, {id: '/'})}))
      .fail(self.output.emit.bind(self.output, 'error'))
      .fin(self.output.queue.bind(self.output, null))
    return self.output
  },

  toPromise: function() {
    return aggregate(this.toStream()).then(function(nodes) {
      var graph = {}
      nodes.forEach(function(mod) { graph[mod.id] = mod })
      return graph
    })
  },

  walk: function(mod, parent) {
    var self = this
    if (utils.isString(mod)) mod = self.resolved[mod]
    if (self.seen[mod.id]) return
    self.seen[mod.id] = true

    var cached = self.checkCache(mod, parent)
    if (cached) {
      self.emit(cached)
      return self.walkDeps(cached, parent)
    }

    return self.applyTransforms(mod)
      .then(self.emit.bind(self))
      .then(self.walkDeps.bind(self))
  },

  walkDeps: function(mod) {
    var self = this
    return q.all(Object.keys(mod.deps)
      .filter(function(id) { return mod.deps[id] })
      .map(function(id) { return self.walk(mod.deps[id], mod) }))
  },

  emit: function(mod) {
    var self = this,
        result = utils.clone(mod)

    delete result.package
    delete result.sourcePromise

    if (!result.deps)
      result.deps = {}
    if (Buffer.isBuffer(result.source))
      result.source = result.source.toString()

    self.output.queue(result)
    return mod
  },

  checkCache: function(mod, parent) {
    var self = this
    if (!(self.opts.cache && self.opts.cache[parent.id])) return
    var id = self.opts.cache[parent.id].deps[mod.id]
    return self.opts.cache[id]
  },

  readSource: function(mod) {
    if (mod.source) return q.resolve(mod)
    var promise = mod.sourcePromise || aggregate(fs.createReadStream(mod.id))
    return promise.then(function(source) {
      mod.source = source
      return mod
    })
  },

  applyTransforms: function(mod) {
    var self = this,
        transforms = [],
        isTopLevel = self.entries.some(function (entry) {
      return path.relative(path.dirname(entry.id), mod.id)
        .split('/').indexOf('node_modules') < 0
    })

    if (isTopLevel)
      transforms = transforms.concat(self.opts.transform)

    if (mod.package && self.opts.transformKey)
      transforms = transforms.concat(self.getPackageTransform(mod.package))

    transforms = transforms
      .filter(Boolean)
      .map(loadTransform.bind(null, mod))
      .concat(depsTransform, jsonTransform)

    mod = self.readSource(mod)
    return q.all(transforms).then(function(transforms) {
      transforms.forEach(function(t) {
        mod = mod.then(function(mod) {
          return (t.length === 1) ?
            runStreamingTransform(t, mod) : runTransform(t, mod, self)
        })
      })
      return mod
    })
  },

  getPackageTransform: function(pkg) {
    this.opts.transformKey.forEach(function (k) {
      if (pkg && typeof pkg === 'object') pkg = pkg[k]
    })
    return [].concat(pkg).filter(Boolean)
  }
}

function mergeInto(target, source) {
  if (!source) return target
  var result = utils.assign({}, target)
  for (var k in source) {
    var t = result[k], s = source[k]
    if (utils.isArray(t) && utils.isArray(s))
      result[k] = t.concat(s)
    else if (utils.isObject(t) && utils.isObject(s))
      result[k] = mergeInto(t, s)
    else
      result[k] = s
  }
  return result
}

function resolveWith(resolve, id, parent) {
  var p = q.defer()
  resolve(id, parent, function(err, filename, pkg) {
    if (err)
      p.reject(err)
    else
      p.resolve({id: filename, package: pkg})
  })
  return p
}

function runStreamingTransform(transform, mod) {
  return aggregate(asStream(mod.source).pipe(transform(mod.id)))
    .then(function(source) {
      mod.source = source
      return mod
    })
}

function runTransform(transform, mod, graph) {
  return q.resolve(transform(mod, graph)).then(mergeInto.bind(null, mod))
}

var transformResolve = resolveWith.bind(null, nodeResolve)

function loadTransform(mod, transform) {
  if (!utils.isString(transform)) return q.resolve(transform)

  return transformResolve(transform, {basedir: path.dirname(mod.id)})
    .fail(function() {
      return transformResolve(transform, {basedir: process.cwd()})
    })
    .then(function(res) {
      if (!res)
        throw new Error([
          'cannot find transform module ', transform,
          ' while transforming ', mod.id
        ].join(''))
      return require(res.id)
    })
    .fail(function(err) {
      err.message += ' which is required as a transform'
      throw err
    })
}
