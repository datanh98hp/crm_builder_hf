/** Architecture rules for the modular monolith. Run with `npm run check:arch`. */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies make modules impossible to split or test in isolation.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'infrastructure-must-not-depend-on-modules',
      severity: 'error',
      comment: 'common/, config/, database/, redis/ and workers/ are shared infrastructure; business modules depend on them, never the reverse.',
      from: { path: '^src/(common|config|database|redis|workers)/', pathNot: '^src/workers/worker\\.module\\.ts$' },
      to: { path: '^src/modules/' },
    },
    {
      name: 'modules-use-public-api-only',
      severity: 'error',
      comment:
        'A module may import another module only through its public entry (index.ts for the HTTP side, jobs.ts for background jobs), never its services, repositories or entities.',
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/[^/]+/', pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/(index|jobs)\\.ts$'] },
    },
    {
      name: 'worker-module-uses-jobs-entries-only',
      severity: 'error',
      comment: 'The worker composition root pulls in each module through its jobs.ts entry, never the HTTP side.',
      from: { path: '^src/workers/' },
      to: { path: '^src/modules/', pathNot: '^src/modules/[^/]+/jobs\\.ts$' },
    },
    {
      name: 'modules-must-not-import-entrypoints',
      severity: 'error',
      from: { path: '^src/(modules|common|config|database|redis|workers)/', pathNot: '^src/workers/worker\\.module\\.ts$' },
      to: { path: '^src/(main|worker|app\\.module|app\\.setup)\\.ts$' },
    },
    {
      name: 'src-must-not-import-tests',
      severity: 'error',
      from: { path: '^src/' },
      to: { path: '^test/' },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '\\.spec\\.ts$' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default', 'types'], extensions: ['.ts', '.js'] },
  },
};
