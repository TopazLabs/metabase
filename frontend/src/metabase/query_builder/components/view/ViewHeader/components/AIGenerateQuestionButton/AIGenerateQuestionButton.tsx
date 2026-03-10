import { t } from "ttag";

import { ToolbarButton } from "metabase/common/components/ToolbarButton";
import { useAIGenerateQuestionContext } from "metabase/query_builder/components/AIGenerateQuestion";

export function AIGenerateQuestionButton() {
  const { openModal } = useAIGenerateQuestionContext();

  return (
    <ToolbarButton
      icon="sparkles"
      tooltipLabel={t`Generate or edit with AI`}
      onClick={openModal}
      data-testid="ai-generate-question-button"
    />
  );
}
