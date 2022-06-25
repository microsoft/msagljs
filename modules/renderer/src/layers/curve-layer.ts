import {
  Layer,
  project32,
  Accessor,
  Color,
  UNIT,
  Unit,
  LayerProps,
  UpdateParameters,
  DefaultProps,
  createIterable,
  LayerContext,
} from '@deck.gl/core/typed'
import GL from '@luma.gl/constants'
import {Model, Geometry} from '@luma.gl/engine'
import {Buffer} from '@luma.gl/webgl'
import {picking} from '@luma.gl/shadertools'

const MAX_DRAW_COUNT = 16

export enum CURVE {
  Line = 0,
  Bezier = 1,
  Arc = 2,
}

export type CurveLayerProps<DataT> = {
  getDepth?: Buffer

  widthUnits?: Unit
  widthScale?: number
  widthMinPixels?: number
  widthMaxPixels?: number

  getCurveType?: Accessor<DataT, CURVE>
  getResolution?: Accessor<DataT, number>
  getControlPoints?: Accessor<DataT, number[]>
  getWidth?: Accessor<DataT, number>
  getColor?: Accessor<DataT, Color>
} & LayerProps<DataT>

const defaultProps: DefaultProps<CurveLayerProps<any>> = {
  widthUnits: 'common',
  widthScale: {type: 'number', min: 0, value: 1},
  widthMinPixels: {type: 'number', min: 0, value: 0},
  widthMaxPixels: {type: 'number', min: 0, value: Number.MAX_SAFE_INTEGER},

  /**
   * CURVE.Line: [startX, startY, endX, endY]
   * CURVE.Bezier: [startX, startY, ctrlPoint1X, ctrPoint1Y, ctrlPoint2X, ctrPoint2Y, endX, endY]
   * CURVE.Arc: [centerX, centerY, axis1X, axis1Y, axis2X, axis2Y, startAngle, endAngle]
   */
  getControlPoints: {type: 'accessor', value: (d) => d.points},
  getCurveType: {type: 'accessor', value: CURVE.Line},
  getResolution: {type: 'accessor', value: 4},
  getWidth: {type: 'accessor', value: 1},
  getColor: {type: 'accessor', value: [0, 0, 0, 255]},
}

const vs = `\
#define SHADER_NAME curve-layer-vertex-shader
#define LINE    0.0
#define BEZIER  1.0
#define ARC     2.0

attribute vec2 positions;
attribute vec2 instanceSegments;
attribute vec4 instancePositions1;
attribute vec4 instancePositions2;
attribute float instanceTypes;
attribute float instanceWidths;
attribute vec4 instanceColors;

uniform float opacity;
uniform float widthScale;
uniform float widthMinPixels;
uniform float widthMaxPixels;
uniform int widthUnits;

varying vec4 vColor;

void interpolateLine(float t, vec2 start, vec2 end, out vec2 point) {
  point = mix(start, end, t);
}

void interpolateBezierCurve(float t, vec2 start, vec2 c1, vec2 c2, vec2 end, out vec2 point) {
  vec2 c = (c1 - start) * 3.0;
  vec2 e = (c2 - c1) * 3.0 - c;
  vec2 l = end - start - c - e;

  float t2 = t * t;
  float t3 = t2 * t;
  
  point = l * t3 + e * t2 + c * t + start;
}

void interpolateArc(float t, vec2 center, vec2 aAxis, vec2 bAxis, float startAngle, float endAngle, out vec2 point) {
  float a = mix(startAngle, endAngle, t);
  point = center + cos(a) * aAxis + sin(a) * bAxis;
}

vec2 getExtrusionOffset(vec2 line, float offset_direction, float width) {
  // normalized direction of the line
  vec2 dir = normalize(line);
  // rotate by 90 degrees
  dir = vec2(-dir.y, dir.x);
  return dir * offset_direction * width / 2.0;
}

void main(void) {
  // Multiply out line width and clamp to limits
  float widthPixels = clamp(
    project_size_to_pixel(widthScale * instanceWidths, widthUnits),
    widthMinPixels, widthMaxPixels
  );
  float widthCommon = project_pixel_size(widthPixels);

  geometry.uv = positions.xy;

  vec2 pointOnCurve;
  vec2 nextPointOnCurve;
  vec2 pointOnCurve64Low = vec2(0.0);
  float r = (instanceSegments.x + positions.x) / instanceSegments.y;
  float rNext = r + 1.0 / instanceSegments.y;

  if (instanceTypes == BEZIER) {
    interpolateBezierCurve(r, instancePositions1.xy, instancePositions1.zw, instancePositions2.xy, instancePositions2.zw, pointOnCurve);
    interpolateBezierCurve(rNext, instancePositions1.xy, instancePositions1.zw, instancePositions2.xy, instancePositions2.zw, nextPointOnCurve);
  }
  else if (instanceTypes == ARC) {
    interpolateArc(r, instancePositions1.xy, instancePositions1.zw, instancePositions2.xy, instancePositions2.z, instancePositions2.w, pointOnCurve);
    interpolateArc(rNext, instancePositions1.xy, instancePositions1.zw, instancePositions2.xy, instancePositions2.z, instancePositions2.w, nextPointOnCurve);
  }
  else {
    interpolateLine(r, instancePositions1.xy, instancePositions1.zw, pointOnCurve);
    interpolateLine(rNext, instancePositions1.xy, instancePositions1.zw, nextPointOnCurve);
  }
  
  vec3 offset = vec3(getExtrusionOffset(
    nextPointOnCurve - pointOnCurve,
    positions.y,
    widthCommon), 0.0);

  gl_Position = project_position_to_clipspace(
    vec3(pointOnCurve, 0.0),
    vec3(pointOnCurve64Low, 0.0),
    offset,
    geometry.position);

  DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
  // Apply opacity to instance color, or return instance picking color
  vColor = vec4(instanceColors.rgb, instanceColors.a * opacity);
  DECKGL_FILTER_COLOR(vColor, geometry);
}
`

