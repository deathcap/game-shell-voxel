"use strict"

var createShell = require("gl-now")
var createCamera = require("game-shell-fps-camera")
var createTileMap = require("gl-tile-map")
var ndarray = require("ndarray")
var createWireShader = require("./lib/wireShader.js")
var createAOShader = require("ao-shader")
var examples = require("./lib/examples.js")
var createVoxelMesh = require("./lib/createMesh.js")
var glm = require("gl-matrix")
var mat4 = glm.mat4

var createPlugins = require('voxel-plugins')

//Tile size parameters
var TILE_SIZE = 16  // TODO: heterogenous

var main = function(opts) {
  opts = opts || {};
  opts.clearColor = [0,0,0,0];
  opts.pointerLock = true;

  var shell = createShell(opts);
  var camera = createCamera(shell);
  /* 
  global.shell = shell
  global.camera = camera
  */

  camera.position[0] = -20;
  camera.position[1] = -33;
  camera.position[2] = -40;

  var game = {};
  game.isClient = true;
  game.buttons = {};
  game.buttons.bindings = shell.bindings;

  var plugins = createPlugins(game, {require: opts.require || require});
  shell.plugins = plugins;

  for (var name in opts.pluginOpts) {
    plugins.add(name, opts.pluginOpts[name]);
  }
  plugins.loadAll();

//Config variables
var texture, shader, mesh, wireShader

shell.on("gl-init", function() {
  var gl = shell.gl

  //Create shaders
  shader = createAOShader(gl)
  wireShader = createWireShader(gl)
  
  //Create texture atlas
  var stitcher = shell.plugins.get('voxel-stitch') // TODO: load not as a plugin?
  var updateTexture = function() {
    texture = createTileMap(gl, stitcher.atlas, 2)
    texture.magFilter = gl.NEAREST
    texture.minFilter = gl.LINEAR_MIPMAP_LINEAR
    texture.mipSamples = 4
  }
  stitcher.on('addedAll', updateTexture)
  stitcher.stitch()

  mesh = createVoxelMesh(shell.gl, 'Terrain', examples.Terrain, stitcher.voxelSideTextureIDs)
  var c = mesh.center
  camera.lookAt([c[0]+mesh.radius*2, c[1], c[2]], c, [0,1,0])

  shell.bind('wireframe', 'F')
})

shell.on("gl-error", function(err) {
  var a = document.createElement('a')
  a.textContent = 'You need a modern WebGL browser (Chrome/Firefox) to play this game. Click here for more information. (WebGL error: ' + err + ')'
  a.style.webkitUserSelect = ''
  a.href = 'http://get.webgl.org/';

  while(document.body.firstChild) document.body.removeChild(document.body.firstChild)

  document.body.appendChild(a)
})

shell.on("gl-render", function(t) {
  var gl = shell.gl
 
  //Calculation projection matrix
  var projection = mat4.perspective(new Float32Array(16), Math.PI/4.0, shell.width/shell.height, 1.0, 1000.0)
  var model = mat4.identity(new Float32Array(16))
  var view = camera.view()
  
  gl.enable(gl.CULL_FACE)
  gl.enable(gl.DEPTH_TEST)

  //Bind the shader
  shader.bind()
  shader.attributes.attrib0.location = 0
  shader.attributes.attrib1.location = 1
  shader.uniforms.projection = projection
  shader.uniforms.view = view
  shader.uniforms.model = model
  shader.uniforms.tileSize = TILE_SIZE
  if (texture) shader.uniforms.tileMap = texture.bind() // texture might not have loaded yet
  
  mesh.triangleVAO.bind()
  gl.drawArrays(gl.TRIANGLES, 0, mesh.triangleVertexCount)
  mesh.triangleVAO.unbind()

  if(shell.wasDown('wireframe')) {
    //Bind the wire shader
    wireShader.bind()
    wireShader.attributes.position.location = 0
    wireShader.uniforms.projection = projection
    wireShader.uniforms.model = model
    wireShader.uniforms.view = view
    
    mesh.wireVAO.bind()
    gl.drawArrays(gl.LINES, 0, mesh.wireVertexCount)
    mesh.wireVAO.unbind()
  }
})
}

module.exports = main

