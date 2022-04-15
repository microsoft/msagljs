import GL from '@luma.gl/constants'
import {Buffer, Framebuffer, Texture2D, readPixelsToArray, readPixelsToBuffer} from '@luma.gl/webgl'
import {withParameters} from '@luma.gl/gltools'
import {Model, Transform} from '@luma.gl/engine'
import {Graph, GeomGraph} from 'msagl-js'
import {DrawingEdge, DrawingObject} from 'msagl-js/drawing'

const nodeDepthModuleVs = `
uniform sampler2D nodeDepth;
uniform vec2 textureDim;

vec2 getCoordinate(vec3 nodeIdx) {
  // index = r + g * 256 + b * 65536
  // textureDim.x is always power of 2 and <= 65536
  // avoid making big integers (float32 precision)
  float x = nodeIdx.r + nodeIdx.g * 256.0;
  float y = floor(x / textureDim.x);
  x -= y * textureDim.x;
  y += 65536.0 / textureDim.x * nodeIdx.b;
  return vec2(x + 0.5, y + 0.5) / textureDim;
}

bool getDepth(vec3 nodeIdx, out float depth) {
  vec2 coord = getCoordinate(nodeIdx);
  vec4 c = texture2D(nodeDepth, coord);
  depth = c.r * 255.0;
  return c.a == 0.0;
}
`

const originData = new Uint8Array(4)

export default class GraphHighlighter {
  private _gl: WebGLRenderingContext
  private _graph: Graph
  private _nodeCount: number
  private _hasBidirectionalEdge: boolean
  private _nodeMap: Map<string, number>
  private _nodeList: string[]

  private _model: Model
  private _transform: Transform
  private _nodeDepthBuffer: Buffer
  private _nodeDepthTextures: Texture2D[]
  private _nodeDepthFB: Framebuffer
  private _edgeSourceBuffer: Buffer
  private _edgeTargetBuffer: Buffer
  private _edgeDirectionBuffer: Buffer
  private _edgeDepthBuffer: Buffer

  constructor(gl: WebGLRenderingContext) {
    this._gl = gl

    this._nodeDepthTextures = [getTexture(gl), getTexture(gl)]

    this._nodeDepthFB = new Framebuffer(gl, {
      id: 'graph-highlighter-framebuffer',
      width: this._nodeDepthTextures[0].width,
      height: 1,
      attachments: {
        [GL.COLOR_ATTACHMENT0]: this._nodeDepthTextures[0],
      },
    })

    this._model = getModel(gl)
    this._transform = getTransform(gl)
  }

  delete() {
    this._edgeSourceBuffer?.delete()
    this._edgeTargetBuffer?.delete()
    this._edgeDirectionBuffer?.delete()
    this._edgeDepthBuffer?.delete()
    this._nodeDepthTextures.forEach((t) => t.delete())
    this._nodeDepthFB.delete()
    this._nodeDepthBuffer.delete()
    this._model.delete()
    this._transform.delete()
  }

  get nodeDepthBuffer(): Buffer {
    return this._nodeDepthBuffer
  }

  get edgeDepthBuffer(): Buffer {
    return this._edgeDepthBuffer
  }

