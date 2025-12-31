import React, { createContext, useContext, useState, useRef, ReactNode, useCallback } from 'react';
import BottomSheet from '@gorhom/bottom-sheet';
import { EditorPick } from '@/types/editorsPicks';

interface EditorPickSheetContextType {
  isOpen: boolean;
  editingPick: EditorPick | null;
  openCreateSheet: () => void;
  openEditSheet: (pick: EditorPick) => void;
  closeSheet: () => void;
  bottomSheetRef: React.RefObject<BottomSheet>;
  onPickSaved: (() => void) | null;
  setOnPickSaved: (callback: (() => void) | null) => void;
}

const EditorPickSheetContext = createContext<EditorPickSheetContextType | undefined>(undefined);

export function EditorPickSheetProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingPick, setEditingPick] = useState<EditorPick | null>(null);
  const [onPickSaved, setOnPickSaved] = useState<(() => void) | null>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);

  const openCreateSheet = useCallback(() => {
    setEditingPick(null);
    setIsOpen(true);
    // Use setTimeout to ensure state is updated before opening
    setTimeout(() => {
      bottomSheetRef.current?.snapToIndex(0);
    }, 50);
  }, []);

  const openEditSheet = useCallback((pick: EditorPick) => {
    setEditingPick(pick);
    setIsOpen(true);
    setTimeout(() => {
      bottomSheetRef.current?.snapToIndex(0);
    }, 50);
  }, []);

  const closeSheet = useCallback(() => {
    bottomSheetRef.current?.close();
    // Delay state reset to allow animation to complete
    setTimeout(() => {
      setIsOpen(false);
      setEditingPick(null);
    }, 300);
  }, []);

  return (
    <EditorPickSheetContext.Provider
      value={{
        isOpen,
        editingPick,
        openCreateSheet,
        openEditSheet,
        closeSheet,
        bottomSheetRef,
        onPickSaved,
        setOnPickSaved,
      }}
    >
      {children}
    </EditorPickSheetContext.Provider>
  );
}

export function useEditorPickSheet() {
  const context = useContext(EditorPickSheetContext);
  if (context === undefined) {
    throw new Error('useEditorPickSheet must be used within an EditorPickSheetProvider');
  }
  return context;
}
