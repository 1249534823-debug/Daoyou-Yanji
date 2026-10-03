import { readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';

const { dependencies } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
);

// Nest CLI 12's ESM builder bundles workspace sources and Markdown.
// Runtime npm dependencies stay external for Node and the production image.
export default (options) => {
  options.module.rules[0].use[0].options.jsc.transform.decoratorMetadata = false;
  return {
    ...options,
    devtool: 'source-map',
    externalsPresets: { node: false },
    externals: [
      ({ request }, callback) => {
        const packageName = request?.startsWith('@')
          ? request.split('/').slice(0, 2).join('/')
          : request?.split('/')[0];
        if (
          request &&
          !request.startsWith('@daoyou/shared/') &&
          (request.startsWith('node:') ||
            builtinModules.includes(request) ||
            dependencies[packageName])
        ) {
          return callback(null, `module ${request}`);
        }
        callback();
      },
    ],
    module: {
      ...options.module,
      rules: [...options.module.rules, { test: /\.md$/, type: 'asset/source' }],
    },
  };
};
