# Sass for Meteor
This is a Sass build plugin for Meteor. It compiles Sass files with node-sass and it has options to control the load order of Sass files and use Autoprefixer on the generated CSS.

## Meteor 1.2
Version 3.3.3 is built for Meteor 1.2, and has been largely re-written. Not all older features are present, but most will return (pull requests welcome).

### Sourcemaps
These are on by default.

### Autoprefixer
As of Meteor 1.2 autoprefixer should preferably be installed as a separate plugin, and is no longer included with this package.
However, note that due to [certain limitations](https://github.com/meteor/meteor/issues/5219) of the current Meteor build system, no autoprefix plugin is available at this moment.

## Installation

Install using Meteor's package management system:

```bash
> meteor add fourseven:scss
```

If you want to use it for your package, add it in your package control file's
`onUse` block:

```javascript
Package.onUse(function (api) {
  ...
  api.use('fourseven:scss');
  ...
});
```

## Usage
Without any additional configuration after installation, this package automatically finds all `.scss` and `.sass` files in your project, compiles them with [node-sass](https://github.com/sass/node-sass), and includes the resulting CSS in the application bundle that Meteor sends to the client. The files can be anywhere in your project.

### File types

There are two different types of files recognized by this package:

- Sass sources (all `*.scss` and `*.sass` files that are not imports)
- Sass imports/partials:
  * files that are prefixed with an underscore `_`
  * marked as `isImport: true` in the package's `package.js` file:
    `api.addFiles('x.scss', 'client', {isImport: true})`

The source files are compiled automatically. The imports are not loaded by
themselves; you need to import them from one of the source files to use them.

The imports are intended to keep shared mixins and variables for your project,
or to allow your package to provide several components which your package's
users can opt into one by one.

Each compiled source file produces a separate CSS file.  (The
`standard-minifiers` package merges them into one file afterwards.)

### Importing

You can use the regular `@import` syntax to import any Sass files: sources or
imports.

Besides the usual way of importing files based on the relative path in the same
package (or app), you can also import files from other packages or apps with the
following syntax.

Importing styles from a different package:

```scss
@import "{my-package:pretty-buttons}/buttons/_styles.scss"

.my-button {
  // use the styles imported from a package
  @extend .pretty-button;
}
```

Importing styles from the target app:

```scss
@import "{}/client/styles/imports/colors.scss"

.my-nav {
  // use a color from the app style pallete
  background-color: @primary-branding-color;
}
```

## LibSass vs Ruby Sass
Please note that this project uses [LibSass](https://github.com/hcatlin/libsass). LibSass is a C++ implementation of the Ruby Sass compiler. It has most of the features of the Ruby version, but not all of them. Things are improving, so please be patient. Before you ask, I have no intention of making a version of this package that links to the Ruby version instead.

For a quick rundown on what libsass does and doesn't (currently) do, [check here](http://sass-compatibility.github.io/).
