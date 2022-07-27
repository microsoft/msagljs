///  <summary>
    ///  Clusters can (optionally) have a rectangular border which is respected by overlap avoidance.
    ///  Currently, this is controlled by FastIncrementalLayoutSettings.RectangularClusters.
    ///  If FastIncrementalLayoutSettings.RectangularClusters is true, then the 
    ///  FastIncrementalLayout constructor will create a RectangularBoundary in each cluster.
    ///  Otherwise it will be null.

import { CurveFactory } from "..";
import { ICurve } from "../icurve";
import { Point } from "../point";
import { Rectangle } from "../rectangle";
import { BorderInfo } from "./borderInfo";

    ///  </summary>
    export class RectangularClusterBoundary {
        
        ///  <summary>
        ///  Set margins to zero which also initializes other members.
        ///  </summary>
        public constructor () {
            this.LeftBorderInfo = BorderInfo.constructorN(0);
            this.RightBorderInfo = BorderInfo.constructorN(0);
            this.TopBorderInfo = BorderInfo.constructorN(0);
            this.BottomBorderInfo = BorderInfo.constructorN(0);
        }
        
         rectangle: Rectangle;
        
        //  Used only for RectangularHull
         olapCluster: OverlapRemovalCluster;
        
        //  For use with RectangularHull only, and only valid during verletIntegration()
        ///  <summary>
        ///  Left margin of this cluster (additional space inside the cluster border).
        ///  </summary>
        public get LeftMargin(): number {
            return this.LeftBorderInfo.InnerMargin;
        }
        public set LeftMargin(value: number)  {
            this.LeftBorderInfo = new BorderInfo(value, this.LeftBorderInfo.FixedPosition, this.LeftBorderInfo.Weight);
        }
        
        ///  <summary>
        ///  Right margin of this cluster (additional space inside the cluster border).
        ///  </summary>
        public get RightMargin(): number {
            return this.RightBorderInfo.InnerMargin;
        }
        public set RightMargin(value: number)  {
            this.RightBorderInfo = new BorderInfo(value, this.RightBorderInfo.FixedPosition, this.RightBorderInfo.Weight);
        }
        
        ///  <summary>
        ///  Top margin of this cluster (additional space inside the cluster border).
        ///  </summary>
        public get TopMargin(): number {
            return this.TopBorderInfo.InnerMargin;
        }
        public set TopMargin(value: number)  {
            this.TopBorderInfo = new BorderInfo(value, this.TopBorderInfo.FixedPosition, this.TopBorderInfo.Weight);
        }
        
        ///  <summary>
        ///  Bottom margin of this cluster (additional space inside the cluster border).
        ///  </summary>
        public get BottomMargin(): number {
            return this.BottomBorderInfo.InnerMargin;
        }
        public set BottomMargin(value: number)  {
            this.BottomBorderInfo = new BorderInfo(value, this.BottomBorderInfo.FixedPosition, this.BottomBorderInfo.Weight);
        }
        
        ///  <summary>
        ///  Information for the Left border of the cluster.
        ///  </summary>
        public get LeftBorderInfo(): BorderInfo {
        }
        public set LeftBorderInfo(value: BorderInfo)  {
        }
        
        ///  <summary>
        ///  Information for the Right border of the cluster.
        ///  </summary>
        public get RightBorderInfo(): BorderInfo {
        }
        public set RightBorderInfo(value: BorderInfo)  {
        }
        
        ///  <summary>
        ///  Information for the Top border of the cluster.
        ///  </summary>
        public get TopBorderInfo(): BorderInfo {
        }
        public set TopBorderInfo(value: BorderInfo)  {
        }
        
        ///  <summary>
        ///  Information for the Bottom border of the cluster.
        ///  </summary>
        public get BottomBorderInfo(): BorderInfo {
        }
        public set BottomBorderInfo(value: BorderInfo)  {
        }
        
        ///  <summary>
        ///  When this is set, the OverlapRemovalCluster will generate equality constraints rather than inequalities
        ///  to keep its children within its bounds.
        ///  </summary>
        public get GenerateFixedConstraints(): boolean {
        }
        public set GenerateFixedConstraints(value: boolean)  {
        }
        
        generateFixedConstraintsDefault: boolean;
        
        ///  <summary>
        ///  The default value that GenerateFixedConstraints will be reverted to when a lock is released
        ///  </summary>
        public get GenerateFixedConstraintsDefault(): boolean {
            return this.generateFixedConstraintsDefault;
        }
        public set GenerateFixedConstraintsDefault(value: boolean)  {
            this.generateFixedConstraintsDefault = value;
            this.GenerateFixedConstraints = value;
        }
        
        ///  <summary>
        ///  The rectangular hull of all the points of all the nodes in the cluster, as set by
        ///  ProjectionSolver.Solve().
        ///  Note: This rectangle may not originate at the barycenter.  Drawing uses only the results
        ///  of this function; the barycenter is used only for gravity computations.
        ///  </summary>
        ///  <returns></returns>
        public RectangularHull(): ICurve {
            Debug.Assert((this.rectangle.Bottom <= this.rectangle.Top));
            if (((RadiusX > 0) 
                        || (RadiusY > 0))) {
                return CurveFactory.CreateRectangleWithRoundedCorners(this.rectangle.Width, this.rectangle.Height, RadiusX, RadiusY, this.rectangle.Center);
            }
            else {
                return CurveFactory.CreateRectangle(this.rectangle.Width, this.rectangle.Height, this.rectangle.Center);
            }
            
        }
        
        ///  <summary>
        ///  Will only return something useful if FastIncrementalLayoutSettings.AvoidOverlaps is true.
        ///  </summary>
        public get Rect(): Rectangle {
            return this.rectangle;
        }
        public set Rect(value: Rectangle)  {
            this.rectangle = value;
        }
        
        class Margin {
            
            public Left: number;
            
            public Right: number;
            
            public Top: number;
            
            public Bottom: number;
        }
        
        defaultMargin: Margin;
        
         get DefaultMarginIsSet(): boolean {
            return (this.defaultMargin != null);
        }
        
        ///  <summary>
        ///  The default margin stored by StoreDefaultMargin
        ///  </summary>
        public get DefaultLeftMargin(): number {
            return this.defaultMargin.Left;
        }
        
        ///  <summary>
        ///  The default margin stored by StoreDefaultMargin
        ///  </summary>
        public get DefaultTopMargin(): number {
            return this.defaultMargin.Top;
        }
        
        ///  <summary>
        ///  The default margin stored by StoreDefaultMargin
        ///  </summary>
        public get DefaultRightMargin(): number {
            return this.defaultMargin.Right;
        }
        
        ///  <summary>
        ///  The default margin stored by StoreDefaultMargin
        ///  </summary>
        public get DefaultBottomMargin(): number {
            return this.defaultMargin.Bottom;
        }
        
        ///  <summary>
        ///  store a the current margin as the default which we can revert to later with the RestoreDefaultMargin
        ///  </summary>
        public StoreDefaultMargin() {
            this.defaultMargin = [][
                    Left=LeftMargin,
                    Right=RightMargin,
                    Bottom=BottomMargin,
                    Top=TopMargin];
        }
        
        ///  <summary>
        ///  store a default margin which we can revert to later with the RestoreDefaultMargin
        ///  </summary>
        public StoreDefaultMargin(left: number, right: number, bottom: number, top: number) {
            this.defaultMargin = [][
                    Left=left,
                    Right=right,
                    Bottom=bottom,
                    Top=top];
        }
        
        ///  <summary>
        ///  revert to a previously stored default margin
        ///  </summary>
        public RestoreDefaultMargin() {
            if ((this.defaultMargin != null)) {
                this.LeftMargin = this.defaultMargin.Left;
                this.RightMargin = this.defaultMargin.Right;
                this.TopMargin = this.defaultMargin.Top;
                this.BottomMargin = this.defaultMargin.Bottom;
            }
            
        }
        
        ///  <summary>
        ///  Move the bounding box by delta
        ///  </summary>
        ///  <param name="delta"></param>
        public TranslateRectangle(delta: Point) {
            this.rectangle = new Rectangle((this.rectangle.Left + delta.X), (this.rectangle.Bottom + delta.Y), new Point(this.rectangle.Width, this.rectangle.Height));
        }
        
        ///  <summary>
        ///  Radius on the X axis
        ///  </summary>
        public get RadiusX(): number {
        }
        public set RadiusX(value: number)  {
        }
        
        ///  <summary>
        ///  Radius on the Y axis
        ///  </summary>
        public get RadiusY(): number {
        }
        public set RadiusY(value: number)  {
        }
        
        ///  <summary>
        ///  Creates a lock on all four borders
        ///  </summary>
        ///  <param name="left"></param>
        ///  <param name="right"></param>
        ///  <param name="top"></param>
        ///  <param name="bottom"></param>
        public Lock(left: number, right: number, top: number, bottom: number) {
            let weight: number = 10000;
            this.LeftBorderInfo = new BorderInfo(this.LeftBorderInfo.InnerMargin, left, weight);
            this.RightBorderInfo = new BorderInfo(this.RightBorderInfo.InnerMargin, right, weight);
            this.TopBorderInfo = new BorderInfo(this.TopBorderInfo.InnerMargin, top, weight);
            this.BottomBorderInfo = new BorderInfo(this.BottomBorderInfo.InnerMargin, bottom, weight);
        }
        
        ///  <summary>
        ///  Releases the lock on all four borders
        ///  </summary>
        public Unlock() {
            this.LeftBorderInfo = new BorderInfo(this.LeftBorderInfo.InnerMargin);
            this.RightBorderInfo = new BorderInfo(this.RightBorderInfo.InnerMargin);
            this.TopBorderInfo = new BorderInfo(this.TopBorderInfo.InnerMargin);
            this.BottomBorderInfo = new BorderInfo(this.BottomBorderInfo.InnerMargin);
        }
        
        ///  <summary>
        ///  boundary can shrink no more than this
        ///  </summary>
        public get MinWidth(): number {
        }
        public set MinWidth(value: number)  {
        }
        
        ///  <summary>
        ///  boundary can shrink no more than this
        ///  </summary>
        public get MinHeight(): number {
        }
        public set MinHeight(value: number)  {
        }
    }