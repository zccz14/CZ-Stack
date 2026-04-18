export type SessionRuntime = {
  kind: "sqlite-task-runtime-session";
};

export const createSessionRuntime = (): SessionRuntime => ({
  kind: "sqlite-task-runtime-session",
});
