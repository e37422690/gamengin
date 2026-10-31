import { GameProject } from '../types/engine';

export interface HistoryEntry {
  label: string;
  timestamp: number;
  snapshot: string;
}

export class UndoRedoManager {
  private past: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];
  private readonly maxDepth: number;

  constructor(maxDepth = 50) {
    this.maxDepth = maxDepth;
  }

  public recordState(project: GameProject, actionLabel: string): void {
    const serialized = JSON.stringify(project);
    if (this.past.length > 0 && this.past[this.past.length - 1].snapshot === serialized) {
      return;
    }
    this.past.push({
      label: actionLabel,
      timestamp: Date.now(),
      snapshot: serialized,
    });
    if (this.past.length > this.maxDepth) {
      this.past.shift();
    }
    this.future = [];
  }

  public undo(currentProject: GameProject): { project: GameProject; label: string } | null {
    const previous = this.past.pop();
    if (!previous) return null;

    this.future.push({
      label: previous.label,
      timestamp: Date.now(),
      snapshot: JSON.stringify(currentProject),
    });

    return {
      project: JSON.parse(previous.snapshot) as GameProject,
      label: previous.label,
    };
  }

  public redo(currentProject: GameProject): { project: GameProject; label: string } | null {
    const next = this.future.pop();
    if (!next) return null;

    this.past.push({
      label: next.label,
      timestamp: Date.now(),
      snapshot: JSON.stringify(currentProject),
    });

    return {
      project: JSON.parse(next.snapshot) as GameProject,
      label: next.label,
    };
  }

  public canUndo(): boolean {
    return this.past.length > 0;
  }

  public canRedo(): boolean {
    return this.future.length > 0;
  }

  public getCounts(): { undoCount: number; redoCount: number; lastAction?: string } {
    return {
      undoCount: this.past.length,
      redoCount: this.future.length,
      lastAction: this.past[this.past.length - 1]?.label,
    };
  }

  public clear(): void {
    this.past = [];
    this.future = [];
  }
}
