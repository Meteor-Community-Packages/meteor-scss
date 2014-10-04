Package.describe({
  summary: 'Style with attitude.',
  version: "0.9.5",
  git: "https://github.com/fourseven/meteor-scss.git"
});

Package._transitional_registerBuildPlugin({
  name: 'meteor-scss',
  use: [],
  sources: [
    'plugin/compile-scss.js'
  ],
  npmDependencies: {
    'node-sass': '0.9.3',
    'lodash': '2.4.1'
  }
});

Package.on_test(function (api) {
  api.use(['test-helpers',
           'tinytest',
           'jquery',
           'templating']);
  api.use(['meteor-scss']);
  api.add_files(['scss_tests.scss', 'scss_tests.html', 'scss_tests.js'], 'client');
});
