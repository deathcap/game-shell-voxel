"use strict"

var createShell = require("gl-now")
var createCamera = require("game-shell-fps-camera")
var ndarray = require("ndarray")
var createWireShader = require("./lib/wireShader.js")
var createAOShader = require("voxel-shader")
var createTerrain = require("./lib/terrain.js") // TODO: replace with shama's chunker mentioned in https://github.com/voxel/issues/issues/4#issuecomment-39644684
var createVoxelMesh = require("./lib/createMesh.js")
var glm = require("gl-matrix")
var mat4 = glm.mat4

var createPlugins = require('voxel-plugins')

var game = {};
global.game = game; // for debugging

var main = function(opts) {
  opts = opts || {};
  opts.clearColor = [0.75, 0.8, 0.9, 1.0]
  opts.pointerLock = true;

  var shell = createShell(opts);
  var camera = createCamera(shell);

  camera.position[0] = -20;
  camera.position[1] = -33;
  camera.position[2] = -40;

  game.isClient = true;
  game.shell = shell;

  // TODO: should this be moved into gl-init?? see z-index note below
  var plugins = createPlugins(game, {require: opts.require || require});

  for (var name in opts.pluginOpts) {
    plugins.add(name, opts.pluginOpts[name]);
  }
  plugins.loadAll();

//Config variables
var texture, shader, mesh, wireShader

// bit in voxel array to indicate voxel is opaque (transparent if not set)
var OPAQUE = 1<<15;

var TILE_COUNT = null;

shell.on("gl-init", function() {
  var gl = shell.gl

  // since the plugins are loaded before gl-init, the <canvas> element will be
  // below other UI widgets in the DOM tree, so by default the z-order will cause
  // the canvas to cover the other widgets - to fix this, set z-index below
  shell.canvas.style.zIndex = '-1';
  shell.canvas.parentElement.style.zIndex = '-1';

  // TODO: is this right? see https://github.com/mikolalysenko/ao-shader/issues/2
  //gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  //gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.enable(gl.BLEND)
  // premultiply alpha when loading textures, so can use gl.ONE blending, see http://stackoverflow.com/questions/11521035/blending-with-html-background-in-webgl
  // TODO: move to gl-texture2d?
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)

  //Create shaders
  shader = createAOShader(gl)
  wireShader = createWireShader(gl)
  
  //Create texture atlas
  var stitcher = game.plugins.get('voxel-stitch') // TODO: load not as a plugin?
  TILE_COUNT = stitcher.tileCount // set for shader below (never changes)
  var updateTexture = function() {
    console.log('updateTexture() calling createGLTexture()')

    stitcher.createGLTexture(gl, function(err, tex) {
      if (err) throw new Error('stitcher createGLTexture error: ' + err)
      texture = tex
    })

    // for highBlock, clone wool texture (if shows up as dirt, wrapped around)
    for (var k = 0; k < 6; k++)
      stitcher.voxelSideTextureIDs.set(highIndex, k, stitcher.voxelSideTextureIDs.get(registry.blockName2Index.wool-1, k))

    mesh = createVoxelMesh(shell.gl, createTerrain(terrainMaterials), stitcher.voxelSideTextureIDs, stitcher.voxelSideTextureSizes)
    var c = mesh.center
    camera.lookAt([c[0]+mesh.radius*2, c[1], c[2]], c, [0,1,0])
  }
  stitcher.on('updateTexture', updateTexture)
  stitcher.stitch()

  //Lookup voxel materials for terrain generation
  var registry = plugins.get('voxel-registry')
  var terrainMaterials = {};
  for (var blockName in registry.blockName2Index) {
    var blockIndex = registry.blockName2Index[blockName];
    if (registry.getProp(blockName, 'transparent')) {
      terrainMaterials[blockName] = blockIndex - 1
    } else {
      terrainMaterials[blockName] = OPAQUE|(blockIndex - 1) // TODO: separate arrays? https://github.com/mikolalysenko/ao-mesher/issues/2
    }
  }

  // test manually assigned high block index
  // before https://github.com/mikolalysenko/ao-mesher/issues/2 max is 255, after max is 32767
  var highIndex = 32767
  terrainMaterials.highBlock = OPAQUE|highIndex

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
  shader.uniforms.tileCount = TILE_COUNT
  if (texture) shader.uniforms.tileMap = texture.bind() // texture might not have loaded yet

  if(mesh) {
    mesh.triangleVAO.bind()
    gl.drawArrays(gl.TRIANGLES, 0, mesh.triangleVertexCount)
    mesh.triangleVAO.unbind()
  }

  if(shell.wasDown('wireframe')) {
    //Bind the wire shader
    wireShader.bind()
    wireShader.attributes.position.location = 0
    wireShader.uniforms.projection = projection
    wireShader.uniforms.model = model
    wireShader.uniforms.view = view

    if(mesh) {
      mesh.wireVAO.bind()
      gl.drawArrays(gl.LINES, 0, mesh.wireVertexCount)
      mesh.wireVAO.unbind()
    }
  }
})
}

module.exports = main

