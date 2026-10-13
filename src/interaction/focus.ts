/** Input lifecycle only; has no mechanical state or time source. */
export class FocusInputGate {
  focused = true;
  private activationPending = false;
  blur() { this.focused = false; this.activationPending = true; }
  focus() { this.focused = true; }
  pointerDown(): boolean {
    if (!this.focused || this.activationPending) {
      this.focused = true;
      this.activationPending = false;
      return false;
    }
    return true;
  }
  keyDown(repeat: boolean): boolean {
    if (!this.focused || repeat && this.activationPending) return false;
    this.activationPending = false;
    return true;
  }
}
