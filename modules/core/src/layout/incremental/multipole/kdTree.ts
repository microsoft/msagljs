import { Queue } from "queue-typescript";
import { Point, Size } from "../../../math/geometry";
import { Disc } from "./disc";
import { MultipoleCoefficients } from "./multipoleCoefficients";

enum Dim {
        
    Horizontal = 0,
    
    Vertical = 1,
}
class KdNode {
            
    parent: InternalKdNode;
            
    med: Disc;
   
    multipoleCoefficients: MultipoleCoefficients;
   
    intersects(v: KdNode): boolean {
       let d: Point = (v.med.Center - this.med.Center);
       let l: number = d.length;
       return (l 
                   < (v.med.Radius + this.med.Radius));
   }
   
    abstract computeMultipoleCoefficients(precision: number);
}


class InternalKdNode extends KdNode {
   
    leftChild: KdNode;
   
    rightChild: KdNode;
   
    constructor (med: Disc, left: KdNode, right: KdNode) {
        super()
       this.med = med;
       parent = left.parent;
       if ((parent != null)) {
           if ((parent.leftChild == left)) {
               parent.leftChild = this;
           }
           else {
               Debug.Assert((parent.rightChild == left));
               parent.rightChild = this;
           }
           
       }
       
       this.leftChild = left;
       this.rightChild = right;
       left.parent = this;
       right.parent = this;
   }
   
    /* override */ computeMultipoleCoefficients(precision: number) {
       this.leftChild.computeMultipoleCoefficients(precision);
       this.rightChild.computeMultipoleCoefficients(precision);
       multipoleCoefficients = new MultipoleCoefficients(med.Center, this.leftChild.multipoleCoefficients, this.rightChild.multipoleCoefficients);
   }
}
class LeafKdNode extends KdNode {
            
    particles: Particle[,];
   
    ps: Point[];
   
    constructor (particles: Particle[,]) {
       Debug.Assert((this.particles[0].Length == this.particles[1].Length));
       this.particles = this.particles;
       this.ComputeMED();
   }
   
    /* override */ computeMultipoleCoefficients(precision: number) {
       multipoleCoefficients = new MultipoleCoefficients(precision, med.Center, this.ps);
   }
   
    ComputeMED(): Disc {
       let n: number = this.Size();
       this.ps = new Array(n);
       for (let i: number = 0; (i < n); i++) {
           this.ps[i] = this.particles[0][i].point;
       }
       
       return;
   }
   
   private Min(d: Dim): number {
       return this.particles[(<number>(d))][0].pos(d);
   }
   
    Size(): number {
       return this.particles[0].Length;
   }
   
   private Max(d: Dim): number {
       return this.particles[(<number>(d))][(this.Size() - 1)].pos(d);
   }
   
   private Dimension(d: Dim): number {
       return (this.Max(d) - this.Min(d));
   }
   
    Split(/* out */rightSibling: LeafKdNode): InternalKdNode {
       let splitDirection: Dim = Dim.Horizontal;
       // TODO: Warning!!!, inline IF is not supported ?
       (this.Dimension(Dim.Horizontal) > this.Dimension(Dim.Vertical));
       Dim.Vertical;
       let nonSplitDirection: Dim = Dim.Vertical;
       // TODO: Warning!!!, inline IF is not supported ?
       (splitDirection == Dim.Horizontal);
       Dim.Horizontal;
       let nRight: number = (n - nLeft);
       let n: number = this.Size();
       let nLeft: number = (n / 2);
       let rightParticles: Particle[,] = [
               new Array(nRight),
               new Array(nRight)];
       let leftParticles: Particle[,] = [
               new Array(nLeft),
               new Array(nLeft)];
       let rCtr: number = 0;
       let lCtr: number = 0;
       for (let i: number = 0; (i < n); i++) {
           let p: Particle = this.particles[(<number>(splitDirection))][i];
           if ((i < nLeft)) {
               leftParticles[(<number>(splitDirection))][i] = p;
               p.splitLeft = true;
           }
           else {
               rightParticles[(<number>(splitDirection))][(i - nLeft)] = p;
               p.splitLeft = false;
           }
           
       }
       
       for (let i: number = 0; (i < n); i++) {
           let p: Particle = this.particles[(<number>(nonSplitDirection))][i];
           if (p.splitLeft) {
               leftParticles[(<number>(nonSplitDirection))][lCtr++] = p;
           }
           else {
               rightParticles[(<number>(nonSplitDirection))][rCtr++] = p;
           }
           
       }
       
       Debug.Assert((lCtr == nLeft));
       Debug.Assert((rCtr == nRight));
       let parentMED: Disc = med;
       this.particles = leftParticles;
       this.ComputeMED();
       rightSibling = new LeafKdNode(rightParticles);
       return new InternalKdNode(parentMED, this, rightSibling);
   }
   
