import { useCallback, useRef, useState } from "react";
import { t } from "ttag";

import { skipToken, useExtractTablesQuery } from "metabase/api";
import { useDebouncedValue } from "metabase/common/hooks/use-debounced-value";
import type { MetabotPromptInputRef } from "metabase/metabot";
import {
  type SelectedTable,
  TablePillsInput,
} from "metabase/metabot/components/MetabotInlineSQLPrompt/TablePillsInput";
import { MetabotPromptInput } from "metabase/metabot/components/MetabotPromptInput";
import { PLUGIN_METABOT } from "metabase/plugins";
import { Box, Button, Flex, Icon, Loader, Modal, Text } from "metabase/ui";
import * as Lib from "metabase-lib";
import type Question from "metabase-lib/v1/Question";
import type { ReferencedEntityId } from "metabase-types/api";

import { useAIGenerateQuestionInternals } from "./AIGenerateQuestionContext";
import S from "./AIGenerateQuestionModal.module.css";

interface AIGenerateQuestionModalProps {
  question: Question;
  updateQuestion: (
    question: Question,
    opts?: { run?: boolean },
  ) => Promise<void> | void;
}

export function AIGenerateQuestionModal({
  question,
  updateQuestion,
}: AIGenerateQuestionModalProps) {
  const { isModalOpen, closeModal } = useAIGenerateQuestionInternals();

  if (!isModalOpen) {
    return null;
  }

  return (
    <AIGenerateQuestionModalContent
      question={question}
      updateQuestion={updateQuestion}
      closeModal={closeModal}
    />
  );
}

interface AIGenerateQuestionModalContentProps {
  question: Question;
  updateQuestion: (
    question: Question,
    opts?: { run?: boolean },
  ) => Promise<void> | void;
  closeModal: () => void;
}

function AIGenerateQuestionModalContent({
  question,
  updateQuestion,
  closeModal,
}: AIGenerateQuestionModalContentProps) {
  const { setGeneratedSql, setRejectFn } = useAIGenerateQuestionInternals();

  const promptInputRef = useRef<MetabotPromptInputRef>(null);
  const [promptValue, setPromptValue] = useState("");
  const [selectedTables, setSelectedTables] = useState<SelectedTable[]>([]);

  const query = question.query();
  const { isNative } = Lib.queryDisplayInfo(query);
  const databaseId = question.databaseId();
  const existingSql = isNative ? Lib.rawNativeQuery(query) : "";
  const hasExistingSql = existingSql.trim().length > 0;

  const debouncedSql = useDebouncedValue(existingSql.trim(), 1000);
  const { data: extractedTablesData } = useExtractTablesQuery(
    databaseId && debouncedSql
      ? { database_id: databaseId, sql: debouncedSql }
      : skipToken,
  );

  const handleClose = useCallback(() => {
    closeModal();
    setPromptValue("");
  }, [closeModal]);

  const handleCloseRef = useRef(handleClose);
  handleCloseRef.current = handleClose;

  const {
    isLoading,
    error,
    generate,
    cancelRequest,
    reject,
    suggestionModels,
  } = PLUGIN_METABOT.useMetabotSQLSuggestion({
    databaseId,
    bufferId: "ai-modal",
    onGenerated: (res) => {
      if (res?.sql) {
        if (isNative) {
          setGeneratedSql(res.sql);
          setRejectFn(() => reject);
        } else {
          // For structured queries, create a fresh native query
          const database = question.database();
          if (database) {
            const metadataProvider = Lib.metadataProvider(
              database.id,
              question.metadata(),
            );
            const newQuery = Lib.nativeQuery(
              database.id,
              metadataProvider,
              res.sql,
            );
            const newQuestion = question.setQuery(newQuery);
            updateQuestion(newQuestion, { run: true });
          }
        }
        handleCloseRef.current();
      }
    },
  });

  const isSubmitDisabled = !promptValue.trim() || isLoading || !databaseId;

  const handleSubmit = useCallback(async () => {
    const prompt = promptInputRef.current?.getValue?.().trim() ?? "";
    if (!prompt) {
      return;
    }
    const referencedEntities: ReferencedEntityId[] = selectedTables.map(
      (table) => ({
        model: "table" as const,
        id: table.id,
      }),
    );
    generate({
      prompt,
      sourceSql: hasExistingSql ? existingSql : undefined,
      referencedEntities,
    });
  }, [generate, selectedTables, hasExistingSql, existingSql]);

  const handleCloseAndCancel = useCallback(() => {
    cancelRequest();
    handleClose();
  }, [cancelRequest, handleClose]);

  const title = hasExistingSql
    ? t`Edit question with AI`
    : t`Generate question with AI`;

  return (
    <Modal
      opened
      onClose={handleCloseAndCancel}
      title={title}
      size="lg"
      data-testid="ai-generate-question-modal"
    >
      <Flex direction="column" gap="md">
        {!databaseId && (
          <Text c="text-secondary" fz="sm">
            {t`Please select a database for your question first.`}
          </Text>
        )}
        {databaseId && (
          <>
            <Box>
              <TablePillsInput
                disabled={isLoading}
                databaseId={databaseId}
                selectedTables={
                  selectedTables.length > 0
                    ? selectedTables
                    : (extractedTablesData?.tables ?? [])
                }
                onChange={setSelectedTables}
                onEnterPress={() => promptInputRef.current?.focus()}
              />
            </Box>
            <Box className={S.promptContainer}>
              <MetabotPromptInput
                ref={promptInputRef}
                value={promptValue}
                placeholder={
                  hasExistingSql
                    ? t`Describe how to edit the current query...`
                    : t`Describe the question you want to generate...`
                }
                autoFocus
                disabled={isLoading}
                onChange={setPromptValue}
                onStop={handleCloseAndCancel}
                onSubmit={handleSubmit}
                suggestionConfig={{
                  suggestionModels,
                  searchOptions: databaseId
                    ? { table_db_id: databaseId }
                    : undefined,
                }}
              />
            </Box>
            {error && (
              <Text c="error" fz="sm" data-testid="ai-generate-error">
                {error}
              </Text>
            )}
            <Flex justify="flex-end" gap="sm">
              <Button variant="subtle" onClick={handleCloseAndCancel}>
                {t`Cancel`}
              </Button>
              <Button
                variant="filled"
                disabled={isSubmitDisabled}
                onClick={handleSubmit}
                data-testid="ai-generate-submit"
                leftSection={
                  isLoading ? <Loader size="xs" /> : <Icon name="sparkles" />
                }
              >
                {isLoading ? t`Generating...` : t`Generate`}
              </Button>
            </Flex>
          </>
        )}
      </Flex>
    </Modal>
  );
}
