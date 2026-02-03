import path from 'node:path';
import os from 'node:os';
import { z } from 'zod';
import { CopilotMultiConfigSchema } from './schema.ts';
import type { CopilotMultiConfig } from './schema.ts';
export type { CopilotMultiConfig } from './schema.ts';

const CONFIG_FILE = 'copilot-multi.json';

type ConfigSource = {
  path: string;
  data: Record<string, unknown>;
};

async function readConfig(filePath: string): Promise<ConfigSource | null> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) return null;
  const parsed = z.record(z.string(), z.unknown()).safeParse(await file.json());
  if (!parsed.success) return null;
  return { path: filePath, data: parsed.data };
}

function mergeConfig(sources: ConfigSource[]): Record<string, unknown> {
  return sources.reduce<Record<string, unknown>>((acc, source) => {
    return { ...acc, ...source.data };
  }, {});
}

export async function loadConfig(projectDir: string): Promise<CopilotMultiConfig> {
  const globalPath = path.join(os.homedir(), '.config', 'opencode', CONFIG_FILE);
  const projectPath = path.join(projectDir, '.opencode', CONFIG_FILE);

  const sources = [await readConfig(globalPath), await readConfig(projectPath)].filter(
    (item): item is ConfigSource => Boolean(item),
  );

  const merged = mergeConfig(sources);
  return CopilotMultiConfigSchema.parse(merged);
}
