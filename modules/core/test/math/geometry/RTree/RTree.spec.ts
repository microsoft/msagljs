import {Rectangle, Point} from '../../../../src'
import {mkRTree} from '../../../../src/math/geometry/RTree/RTree'
import {randomInt} from '../../../../src/utils/random'

test('RTreeQuery_IncrementalRectangles', () => {
  const RectsCount = 100
  const RegionSize = 100
  const RectSize = 10

  const rects = new Array<Rectangle>(RectsCount)
  for (let i = 0; i < RectsCount; ++i) {
    rects[i] = Rectangle.mkOnPoints([new Point(randomInt(RegionSize), randomInt(RegionSize))])
  }

  // create rTree with just the first rectangle
  const l: [Rectangle, Rectangle][] = [[rects[0], rects[0]]]

  const queryTree = mkRTree<Rectangle, Point>(l)

  // add remaining rectangles 10 at a time
  for (let a = 1, b = 10; b < RectsCount; a = b, b += 10) {
    for (let i = a; i < b; ++i) {
      queryTree.Add(rects[i], rects[i])
    }
    let t = Array.from(queryTree.GetAllLeaves())
    expect(t.length).toBe(b) // "did we lose leaves?");
    t = queryTree.GetAllIntersecting(
      new Rectangle({
        left: 0,
        bottom: 0,
        right: RegionSize + RectSize,
        top: RegionSize + RectSize,
      }),
    )
    expect(t.length).toBe(b) // "are all leaves inside the max range?");
    expect(queryTree.GetAllIntersecting(new Rectangle({left: -2, right: -2, bottom: -1, top: -1})).length).toBe(0) // "should be no leaves inside this rectangle!");
    const query = Rectangle.mkPP(
      new Point(randomInt(RegionSize), randomInt(RegionSize)),
      new Point(randomInt(RegionSize), randomInt(RegionSize)),
    )
    const checkList = rects.slice(0, b).filter((r) => query.intersects(r))

    const checkSet = new Set<string>(checkList.map((r) => r.toString()))
    const result = queryTree.GetAllIntersecting(query)
    expect(result.length).toBe(checkList.length)
    for (const r of result) {
      expect(query.intersects(r)).toBe(true)
      expect(checkSet.has(r.toString())).toBe(true)
    }
  }
})
