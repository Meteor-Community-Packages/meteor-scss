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
  api.versionsFrom("1.2.0.2");
  api.use('isobuild:compiler-plugin@1.0.0');
});

Package.on_test(function (api) {
  api.use(['test-helpers',
           'tinytest']);

  api.use(['fourseven:scss']);

  // Tests for .scss
  api.addFiles(['tests/scss/_top.scss',
    'tests/scss/_top3.scss',
    'tests/scss/_not-included.scss',
    'tests/scss/dir/_in-dir.scss',
    'tests/scss/dir/_in-dir2.scss',
    'tests/scss/dir/root.scss',
    'tests/scss/dir/subdir/_in-subdir.scss']);
  api.addFiles('tests/scss/top2.scss', 'client', {isImport: true});

  // Tests for .sass
  api.addFiles(['tests/sass/_top.sass',
    'tests/sass/_top3.sass',
    'tests/sass/_not-included.sass',
    'tests/sass/dir/_in-dir.sass',
    'tests/sass/dir/_in-dir2.sass',
    'tests/sass/dir/root.sass',
    'tests/sass/dir/subdir/_in-subdir.sass']);
  api.addFiles('tests/sass/top2.sass', 'client', {isImport: true});

  api.addFiles('tests.js', 'client');

});
