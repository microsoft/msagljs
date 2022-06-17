import {CompositeLayer, LayersList, Accessor} from '@deck.gl/core/typed'
import {Buffer} from '@luma.gl/webgl'
import {TextLayer, TextLayerProps} from '@deck.gl/layers/typed'
import {GeomNode, GeomGraph, Node} from 'msagl-js'
import {DrawingNode, DrawingObject, ShapeEnum} from 'msagl-js/drawing'

import GeometryLayer, {GeometryLayerProps, SHAPE} from './geometry-layer'
import {getLabelPosition} from '../utils'

type NodeLayerProps = GeometryLayerProps<GeomNode> &
  TextLayerProps<GeomNode> & {
    getDepth?: Buffer
    getTextSize: Accessor<GeomNode, number>
  }

export default class NodeLayer extends CompositeLayer<NodeLayerProps> {
  static defaultProps = {
    ...TextLayer.defaultProps,
    ...GeometryLayer.defaultProps,
    getTextSize: {type: 'accessor', value: 16},
  }

  renderLayers(): LayersList {
    return [
      new GeometryLayer<GeomNode>(
        this.props,
        this.getSubLayerProps({
          id: 'boundary',
          lineWidthUnits: 'pixels',
        }),
        {
          getPosition: (e: GeomNode) => [e.boundingBox.center.x, e.boundingBox.center.y],
          getSize: (e: GeomNode) => [e.boundingBox.width, e.boundingBox.height],
          getShape: (e: GeomNode) => getShapeFromNode(e.node),
          cornerRadius: getCornerRadius(this.props.data[0]),
          getLineColor: getNodeColor,
          getFillColor: getNodeFillColor,
        },
      ),

      new TextLayer<GeomNode>(
        this.props,
        this.getSubLayerProps({
          id: 'label',
        }),
        {
          dataTransform: (data: GeomNode[]) => data.filter((n) => !(n instanceof GeomGraph) || (<GeomGraph>n).labelSize),
          getPosition: (n: GeomNode) => getLabelPosition(n),
          getText: (n: GeomNode) => (<DrawingNode>DrawingNode.getDrawingObj(n.node)).labelText,
          getColor: getNodeColor,
          getSize: this.props.getTextSize,
          sizeMaxPixels: 48,
          sizeUnits: 'common',
          characterSet: 'auto',
        },
      ),
    ]
  }
}

function getCornerRadius(n: GeomNode): number {
  if (!n) return 0
  const dn = <DrawingNode>DrawingNode.getDrawingObj(n.node)
  return dn.xRad
}

function getNodeColor(e: GeomNode): [number, number, number, number] {
  const drawingNode = <DrawingNode>DrawingObject.getDrawingObj(e.node)
  if (drawingNode) {
    const color = drawingNode.color
    if (color) return [color.R, color.G, color.B, color.A]
  }
  return [0, 0, 0, 255]
}
function getNodeFillColor(e: GeomNode): [number, number, number, number] {
  const drawingNode = <DrawingNode>DrawingObject.getDrawingObj(e.node)
  if (drawingNode) {
    const color = drawingNode.fillColor
    if (color) return [color.R, color.G, color.B, color.A]
  }
  return [255, 255, 255, 255]
}
/** 
the explanations of the shapes can be seen at
https://graphviz.org/doc/info/shapes.html#polygon
*/
function getShapeFromNode(node: Node): SHAPE {
  const drawingNode = DrawingObject.getDrawingObj(node) as DrawingNode
  if (drawingNode == null) {
    return SHAPE.Rectangle
  }
  switch (drawingNode.shape) {
    case ShapeEnum.diamond:
      return SHAPE.Diamond

    case ShapeEnum.ellipse:
      return SHAPE.Oval

    case ShapeEnum.box:
      return SHAPE.Rectangle

    case ShapeEnum.circle:
      return SHAPE.Oval

    case ShapeEnum.record:
      return SHAPE.Rectangle

    case ShapeEnum.plaintext:
      //here nothing is rendered except of the label
      return SHAPE.Oval

    case ShapeEnum.point:
      // draw a tiny circle
      return SHAPE.Oval

    case ShapeEnum.doublecircle:
      return SHAPE.Oval

    case ShapeEnum.octagon:
      return SHAPE.Oval

    case ShapeEnum.drawFromGeometry:
      // use the exact geometry of GeomNode.boundaryCurve
      return SHAPE.Rectangle

    case ShapeEnum.house:
      return SHAPE.Rectangle
    case ShapeEnum.invhouse:
      return SHAPE.Rectangle
    default:
      return SHAPE.Rectangle
  }
}
