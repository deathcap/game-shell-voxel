'use strict';

// sample blocks for demo.js TODO: move to voxel-land as a proper plugin, refactor with lib/examples.js terrain gen

module.exports = function(game, opts) {
  return new BlocksPlugin(game, opts);
};

function BlocksPlugin(game, opts) {
  var registry = game.plugins.get('voxel-registry');

  registry.registerBlock('dirt', {texture: 'dirt'})
  registry.registerBlock('stone', {texture: 'stone'})
  registry.registerBlock('cobblestone', {texture: 'cobblestone'})
  registry.registerBlock('lava', {texture: 'lava_still'})
  registry.registerBlock('oreDiamond', {texture: 'diamond_ore'})
  registry.registerBlock('grass', {texture: ['grass_top', 'dirt', 'grass_side']})
}

