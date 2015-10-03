Package.describe({
  summary: 'Style with attitude. Sass and SCSS support for Meteor.js (with autoprefixer and sourcemaps).',
  version: "3.4.0-beta1",
  git: "https://github.com/fourseven/meteor-scss.git",
  name: "fourseven:scss"
});

Package.registerBuildPlugin({
  name: "compileScssBatch",
  use: ['caching-compiler@1.0.0', 'ecmascript@0.1.5', 'underscore@1.0.4'],
  sources: [
    'plugin/compile-scss.js'
  ],
  npmDependencies: {
    'node-sass': '3.4.0-beta1'
  }
});

Package.onUse(function (api) {
  api.versionsFrom("1.2.0.1");
  api.use('isobuild:compiler-plugin@1.0.0');
});

Package.on_test(function (api) {
  api.use(['test-helpers',
           'tinytest',
           'jquery',
           'templating']);

  api.use(['fourseven:scss']);

  api.add_files(['test/tests.html', 'test/tests.js'], 'client');

  // Test for .scss
  api.add_files(['test/scss/main.scss'], 'client');
  api.add_files(['test/scss/_partial.scss'], 'client');

  // Tests for .sass
  // Enable when `indentedSyntax` is fixed in node-sass
  // Also see `package.js`
  //api.add_files(['test/sass/main.sass'], 'client');
  //api.add_files(['test/sass/_partial.sass'], 'client');
});
