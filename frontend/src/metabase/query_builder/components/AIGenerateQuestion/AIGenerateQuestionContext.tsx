import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

interface AIGenerateQuestionContextValue {
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  generatedSql: string | undefined;
  clearGeneratedSql: () => void;
  rejectGeneratedSql: () => void;
}

const AIGenerateQuestionContext =
  createContext<AIGenerateQuestionContextValue | null>(null);

export function AIGenerateQuestionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generatedSql, setGeneratedSql] = useState<string | undefined>(
    undefined,
  );
  // Store reject callback so ViewNativeQueryEditor can call the hook's reject
  const [rejectFn, setRejectFn] = useState<(() => void) | undefined>(undefined);

  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  const clearGeneratedSql = useCallback(() => setGeneratedSql(undefined), []);

  const rejectGeneratedSql = useCallback(() => {
    setGeneratedSql(undefined);
    rejectFn?.();
  }, [rejectFn]);

  const value = useMemo(
    () => ({
      isModalOpen,
      openModal,
      closeModal,
      generatedSql,
      clearGeneratedSql,
      rejectGeneratedSql,
      _setGeneratedSql: setGeneratedSql,
      _setRejectFn: setRejectFn,
    }),
    [
      isModalOpen,
      openModal,
      closeModal,
      generatedSql,
      clearGeneratedSql,
      rejectGeneratedSql,
    ],
  );

  return (
    <AIGenerateQuestionContext.Provider value={value}>
      {children}
    </AIGenerateQuestionContext.Provider>
  );
}

export function useAIGenerateQuestionContext() {
  const context = useContext(AIGenerateQuestionContext);
  if (!context) {
    throw new Error(
      "useAIGenerateQuestionContext must be used within AIGenerateQuestionProvider",
    );
  }
  return context;
}

/** @internal - used by AIGenerateQuestionModal to write generated SQL */
export function useAIGenerateQuestionInternals() {
  const context = useContext(AIGenerateQuestionContext);
  if (!context) {
    throw new Error(
      "useAIGenerateQuestionInternals must be used within AIGenerateQuestionProvider",
    );
  }
  // Access the internal setters via the context value object
  const contextAny = context as AIGenerateQuestionContextValue & {
    _setGeneratedSql: (sql: string | undefined) => void;
    _setRejectFn: (fn: (() => void) | undefined) => void;
  };
  return {
    ...context,
    setGeneratedSql: contextAny._setGeneratedSql,
    setRejectFn: contextAny._setRejectFn,
  };
}
