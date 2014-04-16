"use strict"

var createShell = require("gl-now")
var createCamera = require("game-shell-fps-camera")
var ndarray = require("ndarray")
var createTerrain = require("./lib/terrain.js") // TODO: replace with shama's chunker mentioned in https://github.com/voxel/issues/issues/4#issuecomment-39644684

var createPlugins = require('voxel-plugins')
require('voxel-registry')
require('voxel-stitch')
require('voxel-shader')
require('voxel-mesher')

var BUILTIN_PLUGIN_OPTS = {
  'voxel-registry': {},
  'voxel-stitch': {},
  'voxel-shader': {},
  'voxel-mesher': {},
};

var game = {};
global.game = game; // for debugging

var main = function(opts) {
  opts = opts || {};
  opts.clearColor = [0.75, 0.8, 0.9, 1.0]
  opts.pointerLock = true;

  var shell = createShell(opts);
  var camera = createCamera(shell);
  shell.camera = camera; // TODO: move to a plugin instead of hanging off shell instance?
  shell.meshes = []; // populated below TODO: move to voxels.meshes

  camera.position[0] = -20;
  camera.position[1] = -33;
  camera.position[2] = -40;

  game.isClient = true;
  game.shell = shell;

  // TODO: should plugin creation this be moved into gl-init?? see z-index note below

  var plugins = createPlugins(game, {require: function(name) {
    // we provide the built-in plugins ourselves; otherwise check caller's require, if any
    // TODO: allow caller to override built-ins? better way to do this?
    if (name in BUILTIN_PLUGIN_OPTS) {
      return require(name);
    } else {
      return opts.require ? opts.require(name) : require(name);
    }
  }});

  var pluginOpts = opts.pluginOpts || {}; // TODO: persist

  for (var name in BUILTIN_PLUGIN_OPTS) {
    opts.pluginOpts[name] = opts.pluginOpts[name] || BUILTIN_PLUGIN_OPTS[name];
  }

  for (var name in pluginOpts) {
    plugins.add(name, pluginOpts[name]);
  }
  plugins.loadAll();

// bit in voxel array to indicate voxel is opaque (transparent if not set)
var OPAQUE = 1<<15;

shell.on("gl-init", function() {
  var gl = shell.gl

  // since the plugins are loaded before gl-init, the <canvas> element will be
  // below other UI widgets in the DOM tree, so by default the z-order will cause
  // the canvas to cover the other widgets - to fix this, set z-index below
  shell.canvas.style.zIndex = '-1';
  shell.canvas.parentElement.style.zIndex = '-1';

  //Lookup voxel materials for terrain generation
  var registry = plugins.get('voxel-registry')
  if (registry) {
    var terrainMaterials = {};
    for (var blockName in registry.blockName2Index) {
      var blockIndex = registry.blockName2Index[blockName];
      if (registry.getProp(blockName, 'transparent')) {
        terrainMaterials[blockName] = blockIndex - 1
      } else {
        terrainMaterials[blockName] = OPAQUE|(blockIndex - 1) // TODO: separate arrays? https://github.com/mikolalysenko/ao-mesher/issues/2
      }
    }
  } else {
    console.warn('voxel-registry plugin not found, expect no textures')
  }

  // add voxels
  var mesher = plugins.get('voxel-mesher');
  if (mesher) {
    mesher.addVoxelArray(createTerrain(terrainMaterials));
  }
})

shell.on("gl-error", function(err) {
  document.body.appendChild(document.createTextNode('Fatal WebGL error: ' + err))
})

  return shell // TODO: fix indenting
}

module.exports = main

