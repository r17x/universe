export const Priority = {
  Control: 0,
  Render: 1,
  Data: 2,
} as const;

export type Priority = (typeof Priority)[keyof typeof Priority];

export type Channel = "exit" | "stderr" | "stdout";

export const channelPriority: Record<Channel, Priority> = {
  exit: Priority.Control,
  stderr: Priority.Render,
  stdout: Priority.Data,
};
