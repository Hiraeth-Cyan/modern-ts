import {OptionDefaults} from 'typedoc';

/** @type {Partial<import('typedoc').TypeDocOptions>} */
const config = {
  entryPoints: ['./src/index.ts'],
  exclude: [
    '**/__benchmark__/**',
    '**/__examples__/**',
    '**/*.test.ts',

    '**/*.test-d.ts',
  ],
  out: './docs/api/',
  plugin: ['typedoc-plugin-markdown'],
  externalSymbolLinkMappings: {
    typescript: {
      Promise:
        'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise',
      AbortSignal:
        'https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal',
      Disposable:
        'https://github.com/microsoft/TypeScript/blob/main/src/lib/esnext.disposable.d.ts',
      AsyncDisposable:
        'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/asyncDispose',
    },
  },
  excludeExternals: true,
  excludePrivate: true,
  excludeProtected: true,
  excludeReferences: true,
  excludeInternal: false,
  hideBreadcrumbs: true,
  categorizeByGroup: false,
  searchInComments: true,
  gitRevision: 'main',
  readme: 'none',
  blockTags: [...OptionDefaults.blockTags, '@note'],
};

export default config;
