import {RBColor} from '../../src/structs/RBTree/rbColor'
import {RBNode} from '../../src/structs/RBTree/rbNode'
import {RBTree} from '../../src/structs/RBTree/rbTree'
import {randomInt} from '../../src/utils/random'

export class RbTreeUtils {
  static getRandomArray(size: number, upperBound = 1000): number[] {
    const arr: number[] = []
    for (let i = 0; i < size; i++) {
      arr.push(randomInt(upperBound))
    }
    return arr
  }

  static buildTreeWithNums(vals: number[], comparer: (a: number, b: number) => number): RBTree<number> {
    const tree: RBTree<number> = new RBTree(comparer)
    for (let i = 0; i < vals.length; i++) {
      tree.insert(vals[i])
    }
    return tree
  }

  static computeBlackHeight<T>(root: RBNode<T>): number {
    if (root == null) {
      return 0
    } else {
      const leftHeight: number = this.computeBlackHeight(root.left)
      const rightHeight: number = this.computeBlackHeight(root.right)
      if (leftHeight === -1 || rightHeight === -1 || rightHeight !== leftHeight) {
        return -1
      }
      return (root.color === RBColor.Black ? 1 : 0) + leftHeight
    }
  }
}

test('check if has correct in-order-traversal', () => {
  const comparer = (a: number, b: number) => a - b
  const vals: number[] = RbTreeUtils.getRandomArray(10, 100)
  const tree: RBTree<number> = RbTreeUtils.buildTreeWithNums(vals, comparer)

  vals.sort(comparer)
  let i = 0
  for (const node of tree) {
    expect(node).toBe(vals[i]) // 'nodes not in order')
    i++
  }
})
test('check if the iterator works', () => {
  const comparer = (a: number, b: number) => a - b
  const vals = [0, 1, 2]
  const tree: RBTree<number> = RbTreeUtils.buildTreeWithNums(vals, comparer)

  vals.sort(comparer)
  let i = 0
  for (const node of tree) {
    expect(node).toBe(vals[i]) // 'nodes not in order')
    i++
  }
})

test('check black height(s) are equal', () => {
  const comparer = (a: number, b: number) => a - b
  const vals: number[] = RbTreeUtils.getRandomArray(50, 100)
  const tree: RBTree<number> = RbTreeUtils.buildTreeWithNums(vals, comparer)
  const blackHeight = RbTreeUtils.computeBlackHeight(tree.getRoot())
  // console.log(blackHeight)
  expect(blackHeight !== -1).toBe(true)
  //   'difference in black height of left and right branch of a subtree',
})

test('check removal', () => {
  const comparer = (a: number, b: number) => a - b
  const tree: RBTree<number> = new RBTree<number>(comparer)
  for (let i = 1; i <= 20; i++) {
    tree.insert(i)
  }
  tree.remove(10)
  let i = 1
  for (const node of tree) {
    if (i === 10) expect(node).toBe(11) // 'node w/ value 10 not removed')
    i++
  }
})
