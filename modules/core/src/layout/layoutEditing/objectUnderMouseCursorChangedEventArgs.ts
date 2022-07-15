import {IViewerObject} from './iViewerObject'
export class EventArgs {}

export class ObjectUnderMouseCursorChangedEventArgs extends EventArgs {
  oldObject: IViewerObject

  ///  <summary>
  ///  The old object under the mouse
  ///  </summary>
  public get OldObject(): IViewerObject {
    return this.oldObject
  }
  public set OldObject(value: IViewerObject) {
    this.oldObject = value
  }

  newObject: IViewerObject

  ///  <summary>
  ///  the new object under the mouse
  ///  </summary>
  public get NewObject(): IViewerObject {
    return this.newObject
  }
  public set NewObject(value: IViewerObject) {
    this.newObject = value
  }

  ///  <summary>
  ///  constructor
  ///  </summary>
  ///  <param name="oldObject"></param>
  ///  <param name="newObject"></param>
  public constructor(oldObject: IViewerObject, newObject: IViewerObject) {
    super()
    this.OldObject = oldObject
    this.NewObject = newObject
  }
}
