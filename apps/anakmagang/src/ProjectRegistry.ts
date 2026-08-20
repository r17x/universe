import { Context, Effect, Layer, Ref } from "effect";
import { Path } from "effect/Path";

export interface ProjectEntry {
  readonly id: string;
  readonly name: string;
  readonly root: string;
}

export interface ProjectRegistryContract {
  readonly register: (root: string) => Effect.Effect<ProjectEntry>;
  readonly list: () => Effect.Effect<ReadonlyArray<ProjectEntry>>;
  readonly activeProjectId: () => Effect.Effect<string>;
  readonly setActive: (id: string) => Effect.Effect<void>;
}

const hashRoot = (root: string): string => Bun.hash(root).toString(16).slice(0, 8);

export class ProjectRegistry extends Context.Service<ProjectRegistry, ProjectRegistryContract>()(
  "@anakmagang/ProjectRegistry",
) {
  static readonly layer = Layer.effect(
    ProjectRegistry,
    Effect.gen(function* () {
      const path = yield* Path;
      const projects = yield* Ref.make<ReadonlyArray<ProjectEntry>>([]);
      const activeId = yield* Ref.make<string>("");

      return ProjectRegistry.of({
        register: (root: string) =>
          Effect.gen(function* () {
            const id = hashRoot(root);
            const name = path.basename(root);
            const entry: ProjectEntry = { id, name, root };
            yield* Ref.update(projects, (ps) => {
              if (ps.some((p) => p.id === id)) return ps;
              return [...ps, entry];
            });
            yield* Ref.update(activeId, (current) => (current === "" ? id : current));
            return entry;
          }),

        list: () => Ref.get(projects),

        activeProjectId: () => Ref.get(activeId),

        setActive: (id: string) => Ref.set(activeId, id),
      });
    }),
  );
}
