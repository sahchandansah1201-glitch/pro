export interface CopyProductionPublicAssetsOptions {
  publicDir: string;
  outDir: string;
}

export interface CopyProductionPublicAssetsResult {
  copiedEntries: string[];
  excludedEntries: string[];
}

export function copyProductionPublicAssets(
  options: CopyProductionPublicAssetsOptions,
): CopyProductionPublicAssetsResult;

export function productionPublicAssetsPlugin(options: {
  rootDir: string;
  outDir?: string;
}): {
  name: string;
  apply: "build";
  configResolved(config: {
    root: string;
    build: { outDir: string };
  }): void;
  closeBundle(): void;
};
