// Undo / redo as whole-project JSON snapshots. A project is small (a few
// hundred KB at most), so a snapshot per edit is cheaper to get right than
// patches. Brush strokes and tile painting call checkpoint() once at the
// start of the drag, so a whole stroke is one undo step.

const LIMIT = 80;

export class History {
  constructor(getProject, setProject) {
    this.get = getProject;
    this.set = setProject;
    this.undoStack = [];
    this.redoStack = [];
    this.listeners = new Set();
  }
  onChange(fn) {
    this.listeners.add(fn);
  }
  notify() {
    for (const fn of this.listeners) fn(this);
  }
  /** Record the current state before a change. */
  checkpoint() {
    this.undoStack.push(JSON.stringify(this.get()));
    if (this.undoStack.length > LIMIT) this.undoStack.shift();
    this.redoStack.length = 0;
    this.notify();
  }
  canUndo() {
    return this.undoStack.length > 0;
  }
  canRedo() {
    return this.redoStack.length > 0;
  }
  undo() {
    if (!this.undoStack.length) return false;
    this.redoStack.push(JSON.stringify(this.get()));
    this.set(JSON.parse(this.undoStack.pop()));
    this.notify();
    return true;
  }
  redo() {
    if (!this.redoStack.length) return false;
    this.undoStack.push(JSON.stringify(this.get()));
    this.set(JSON.parse(this.redoStack.pop()));
    this.notify();
    return true;
  }
  clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.notify();
  }
}
