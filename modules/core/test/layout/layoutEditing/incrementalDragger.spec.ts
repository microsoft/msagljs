import {graphToJSON, parseJSONGraph} from '../../../../parser/src/dotparser'
import {GeomGraph, GeomNode} from '../../../src/layout/core'
import {GeomObject} from '../../../src/layout/core/geomObject'
import {SugiyamaLayoutSettings} from '../../../src/layout/layered/SugiyamaLayoutSettings'
import {IncrementalDragger} from '../../../src/layout/layoutEditing/incrementalDragger'
import {Point} from '../../../src/math/geometry'
import {parseJSONFile} from '../../utils/testUtils'
import * as fs from 'fs'

test('incremental drag', () => {
  const g = parseJSONFile('JSONfiles/ldbxtried.gv.JSON')

  const gg = GeomGraph.getGeom(g)
  const node = g.findNodeRecursive('n464')
  const gNode = GeomObject.getGeom(node) as GeomNode
  const ls = new SugiyamaLayoutSettings()
  const pushingNodes = []
  pushingNodes.push(gNode)
  const id = new IncrementalDragger(pushingNodes, gg, ls)
  for (let i = 0; i < 5; i++) {
    id.Drag(new Point(20, 20))
    const jsonfOfG = graphToJSON(g)
    const ws = fs.openSync('/tmp/drag' + i + '.JSON', 'w', 0o666)
    fs.writeFileSync(ws, JSON.stringify(jsonfOfG))
    //console.log(gNode.center)
    fs.close(ws)
  }
})
