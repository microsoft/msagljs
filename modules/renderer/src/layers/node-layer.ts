import {CompositeLayer} from '@deck.gl/core'
import {TextLayer, PathLayer, PathLayerProps, TextLayerProps, PolygonLayer} from '@deck.gl/layers'
import {interpolateICurve, GeomNode, GeomGraph, Point} from 'msagl-js'
import {DrawingNode, DrawingObject} from 'msagl-js/drawing'

type NodeLayerProps = PathLayerProps<GeomNode> & TextLayerProps<GeomNode>

export default class NodeLayer extends CompositeLayer<GeomNode, NodeLayerProps> {
  static defaultProps = {
    ...PathLayer.defaultProps,
    ...TextLayer.defaultProps,
  }

  props: NodeLayerProps

  renderLayers() {
    const {updateTriggers = {}} = this.props

    return [
      new PolygonLayer<GeomNode>(
        this.props,
        // @ts-ignore
        this.getSubLayerProps({
          id: 'boundary',
          updateTriggers: {
            getPath: updateTriggers.getPath,
            getWidth: updateTriggers.getWidth,
            getColor: updateTriggers.getColor,
          },
          widthUnits: 'pixels',
        }),
        {
          getPolygon: (e: GeomNode) => Array.from(interpolateICurve(e.boundaryCurve, 0.1)).map((p: Point) => [p.x, p.y]),
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
          // @ts-ignore
          sizeUnits: 'common',
        },
      ),
    ]
  }
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
  return [0, 0, 0, 0]
}
