/**   the interface for the viewer for editing the graph layout, and the graph */

import {GeomEdge} from '../../layout/core'
import {EventHandler} from '../../layout/core/geomObject'
import {Point} from '../../math/geometry'
import {PlaneTransformation} from '../../math/geometry/planeTransformation'
import {Edge} from '../../structs/edge'
import {Graph} from '../../structs/graph'
import {IViewerEdge} from './iViewerEdge'
import {IViewerGraph} from './iViewerGraph'
import {IViewerNode} from './iViewerNode'
import {IViewerObject} from './iViewerObject'
import {ModifierKeysEnum} from './modifierKeys'
export interface IViewer {
  /** maps a point in the screen coordinates to the point in the graph coordinates*/
  ScreenToSource(e: MouseEvent): Point
  IncrementalDraggingModeAlways: boolean

  //  the scale to screen

  CurrentScale: number

  /** Creates a visual element for the node, and the corresponding geometry node is created according
   *  to the size of the visual element.
   *  If this value is not null then is should be a visual for the label; the node width and the height
   *  will be taken from this visual.
   *  Returns IViewerNode
   */
  CreateIViewerNode(drawingNode: Node, center: Point, visualElement: any): IViewerNode

  //  creates a default visual element for the node

  //  <returns></returns>
  CreateIViewerNode(drawingNode: Node): IViewerNode

  //  if set to true the Graph geometry is unchanged after the assignment viewer.Graph=graph;

  NeedToCalculateLayout: boolean

  //  the viewer signalls that the view, the transform or the viewport, has changed

  ViewChangeEvent: EventHandler

  //  the event raised at a time when ObjectUnderMouseCursor changes

  ObjectUnderMouseCursorChanged: EventHandler

  //  Returns the object under the cursor and null if there is none

  ObjectUnderMouseCursor: IViewerObject

  //  forcing redraw of the object

  Invalidate(objectToInvalidate: IViewerObject): void

  //  invalidates everything

  InvalidateAll(): void

  //  returns modifier keys; control, shift, or alt are pressed at the moments

  ModifierKeys: ModifierKeysEnum

  //  gets all entities which can be manipulated by the viewer

  entities: Iterable<IViewerObject>

  //  number of dots per inch in x direction

  DpiX: number

  //  number of dots per inch in y direction

  DpiY: number

  //  this method should be called on the end of the dragging

  OnDragEnd(changedObjects: Iterable<IViewerObject>): void

  //  The scale dependent width of an edited curve that should be clearly visible.
  //  Used in the default entity editing.

  LineThicknessForEditing: number

  //  enables and disables the default editing of the viewer

  LayoutEditingEnabled: boolean

  //  if is set to true then the mouse left click on a node and dragging the cursor to
  //  another node will create an edge and add it to the graph

  InsertingEdge: boolean

  //  Pops up a pop up menu with a menu item for each couple, the string is the title and the delegate is the callback

  PopupMenus(menuItems: Array<[string, () => void]>): void

  //  The radius of the circle drawn around a polyline corner

  UnderlyingPolylineCircleRadius: number

  //  gets or sets the graph

  graph: Graph

  //  prepare to draw the rubber line

  StartDrawingRubberLine(startingPoint: Point): void

  //  draw the rubber line to the current mouse position

  DrawRubberLine(args: any): void

  //  draw rubber line to a given point

  DrawRubberLine(point: Point): void

  //  stop drawing the rubber line

  StopDrawingRubberLine(): void

  //  add an edge to the viewer graph

  //  <returns></returns>
  AddEdge(edge: IViewerEdge, registerForUndo: boolean): void

  //  drawing edge already has its geometry in place

  //  <returns></returns>
  CreateEdgeWithGivenGeometry(drawingEdge: Edge): IViewerEdge

  //  adds a node to the viewer graph

  AddNode(node: IViewerNode, registerForUndo: boolean): void

  //  removes an edge from the graph

  RemoveEdge(edge: IViewerEdge, registerForUndo: boolean): void

  //  deletes node

  RemoveNode(node: IViewerNode, registerForUndo: boolean): void

  //  Routes the edge. The edge will not be not attached to the graph after the routing

  //  <returns></returns>
  RouteEdge(drawingEdge: Edge): IViewerEdge

  //  gets the viewer graph

  ViewerGraph: IViewerGraph

  //  arrowhead length for newly created edges

  ArrowheadLength: number

  //  creates the port visual if it does not exist, and sets the port location

  SetSourcePortForEdgeRouting(portLocation: Point): void

  //  creates the port visual if it does not exist, and sets the port location

  SetTargetPortForEdgeRouting(portLocation: Point): void

  //  removes the port

  RemoveSourcePortEdgeRouting(): void

  //  removes the port

  RemoveTargetPortEdgeRouting(): void

  //

  DrawRubberEdge(edgeGeometry: GeomEdge): void

  //  stops drawing the rubber edge

  StopDrawingRubberEdge(): void

  //  the transformation from the graph surface to the client viewport

  Transform: PlaneTransformation
  undo(): void
  redo(): void
}
