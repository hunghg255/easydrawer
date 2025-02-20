import path from 'path';
import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: ['src/index'],
  clean: true,
  declaration: false,
  rollup: {
    emitCJS: false,
    esbuild: {
      minify: false,
    },
  },
  failOnWarn: false,
  alias: {
    '~': path.resolve(__dirname, 'src'),
  }
});