  setGraph(graph: GeomGraph) {
    if (this._graph === graph.graph) {
      return
    }

    this._graph = graph.graph
    const edgeCount = this._graph.deepEdgesCount()
    this._nodeMap = new Map<string, number>()
    this._nodeList = []
    this._hasBidirectionalEdge = false

    const gl = this._gl
    this._edgeSourceBuffer = getBuffer(gl, this._edgeSourceBuffer, {size: 3, type: GL.UNSIGNED_BYTE}, edgeCount)
    this._edgeTargetBuffer = getBuffer(gl, this._edgeTargetBuffer, {size: 3, type: GL.UNSIGNED_BYTE}, edgeCount)
    this._edgeDirectionBuffer = getBuffer(gl, this._edgeDirectionBuffer, {size: 1, type: GL.UNSIGNED_BYTE}, edgeCount)
    this._edgeDepthBuffer = getBuffer(gl, this._edgeDepthBuffer, {size: 1, type: GL.FLOAT}, edgeCount)

    let nodeIndex = 0
    let edgeIndex = 0
    for (const node of graph.deepNodes()) {
      this._nodeList[nodeIndex] = node.id
      this._nodeMap.set(node.id, nodeIndex)
      nodeIndex++
    }
    const edgeSource = new Uint8Array(edgeCount * 3)
    const edgeTarget = new Uint8Array(edgeCount * 3)
    const edgeDirection = new Uint8Array(edgeCount)
    const scratchArr = [0, 0, 0]
    for (const edge of graph.deepEdges()) {
      const sourceIdx = this._nodeMap.get(edge.source.id)
      encodePickingColor(sourceIdx, scratchArr)
      edgeSource.set(scratchArr, edgeIndex * 3)

      const targetIdx = this._nodeMap.get(edge.target.id)
      encodePickingColor(targetIdx, scratchArr)
      edgeTarget.set(scratchArr, edgeIndex * 3)

      const de = <DrawingEdge>DrawingObject.getDrawingObj(edge.edge)
      this._hasBidirectionalEdge = this._hasBidirectionalEdge || !de.directed
      edgeDirection[edgeIndex] = de.directed ? 1 : 0

      edgeIndex++
    }
    this._edgeSourceBuffer.subData(edgeSource)
    this._edgeTargetBuffer.subData(edgeTarget)
    this._edgeDirectionBuffer.subData(edgeDirection)

    this._nodeCount = this._nodeMap.size

    const textureWidth = this._nodeDepthTextures[0].width
    const textureHeight = Math.ceil(this._nodeCount / textureWidth)

    this._nodeDepthBuffer = getBuffer(gl, this._nodeDepthBuffer, {size: 4, type: GL.UNSIGNED_BYTE}, textureWidth * textureHeight)
    this._nodeDepthFB.resize({width: textureWidth, height: textureHeight})

    this._transform.update({
      elementCount: edgeCount,
      sourceBuffers: {
        source: this._edgeSourceBuffer,
        target: this._edgeTargetBuffer,
        direction: this._edgeDirectionBuffer,
      },
      feedbackBuffers: {
        nextDepth: this._edgeDepthBuffer,
      },
    })

    this._model.setAttributes({
      source: this._edgeSourceBuffer,
      target: this._edgeTargetBuffer,
      direction: this._edgeDirectionBuffer,
    })
    this._model.setVertexCount(edgeCount)

    this.update({sourceId: null})
  }

  update(opts: {sourceId: string; edgeDepth?: boolean; maxDepth?: number}) {
    const {sourceId, edgeDepth = false, maxDepth = 1} = opts
    const textureDim = [this._nodeDepthFB.width, this._nodeDepthFB.height]

    let sourceTexture: Texture2D = this._nodeDepthTextures[1]
    let targetTexture: Texture2D = this._nodeDepthTextures[0]

    if (sourceId) {
      const originPixelIdx = this._nodeMap.get(sourceId)
      this._resetNodeDepth(sourceTexture, originPixelIdx)
      this._resetNodeDepth(targetTexture, originPixelIdx)

      for (let i = 0; i < maxDepth; i++) {
        // Swap
        ;[sourceTexture, targetTexture] = [targetTexture, sourceTexture]
        this._nodeDepthFB.attach({
          [GL.COLOR_ATTACHMENT0]: targetTexture,
        })

        const uniforms = {
          nodeDepth: sourceTexture,
          textureDim,
          testForward: true,
        }
        this._updateNodeDepth(uniforms)
        if (this._hasBidirectionalEdge) {
          uniforms.testForward = false
          this._updateNodeDepth(uniforms)
        }
      }
    } else {
      this._resetNodeDepth(targetTexture)
      this._nodeDepthFB.attach({
        [GL.COLOR_ATTACHMENT0]: targetTexture,
      })
    }

    readPixelsToBuffer(this._nodeDepthFB, {target: this._nodeDepthBuffer})

    if (edgeDepth) {
      this._nodeDepthFB.attach({
        [GL.COLOR_ATTACHMENT0]: sourceTexture,
      })
      this._transform.run({
        framebuffer: this._nodeDepthFB,
        clearRenderTarget: false,
        discard: true,
        uniforms: {
          nodeDepth: targetTexture,
          textureDim,
        },
      })
    }

    /* Debug result*/
    // const result = readPixelsToArray(targetTexture)
    // for (let i = 0; i < this._nodeCount; i++) {
    //   const valid = result[i * 4 + 3] === 0;
    //   if (valid) {
    //     const depth = result[i * 4];
    //     console.log(this._nodeList[i], depth)
    //   }
    // }
    /* End of debug */
  }

