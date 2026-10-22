"use client";

import React from "react";
import { Undo2, Redo2 } from "lucide-react";

export interface UndoRedoButtonsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  undoCount?: number;
  redoCount?: number;
  size?: "sm" | "md" | "lg";
  variant?: "floating" | "inline" | "bar";
  showLabel?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function UndoRedoButtons({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  undoCount = 0,
  redoCount = 0,
  size = "md",
  variant = "inline",
  showLabel = true,
  className = "",
  style,
}: UndoRedoButtonsProps) {
  return (
    <div
      className={`admin-undo-redo-group variant-${variant} size-${size} ${className}`}
      role="group"
      aria-label="Undo and redo changes"
      style={style}
    >
      <button
        type="button"
        className={`admin-undo-btn ${canUndo ? "is-active" : "is-disabled"}`}
        onClick={onUndo}
        disabled={!canUndo}
        title={canUndo ? `Undo last change (Ctrl+Z) — ${undoCount} step${undoCount === 1 ? "" : "s"}` : "Nothing to undo"}
        aria-label="Undo last change"
      >
        <Undo2 size={size === "sm" ? 14 : size === "lg" ? 18 : 16} className="undo-icon" />
        {showLabel && <span className="undo-text">Undo</span>}
        {undoCount > 0 && <span className="undo-badge">{undoCount}</span>}
      </button>

      <span className="undo-redo-divider" aria-hidden="true" />

      <button
        type="button"
        className={`admin-redo-btn ${canRedo ? "is-active" : "is-disabled"}`}
        onClick={onRedo}
        disabled={!canRedo}
        title={canRedo ? `Redo change (Ctrl+Y) — ${redoCount} step${redoCount === 1 ? "" : "s"}` : "Nothing to redo"}
        aria-label="Redo change"
      >
        <Redo2 size={size === "sm" ? 14 : size === "lg" ? 18 : 16} className="redo-icon" />
        {showLabel && <span className="redo-text">Redo</span>}
        {redoCount > 0 && <span className="redo-badge">{redoCount}</span>}
      </button>
    </div>
  );
}