const fs = `\
#define SHADER_NAME curve-layer-fragment-shader
varying vec4 vColor;

void main(void) {
  gl_FragColor = vColor;
  DECKGL_FILTER_COLOR(gl_FragColor, geometry);
}
`

export default class CurveLayer<DataT> extends Layer<Required<CurveLayerProps<DataT>>> {
  static layerName = 'CurveLayer'
  static defaultProps = defaultProps

  state!: {
    model?: Model
    startIndices: number[]
    numInstances: number
    segments: Uint16Array
  }

  getShaders() {
    return super.getShaders({vs, fs, modules: [project32, picking]})
  }

  initializeState() {
    this.getAttributeManager().addInstanced({
      instancePositions: {
        size: 8,
        // type: GL.DOUBLE,
        // fp64: true,
        transition: true,
        accessor: 'getControlPoints',
        shaderAttributes: {
          instancePositions1: {
            size: 4,
          },
          instancePositions2: {
            size: 4,
            elementOffset: 4,
          },
        },
      },
      instanceSegments: {
        size: 2,
        type: GL.UNSIGNED_SHORT,
        update: this._getSegments,
      },
      instanceTypes: {
        size: 1,
        type: GL.UNSIGNED_BYTE,
        accessor: 'getCurveType',
      },
      instanceWidths: {
        size: 1,
        transition: true,
        accessor: 'getWidth',
        defaultValue: 1,
      },
      instanceColors: {
        size: 4,
        transition: true,
        normalized: true,
        type: GL.UNSIGNED_BYTE,
        accessor: 'getColor',
      },
    })
  }

  updateState(params: UpdateParameters<this>) {
    super.updateState(params)

    const {props, changeFlags} = params

    if (changeFlags.dataChanged) {
      this.updateGeometry()
    }

    if (changeFlags.extensionsChanged) {
      const {gl} = this.context
      this.state.model?.delete()
      this.state.model = this._getModel(gl)
      this.getAttributeManager().invalidateAll()
    }
  }

  updateGeometry() {
    const {data, getResolution, getCurveType} = this.props
    const {iterable, objectInfo} = createIterable(data)
    const startIndices = [0]
    let numInstances = 0
    const segments = []

    for (const object of iterable) {
      objectInfo.index++
      const type = typeof getCurveType === 'function' ? getCurveType(object, objectInfo) : getCurveType
      const res =
        type === CURVE.Line ? 1 : Math.ceil(typeof getResolution === 'function' ? getResolution(object, objectInfo) : getResolution)
      numInstances += res
      startIndices.push(numInstances)
      for (let i = 0; i < res; i++) {
        segments.push(i, res)
      }
    }

    this.setState({startIndices, numInstances, segments: new Uint16Array(segments)})
  }

  draw({uniforms}: any) {
    const {widthUnits, widthScale, widthMinPixels, widthMaxPixels} = this.props
    const segCountScale = Math.min(this.context.viewport.scale, MAX_DRAW_COUNT)

    this.state.model.setUniforms(uniforms).setUniforms({
      skip: Math.ceil(1 / segCountScale),
      widthUnits: UNIT[widthUnits],
      widthScale,
      widthMinPixels,
      widthMaxPixels,
    })

    const drawCount = Math.ceil(segCountScale)

    for (let i = 0; i < drawCount; i++) {
      this.state.model
        .setUniforms({
          iteration: [i, drawCount],
        })
        .draw()
    }
  }

  protected _getModel(gl: WebGLRenderingContext): Model {
    const positions = [0, -1, 1, -1, 1, 1, 0, 1]

    return new Model(gl, {
      ...this.getShaders(),
      id: this.props.id,
      geometry: new Geometry({
        drawMode: GL.TRIANGLE_FAN,
        vertexCount: 4,
        attributes: {
          positions: {size: 2, value: new Float32Array(positions)},
        },
      }),
      isInstanced: true,
    })
  }

  private _getSegments(attribute) {
    attribute.value = this.state.segments
  }
}