  private _resetNodeDepth(texture: Texture2D, originPixelIdx?: number) {
    this._nodeDepthFB.attach({
      [GL.COLOR_ATTACHMENT0]: texture,
    })

    withParameters(
      this._gl,
      {
        framebuffer: this._nodeDepthFB,
        viewport: [0, 0, texture.width, texture.height],
        clearColor: [1, 1, 1, 1],
      },
      () => {
        this._gl.clear(GL.COLOR_BUFFER_BIT)
      },
    )

    if (originPixelIdx !== undefined) {
      texture.setSubImageData({
        data: originData,
        x: originPixelIdx % texture.width,
        y: Math.floor(originPixelIdx / texture.width),
        width: 1,
        height: 1,
      })
    }
  }

  private _updateNodeDepth(uniforms: any) {
    this._model.draw({
      framebuffer: this._nodeDepthFB,
      uniforms,
      parameters: {
        depthTest: false,
        blend: true,
        viewport: [0, 0, this._nodeDepthFB.width, this._nodeDepthFB.height],
        blendFunc: [GL.ONE, GL.ONE, GL.ONE, GL.ONE],
        blendEquation: [GL.MIN, GL.MIN],
      },
    })
  }
}

function getBuffer(gl: WebGLRenderingContext, buffer: Buffer | undefined, accessor: {size: number; type: number}, instanceCount: number) {
  if (!buffer) {
    buffer = new Buffer(gl, {
      target: gl.ARRAY_BUFFER,
      accessor,
    })
  }
  const minBufferSize = instanceCount * accessor.size * (accessor.type === GL.UNSIGNED_BYTE ? 1 : 4)
  if (buffer.byteLength < minBufferSize) {
    buffer.reallocate(minBufferSize)
  }
  return buffer
}

function getTexture(gl: WebGLRenderingContext): Texture2D {
  let textureWidth = gl.getParameter(gl.MAX_TEXTURE_SIZE)
  textureWidth = Math.min(1024, 2 ** Math.floor(Math.log2(textureWidth)))

  return new Texture2D(gl, {
    format: GL.RGBA,
    type: GL.UNSIGNED_BYTE,
    border: 0,
    mipmaps: false,
    dataFormat: GL.RGBA,
    width: textureWidth,
    height: 1,
    parameters: {
      [GL.TEXTURE_MIN_FILTER]: GL.NEAREST,
      [GL.TEXTURE_MAG_FILTER]: GL.NEAREST,
      [GL.TEXTURE_WRAP_S]: GL.CLAMP_TO_EDGE,
      [GL.TEXTURE_WRAP_T]: GL.CLAMP_TO_EDGE,
    },
  })
}

function getModel(gl: WebGLRenderingContext) {
  return new Model(gl, {
    id: 'graph-highlighter-nodes',
    vs: `
#define SHADER_NAME graph-highlighter-nodes-vertex-shader

uniform bool testForward;

attribute vec3 source;
attribute vec3 target;
attribute float direction;

varying float targetDepth;

${nodeDepthModuleVs}

void main(void) {
  vec3 sourceIdx = source;
  vec3 targetIdx = target;
  if (!testForward && direction == 0.0) {
    sourceIdx = target;
    targetIdx = source;
  }
  float sourceDepth;
  bool sourceDepthValid = getDepth(sourceIdx, sourceDepth);
  vec2 targetCoord = getCoordinate(targetIdx);

  gl_Position = vec4(targetCoord * 2.0 - 1.0, sourceDepthValid ? 0.0 : 2.0, 1.0);
  gl_PointSize = 1.0;

  targetDepth = sourceDepth + 1.0;
}
`,
    fs: `
#define SHADER_NAME graph-highlighter-nodes-fragment-shader
varying float targetDepth;

void main(void) {
  gl_FragColor = vec4(targetDepth / 255.0, 0.0, 0.0, 0.0);
}`,
    isInstanced: false,
    drawMode: GL.POINTS,
  })
}

function getTransform(gl: WebGLRenderingContext): Transform {
  return new Transform(gl, {
    vs: `
#define SHADER_NAME graph-highlighter-edges-vertex-shader

attribute vec3 source;
attribute vec3 target;
attribute float direction;

varying float nextDepth;

${nodeDepthModuleVs}

float getDepth(vec3 sourceIdx) {
  float sourceDepth;
  if (getDepth(sourceIdx, sourceDepth)) {
    return sourceDepth + 1.0;
  }
  return 255.0;
}

void main(void) {
  nextDepth = getDepth(source);
  if (direction == 0.0) {
    nextDepth = min(nextDepth, getDepth(target));
  }

  gl_Position = vec4(0.0);
}
`,
    varyings: ['nextDepth'],
  })
}

function encodePickingColor(i: number, out: number[]): number[] {
  out[0] = i & 255
  out[1] = (i >> 8) & 255
  out[2] = ((i >> 8) >> 8) & 255
  return out
}
