# Sass for Meteor
This is a Sass build plugin for Meteor. It compiles Sass files with node-sass and it has options to control the load order of Sass files and use Autoprefixer on the generated CSS.

## Installation

Install using Meteor's package management system:

```bash
> meteor add fourseven:scss
```

## Usage
Without any additional configuration after installation, this package automatically finds all `.scss` and `.sass` files in your project, compiles them with [node-sass](https://github.com/sass/node-sass), and includes the resulting CSS in the application bundle that Meteor sends to the client. The files can be anywhere in your project.

## Meteor 1.2
Version 3.3.3 is built for Meteor 1.2, and has been largely re-written. Not all older features are present, but most will return (pull requests welcome).

### Sourcemaps
These are on by default.

### Autoprefixer
As of Meteor 1.2 autoprefixer should be installed as a separate plugin, and is no longer included with this package.


## LibSass vs Ruby Sass
Please note that this project uses [LibSass](https://github.com/hcatlin/libsass). LibSass is a C++ implementation of the Ruby Sass compiler. It has most of the features of the Ruby version, but not all of them. Things are improving, so please be patient. Before you ask, I have no intention of making a version of this package that links to the Ruby version instead.

For a quick rundown on what libsass does and doesn't (currently) do, [check here](http://sass-compatibility.github.io/).
