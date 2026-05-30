/** A registrable VS Code command. `id` must match a package.json contribution. */
export interface ICommand {
  readonly id: string;
  execute(): void | Promise<void>;
}
