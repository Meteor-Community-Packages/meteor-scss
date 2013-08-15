Package.describe({
  summary: "Style with attitude."
});

Package._transitional_registerBuildPlugin({
  name: "meteor-scss",
  use: [],
  sources: [
    'plugin/compile-scss.js'
  ],
  npmDependencies: {"node-sass": "0.6.4"}
});

Package.on_test(function (api) {
  api.use(['test-helpers', 'tinytest', 'less']);
  api.use(['spark']);
  api.add_files(['scss_tests.scss', 'scss_tests.js'], 'client');
});
