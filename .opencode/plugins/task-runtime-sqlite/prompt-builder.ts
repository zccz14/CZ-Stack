export type PromptBuilder = {
  kind: "sqlite-task-runtime-prompt-builder";
};

export const createPromptBuilder = (): PromptBuilder => ({
  kind: "sqlite-task-runtime-prompt-builder",
});
