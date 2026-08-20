import { Context, Effect, Layer, Ref } from "effect";
import { FileSystem } from "effect/FileSystem";
import { Path } from "effect/Path";
import { MachineLoader, ORCHESTRATE_PRESET, type MachineConfig } from "./MachineLoader";
import { EventLog, type EventLogContract } from "./EventLog";
import { Config, ConfigNotFound, type ConfigContract } from "./Config";
import { ProjectRegistry } from "./ProjectRegistry";

export interface ProjectServices {
  readonly eventLog: EventLogContract;
  readonly machine: typeof MachineConfig.Type;
  readonly outDir: string;
  readonly terminalLabel: string;
}

export interface ProjectScopeContract {
  readonly forProject: (root: string) => Effect.Effect<ProjectServices>;
  readonly forActiveProject: () => Effect.Effect<ProjectServices>;
}

export class ProjectScope extends Context.Service<ProjectScope, ProjectScopeContract>()(
  "@anakmagang/ProjectScope",
) {
  static readonly layer = Layer.effect(
    ProjectScope,
    Effect.gen(function* () {
      const fs = yield* FileSystem;
      const pathService = yield* Path;
      const startupConfig = yield* Config;
      const loader = yield* MachineLoader;
      const registry = yield* ProjectRegistry;
      const startupEventLog = yield* EventLog;

      const startupMachine = yield* loader.loadFromFile(startupConfig.configPath).pipe(
        Effect.provideService(FileSystem, fs),
        Effect.orElseSucceed(() => ORCHESTRATE_PRESET),
      );

      const startupServices: ProjectServices = {
        eventLog: startupEventLog,
        machine: startupMachine,
        outDir: startupConfig.outDir,
        terminalLabel: startupConfig.terminalLabel,
      };

      const cache = yield* Ref.make<Map<string, ProjectServices>>(
        new Map([[startupConfig.root, startupServices]]),
      );

      const buildServices = (root: string): Effect.Effect<ProjectServices> =>
        Effect.gen(function* () {
          const configPath = pathService.join(root, ".anakmagang", "config.yaml");
          const outDir = pathService.join(root, ".anakmagang", "out");

          const machine = yield* loader.loadFromFile(configPath).pipe(
            Effect.provideService(FileSystem, fs),
            Effect.orElseSucceed(() => ORCHESTRATE_PRESET),
          );

          const terminalPhase =
            machine.phases.length > 0
              ? (machine.phases.find((p) => p.next === null)?.id ?? "completion")
              : "completion";

          const initialPhase =
            machine.phases.length > 0 ? (machine.phases[0]?.id ?? "setup") : "setup";

          const miniConfig: ConfigContract = {
            root,
            projectName: pathService.basename(root),
            configPath,
            outDir,
            socketPath: pathService.join(root, ".anakmagang", "events.sock"),
            webSocketPath: startupConfig.webSocketPath,
            readConfig: fs.readFileString(configPath).pipe(
              Effect.mapError(
                () =>
                  new ConfigNotFound({
                    path: configPath,
                    message: `File not found: ${configPath}`,
                  }),
              ),
            ),
            client: "claude",
            providers: [],
            initialPhase,
            terminalPhase,
            terminalLabel: "completed",
            promises: startupConfig.promises,
            phaseIds: machine.phases.map((p) => p.id),
          };

          const eventLog = yield* Effect.scoped(
            Layer.build(
              Layer.fresh(EventLog.bare).pipe(
                Layer.provide(Layer.succeed(Config, miniConfig)),
                Layer.provide(Layer.succeed(FileSystem, fs)),
                Layer.provide(Layer.succeed(Path, pathService)),
              ),
            ),
          ).pipe(Effect.map((ctx) => Context.get(ctx, EventLog)));

          return {
            eventLog,
            machine,
            outDir,
            terminalLabel: "completed",
          } satisfies ProjectServices;
        });

      const forProject = (root: string): Effect.Effect<ProjectServices> =>
        Effect.gen(function* () {
          const current = yield* Ref.get(cache);
          const existing = current.get(root);
          if (existing !== undefined) return existing;

          const services = yield* buildServices(root);
          yield* Ref.update(cache, (m) => {
            const next = new Map(m);
            next.set(root, services);
            return next;
          });
          return services;
        });

      const forActiveProject = (): Effect.Effect<ProjectServices> =>
        Effect.gen(function* () {
          const activeId = yield* registry.activeProjectId();
          const projects = yield* registry.list();
          const active = projects.find((p) => p.id === activeId);
          if (active === undefined) return startupServices;
          return yield* forProject(active.root);
        });

      return ProjectScope.of({ forProject, forActiveProject });
    }),
  );
}
