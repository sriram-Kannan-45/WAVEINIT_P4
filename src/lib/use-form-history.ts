"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { UseFormReset, UseFormGetValues, UseFormWatch, FieldValues } from "react-hook-form";

export interface UseFormHistoryOptions<T extends FieldValues> {
  getValues: UseFormGetValues<T>;
  reset: UseFormReset<T>;
  watch?: UseFormWatch<T>;
  maxDepth?: number;
  debounceMs?: number;
  enableShortcuts?: boolean;
}

export interface UseFormHistoryReturn<T extends FieldValues> {
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
  undo: () => void;
  redo: () => void;
  takeSnapshot: (customValues?: T) => void;
  clearHistory: () => void;
}

function deepClone<T>(val: T): T {
  if (val === undefined || val === null) return val;
  try {
    return JSON.parse(JSON.stringify(val));
  } catch {
    return val;
  }
}

function isEqual<T>(a: T, b: T): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return a === b;
  }
}

export function useFormHistory<T extends FieldValues>({
  getValues,
  reset,
  watch,
  maxDepth = 30,
  debounceMs = 350,
  enableShortcuts = true,
}: UseFormHistoryOptions<T>): UseFormHistoryReturn<T> {
  const [past, setPast] = useState<T[]>([]);
  const [future, setFuture] = useState<T[]>([]);

  const presentRef = useRef<T>(deepClone(getValues()));
  const isRestoringRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize present state on initial mount
  useEffect(() => {
    presentRef.current = deepClone(getValues());
  }, [getValues]);

  const takeSnapshot = useCallback(
    (customValues?: T) => {
      if (isRestoringRef.current) return;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      const nextVal = deepClone(customValues ?? getValues());
      if (isEqual(nextVal, presentRef.current)) return;

      const previousPresent = deepClone(presentRef.current);
      setPast((prev) => {
        const nextPast = [...prev, previousPresent];
        return nextPast.length > maxDepth ? nextPast.slice(nextPast.length - maxDepth) : nextPast;
      });
      presentRef.current = nextVal;
      setFuture([]); // clear redo on new discrete edit
    },
    [getValues, maxDepth],
  );

  // Watch for continuous changes with debouncing
  useEffect(() => {
    if (!watch) return;

    const subscription = watch(() => {
      if (isRestoringRef.current) {
        return;
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        if (isRestoringRef.current) return;
        const currentData = deepClone(getValues());
        if (isEqual(currentData, presentRef.current)) return;

        const previousPresent = deepClone(presentRef.current);
        setPast((prev) => {
          const nextPast = [...prev, previousPresent];
          return nextPast.length > maxDepth
            ? nextPast.slice(nextPast.length - maxDepth)
            : nextPast;
        });
        presentRef.current = currentData;
        setFuture([]);
      }, debounceMs);
    });

    return () => {
      subscription.unsubscribe();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [watch, getValues, maxDepth, debounceMs]);

  const undo = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast;

      const previous = prevPast[prevPast.length - 1];
      const nextPast = prevPast.slice(0, prevPast.length - 1);
      const currentPresent = deepClone(presentRef.current);

      isRestoringRef.current = true;
      reset(deepClone(previous));
      presentRef.current = deepClone(previous);

      setFuture((prevFuture) => [currentPresent, ...prevFuture]);

      setTimeout(() => {
        isRestoringRef.current = false;
      }, 50);

      return nextPast;
    });
  }, [reset]);

  const redo = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;

      const next = prevFuture[0];
      const nextFuture = prevFuture.slice(1);
      const currentPresent = deepClone(presentRef.current);

      isRestoringRef.current = true;
      reset(deepClone(next));
      presentRef.current = deepClone(next);

      setPast((prevPast) => [...prevPast, currentPresent]);

      setTimeout(() => {
        isRestoringRef.current = false;
      }, 50);

      return nextFuture;
    });
  }, [reset]);

  const clearHistory = useCallback(() => {
    setPast([]);
    setFuture([]);
    presentRef.current = deepClone(getValues());
  }, [getValues]);

  // Keyboard shortcut listener (Ctrl+Z / Cmd+Z for undo, Ctrl+Y or Ctrl+Shift+Z for redo)
  useEffect(() => {
    if (!enableShortcuts) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      if (!modifier) return;

      const target = e.target as HTMLElement | null;
      const isTyping = Boolean(target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable));

      // Ctrl+Z / Cmd+Z (undo)
      if (e.key.toLowerCase() === "z" && !e.shiftKey) {
        if (!isTyping && past.length > 0) {
          e.preventDefault();
          undo();
        }
      }
      // Ctrl+Y or Ctrl+Shift+Z / Cmd+Shift+Z (redo)
      else if (
        (e.key.toLowerCase() === "y" && !e.shiftKey) ||
        (e.key.toLowerCase() === "z" && e.shiftKey)
      ) {
        if (!isTyping && future.length > 0) {
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enableShortcuts, past.length, future.length, undo, redo]);

  return {
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undoCount: past.length,
    redoCount: future.length,
    undo,
    redo,
    takeSnapshot,
    clearHistory,
  };
}
