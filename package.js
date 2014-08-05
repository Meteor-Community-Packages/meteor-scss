Package.describe({
  summary: 'Style with attitude.'
});

Package._transitional_registerBuildPlugin({
  name: 'meteor-scss',
  use: [],
  sources: [
    'plugin/compile-scss.js',
    'plugin/import-globbing.js'
  ],
  npmDependencies: {
    'node-sass': '0.9.3',
    'lodash': '2.4.1',
    'glob': '4.0.5',
    'chalk': '0.5.1'
  }
});

Package.on_test(function (api) {
  api.use(['test-helpers', 'tinytest']);
  api.use(['ui']);
  api.add_files(['scss_tests.scss', 'scss_tests.js'], 'client');
});
