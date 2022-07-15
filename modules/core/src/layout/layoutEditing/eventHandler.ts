/** represents the set of functions to handle an event */
export class EventHandler {
  forEach(arg0: (a: any) => any) {
    this.actions.forEach((a) => a(arg0, null))
  }
  private actions: Set<(a: any, b: any) => void>
  subscribe(f: (a: any, b: any) => void) {
    this.actions.add(f)
  }
  unsubscribe(f: (a: any, b: any) => void) {
    this.actions.delete(f)
  }
  raise(a: any, b: any) {
    this.actions.forEach((f) => f(a, b))
  }
}