    ComputeForces() {
       for (let u in this.particles[0]) {
           for (let v in this.particles[0]) {
               if ((u != v)) {
                   u.force = (u.force + MultipoleCoefficients.Force(u.point, v.point));
               }
               
           }
           
       }
       
   }
}

class Particle {
            
    
     force: Point;
    
     point: Point;
    
     splitLeft: boolean;
    
     pos(d: Dim): number {
        return  (d == Dim.Horizontal)? this.point.x:       this.point.y
    }
    
    ///  <summary>
    ///  Create particle at point
    ///  </summary>
    ///  <param name="point"></param>
    public constructor (point: Point) {
        this.point = point;
        this.force = new Point(0, 0);
    }
}


///  <summary>
    ///  A KDTree recursively divides particles in a 2D space into a balanced tree structure by doing horizontal splits for wide bounding boxes and vertical splits for tall bounding boxes.
    ///  </summary>
    export class KDTree {
        
        particles: Particle[];
        
         root: InternalKdNode;
        
        leaves: Array<LeafKdNode>;
        
        private particlesBy(d: Dim): Particle[] {
             return this.particles.map(t=>t).sort((a,b)=>a.pos(d) - b.pos(d))
            
        }
        
        ///  <summary>
        ///  Create a KDTree over the specified particles, with the leaf partitions each containing bucketSize particles.
        ///  </summary>
        ///  <param name="particles"></param>
        ///  <param name="bucketSize"></param>
        public constructor (particles: Particle[], bucketSize: number) {
            this.particles = this.particles;
            let ps= new Array<Array<Particle>>()
            ps.push(this.particlesBy(Dim.Horizontal))
            ps.push(this.particlesBy(Dim.Vertical))
            this.leaves = new Array<LeafKdNode>();
            let r: LeafKdNode;
            let l: LeafKdNode = new LeafKdNode(ps);
            this.leaves.Add(l);
            this.root = l.Split(/* out */r);
            this.leaves.Add(r);
            let splitQueue = new SplitQueue(bucketSize);
            splitQueue.Enqueue(l, r);
            while ((splitQueue.Count > 0)) {
                l = splitQueue.dequeue();
                l.Split(/* out */r);
                this.leaves.Add(r);
                splitQueue.Enqueue(l, r);
            }
            
        }
        
        ///  <summary>
        ///  Compute forces between particles using multipole approximations.
        ///  </summary>
        ///  <param name="precision"></param>
        public ComputeForces(precision: number) {
            this.root.computeMultipoleCoefficients(precision);
            for (let l in this.leaves) {
                l.ComputeForces();
                let stack: Array<KdNode> = new Array<KdNode>();
                stack.Add(this.root);
                while ((stack.Count > 0)) {
                    let v: KdNode = stack.Last();
                    stack.RemoveAt((stack.Count - 1));
                    if (!l.intersects(v)) {
                        for (let p in l.particles[0]) {
                            p.force = (p.force - v.multipoleCoefficients.ApproximateForce(p.point));
                        }
                        
                    }
                    else {
                        let leaf = (<LeafKdNode>(v));
                        if ((leaf != null)) {
                            for (let p in l.particles[0]) {
                                for (let q in leaf.particles[0]) {
                                    if ((p != q)) {
                                        p.force = (p.force + MultipoleCoefficients.Force(p.point, q.point));
                                    }
                                    
                                }
                                
                            }
                            
                        }
                        else {
                            let n = (<InternalKdNode>(v));
                            stack.Add(n.leftChild);
                            stack.Add(n.rightChild);
                        }
                        
                    }
                    
                }
                
            }
            
        }
        
        ///  <summary>
        ///  Particles used in KDTree multipole force approximations
        ///  </summary>
        
        
        
        class SplitQueue extends Queue<LeafKdNode> {
            
            B: number;
            
            public constructor (B: number) {
                this.B = this.B;
            }
            
            public Enqueue(l: LeafKdNode, r: LeafKdNode) {
                if ((l.Size() > this.B)) {
                    this.Enqueue(l);
                }
                
                if ((r.Size() > this.B)) {
                    this.Enqueue(r);
                }
                
            }
        }
    }