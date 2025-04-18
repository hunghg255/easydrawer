/* eslint-disable @typescript-eslint/ban-ts-comment */

import { Erase } from '~/draw/lib';

import type Command from './commands/Command';
import type Editor from './Editor';
import { EditorEventType, UndoEventType } from './types';

type AnnounceRedoCallback = (command: Command) => void;
type AnnounceUndoCallback = (command: Command) => void;

class UndoRedoHistory {
  #undoStack: Command[];
  #redoStack: Command[];

  private readonly maxUndoRedoStackSize: number = 700;

  // @internal
  public constructor(
    private readonly editor: Editor,
    private announceRedoCallback: AnnounceRedoCallback,
    private announceUndoCallback: AnnounceUndoCallback,
  ) {
    this.#undoStack = [];
    this.#redoStack = [];
  }

  private fireUpdateEvent(stackUpdateType: UndoEventType, triggeringCommand: Command) {
    this.editor.notifier.dispatch(EditorEventType.UndoRedoStackUpdated, {
      kind: EditorEventType.UndoRedoStackUpdated,
      undoStackSize: this.#undoStack.length,
      redoStackSize: this.#redoStack.length,

      command: triggeringCommand,
      stackUpdateType,
    });
  }

  // Adds the given command to this and applies it to the editor.
  public push(command: Command, apply = true) {
    if (apply) {
      command.apply(this.editor);
    }
    this.#undoStack.push(command);

    for (const elem of this.#redoStack) {
      elem.onDrop(this.editor);
    }
    this.#redoStack = [];

    if (this.#undoStack.length > this.maxUndoRedoStackSize) {
      const removeAtOnceCount = Math.ceil(this.maxUndoRedoStackSize / 100);
      const removedElements = this.#undoStack.splice(0, removeAtOnceCount);
      removedElements.forEach((elem) => elem.onDrop(this.editor));
    }

    this.fireUpdateEvent(UndoEventType.CommandDone, command);
    this.editor.notifier.dispatch(EditorEventType.CommandDone, {
      kind: EditorEventType.CommandDone,
      command,
    });
  }

  // Remove the last command from this' undo stack and apply it.
  public undo(): void | Promise<void> {
    const command = this.#undoStack.pop();
    if (command) {
      this.#redoStack.push(command);
      const result = command.unapply(this.editor);
      this.announceUndoCallback(command);

      this.fireUpdateEvent(UndoEventType.CommandUndone, command);
      this.editor.notifier.dispatch(EditorEventType.CommandUndone, {
        kind: EditorEventType.CommandUndone,
        command,
      });

      return result;
    }
  }

  public redo(): void | Promise<void> {
    const command = this.#redoStack.pop();
    if (command) {
      this.#undoStack.push(command);
      const result = command.apply(this.editor);
      this.announceRedoCallback(command);

      this.fireUpdateEvent(UndoEventType.CommandRedone, command);
      this.editor.notifier.dispatch(EditorEventType.CommandDone, {
        kind: EditorEventType.CommandDone,
        command,
      });

      return result;
    }
  }

  public get undoStackSize(): number {
    return this.#undoStack.length;
  }

  public get redoStackSize(): number {
    return this.#redoStack.length;
  }

  public clearAllDraft(): void {
    if (!this.#undoStack?.length) {
      return;
    }

    const elementRemoved: any = [];
    const elementNotRemoved: any = [];

    this.#undoStack.forEach((elem) => {
      //@ts-expect-error
      if (elem?.toRemove?.length) {
      //@ts-expect-error
        elem?.toRemove?.forEach((it) => {
          elementRemoved.push(it?.id);
        });
      }
    });

    this.#undoStack.forEach((elem) => {
      //@ts-expect-error
      if (elem?.element) {
      //@ts-expect-error
        if (!elementRemoved?.includes(elem?.element?.id)) {
          //@ts-expect-error
          elementNotRemoved.push(elem?.element);
        }
      }
    });

    if (elementNotRemoved?.length) {
      this.editor.dispatch(new Erase(elementNotRemoved));
    }
  }

  public clearAllStack(): void {
    while (this.undoStackSize > 0) {
      this.undo();
    }
    this.#undoStack = [];
    this.#redoStack = [];
  }
}

export default UndoRedoHistory;
