/**   the interface for the viewer for editing the graph layout, and the graph */

import {Point} from '../../math/geometry'
import {PlaneTransformation} from '../../math/geometry/planeTransformation'
import {Edge} from '../../structs/edge'
import {Graph} from '../../structs/graph'
import {GeomEdge} from '../core'
import {EventHandler} from './eventHandler'
import {IViewerEdge} from './iViewerEdge'
import {IViewerGraph} from './iViewerGraph'
import {IViewerNode} from './iViewerNode'
import {IViewerObject} from './iViewerObject'
import {ModifierKeys} from './modifierKeys'
export interface IViewer {
  IncrementalDraggingModeAlways: boolean

  ///  the scale to screen

  CurrentScale: number

  ///  creates a visual element for the node, and the corresponding geometry node is created according
  ///  to the size of the visual element

  ///  <param name="drawingNode">usually the drawing node has a label, and the visual element is created accordingly</param>
  ///  <param name="center">the node center location</param>
  ///  <param name="visualElement">if this value is not null then is should be a visual for the label, and the node width and height
  ///  will be taken from this visual</param>
  ///  <returns>new IViewerNode</returns>
  CreateIViewerNode(drawingNode: Node, center: Point, visualElement: any): IViewerNode

  ///  creates a default visual element for the node

  ///  <param name="drawingNode"></param>
  ///  <returns></returns>
  CreateIViewerNode(drawingNode: Node): IViewerNode

  ///  if set to true the Graph geometry is unchanged after the assignment viewer.Graph=graph;

  NeedToCalculateLayout: boolean

  ///  the viewer signalls that the view, the transform or the viewport, has changed

  ViewChangeEvent: EventHandler

  ///  signalling the mouse down event

  MouseDown: EventHandler

  ///  signalling the mouse move event

  MouseMove: EventHandler

  ///  signalling the mouse up event

  MouseUp: EventHandler

  ///  the event raised at a time when ObjectUnderMouseCursor changes

  ObjectUnderMouseCursorChanged: EventHandler

  ///  Returns the object under the cursor and null if there is none

  ObjectUnderMouseCursor: IViewerObject

  ///  forcing redraw of the object

  ///  <param name="objectToInvalidate"></param>
  Invalidate(objectToInvalidate: IViewerObject)

  ///  invalidates everything

  Invalidate()

  ///  is raised after the graph is changed

  GraphChanged: EventHandler

  ///  returns modifier keys; control, shift, or alt are pressed at the moments

  ModifierKeys: ModifierKeys

  ///  maps a point in screen coordinates to the point in the graph surface

  ///  <param name="e"></param>
  ///  <returns></returns>
  //ScreenToSource(e: Msagl): Point;

  ///  gets all entities which can be dragged

  Entities: Iterable<IViewerObject>

  ///  number of dots per inch in x direction

  DpiX: number

  ///  number of dots per inch in y direction

  DpiY: number

  ///  this method should be called on the end of the dragging

  ///  <param name="changedObjects"></param>
  OnDragEnd(changedObjects: Iterable<IViewerObject>)

  ///  The scale dependent width of an edited curve that should be clearly visible.
  ///  Used in the default entity editing.

  LineThicknessForEditing: number

  ///  enables and disables the default editing of the viewer

  LayoutEditingEnabled: boolean

  ///  if is set to true then the mouse left click on a node and dragging the cursor to
  ///  another node will create an edge and add it to the graph

  InsertingEdge: boolean

  ///  Pops up a pop up menu with a menu item for each couple, the string is the title and the delegate is the callback

  ///  <param name="menuItems"></param>
  PopupMenus(menuItems: Array<[string, () => void]>)

  ///  The radius of the circle drawn around a polyline corner

  UnderlyingPolylineCircleRadius: number

  ///  gets or sets the graph

  Graph: Graph

  ///  prepare to draw the rubber line

  ///  <param name="startingPoint"></param>
  StartDrawingRubberLine(startingPoint: Point): void

  ///  draw the rubber line to the current mouse position

  ///  <param name="args"></param>
  DrawRubberLine(args: any): void

  ///  draw rubber line to a given point

  ///  <param name="point"></param>
  DrawRubberLine(point: Point): void

  ///  stop drawing the rubber line

  StopDrawingRubberLine()

  ///  add an edge to the viewer graph

  ///  <param name="edge"></param>
  ///  <param name="registerForUndo"></param>
  ///  <returns></returns>
  AddEdge(edge: IViewerEdge, registerForUndo: boolean): void

  ///  drawing edge already has its geometry in place

  ///  <param name="drawingEdge"></param>
  ///  <returns></returns>
  CreateEdgeWithGivenGeometry(drawingEdge: Edge): IViewerEdge

  ///  adds a node to the viewer graph

  ///  <param name="node"></param>
  ///  <param name="registerForUndo"></param>
  AddNode(node: IViewerNode, registerForUndo: boolean): void

  ///  removes an edge from the graph

  ///  <param name="edge"></param>
  /// <param name="registerForUndo"></param>
  RemoveEdge(edge: IViewerEdge, registerForUndo: boolean): void

  ///  deletes node

  ///  <param name="node"></param>
  ///  <param name="registerForUndo"></param>
  RemoveNode(node: IViewerNode, registerForUndo: boolean): void

  ///  Routes the edge. The edge will not be not attached to the graph after the routing

  ///  <returns></returns>
  RouteEdge(drawingEdge: Edge): IViewerEdge

  ///  gets the viewer graph

  ViewerGraph: IViewerGraph

  ///  arrowhead length for newly created edges

  ArrowheadLength: number

  ///  creates the port visual if it does not exist, and sets the port location

  ///  <param name="portLocation"></param>
  SetSourcePortForEdgeRouting(portLocation: Point)

  ///  creates the port visual if it does not exist, and sets the port location

  ///  <param name="portLocation"></param>
  SetTargetPortForEdgeRouting(portLocation: Point)

  ///  removes the port

  RemoveSourcePortEdgeRouting()

  ///  removes the port

  RemoveTargetPortEdgeRouting()

  ///

  ///  <param name="edgeGeometry"></param>
  DrawRubberEdge(edgeGeometry: GeomEdge): void

  ///  stops drawing the rubber edge

  StopDrawingRubberEdge(): void

  ///  the transformation from the graph surface to the client viewport

  Transform: PlaneTransformation
}
