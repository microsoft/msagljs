import {CompositeLayer} from '@deck.gl/core'
import {Buffer} from '@luma.gl/webgl'
import {TextLayer, PathLayer, PathLayerProps, TextLayerProps, PolygonLayer} from '@deck.gl/layers'
import {interpolateICurve, GeomNode, GeomGraph, Point} from 'msagl-js'
import {DrawingNode, DrawingObject} from 'msagl-js/drawing'

import GeometryLayer, {GeometryLayerProps, SHAPE} from './geometry-layer'

type NodeLayerProps = GeometryLayerProps<GeomNode> &
  TextLayerProps<GeomNode> & {
    getDepth: Buffer
    getTextSize: TextLayerProps<GeomNode>['getSize']
  }

export default class NodeLayer extends CompositeLayer<GeomNode, NodeLayerProps> {
  static defaultProps = {
    ...TextLayer.defaultProps,
    ...GeometryLayer.defaultProps,
    getDepth: null,
    getTextSize: {type: 'accessor', value: 16},
  }

  props: NodeLayerProps

  renderLayers() {
    const {updateTriggers = {}} = this.props

    return [
      new GeometryLayer<GeomNode>(
        // @ts-ignore
        this.props,
        // @ts-ignore
        this.getSubLayerProps({
          id: 'boundary',
          updateTriggers: {
            getPosition: updateTriggers.getPosition,
            getSize: updateTriggers.getSize,
            getFillColor: updateTriggers.getColor,
            getLineColor: updateTriggers.getColor,
          },
          lineWidthUnits: 'pixels',
        }),
        // @ts-ignore
        {
          getPosition: (e: GeomNode) => [e.boundingBox.center.x, e.boundingBox.center.y],
          getSize: (e: GeomNode) => [e.boundingBox.width, e.boundingBox.height],
          getShape: SHAPE.Rectangle,
          // @ts-ignore
          cornerRadius: getCornerRadius(this.props.data[0]),
          getLineColor: getNodeColor,
          getFillColor: getNodeFillColor,
        },
      ),

      new TextLayer<GeomNode>(
        this.props,
        // @ts-ignore
        this.getSubLayerProps({
          id: 'label',
          updateTriggers: {
            getText: updateTriggers.getText,
            getSize: updateTriggers.getSize,
            getWidth: updateTriggers.getWidth,
            getColor: updateTriggers.getColor,
          },
        }),
        {
          // @ts-ignore
          dataTransform: (data: GeomNode[]) => data.filter((n) => !(n instanceof GeomGraph) || (<GeomGraph>n).labelSize),
          getPosition: (n: GeomNode) => getLabelPosition(n),
          getText: (n: GeomNode) => (<DrawingNode>DrawingNode.getDrawingObj(n.node)).labelText,
          getColor: getNodeColor,
          getSize: this.props.getTextSize,
          sizeMaxPixels: 48,
          // @ts-ignore
          sizeUnits: 'common',
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

function getLabelPosition(n: GeomNode): [number, number] {
  if (n instanceof GeomGraph) {
    const box = n.boundingBox
    return [box.center.x, box.bottom + (<GeomGraph>n).labelSize.height / 2 + 2]
  }
  return [n.center.x, n.center.y]
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
