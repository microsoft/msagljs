import {String} from 'typescript-string-operations'
export class SymmetricTuple<T> {
  A: T

  B: T

  GetHashCode(): number {
    throw new Error('not implemented')
    //return (this.A.GetHashCode() | this.B.GetHashCode());
    // The operator should be an XOR ^ instead of an OR, but not available in CodeDOM
    // we need a symmetric hash code
  }

  constructor(a: T, b: T) {
    this.A = a
    this.B = b
  }

  Equals(obj: unknown): boolean {
    if (obj == null) {
      return false
    }

    if (this == obj) {
      return true
    }

    const other = obj as unknown as SymmetricTuple<T>

    return (this.A == other.A && this.B == other.B) || (this.A == other.B && this.B == other.A)
  }

  public ToString(): string {
    return String.Format('({0},{1})', this.A, this.B)
  }
}
