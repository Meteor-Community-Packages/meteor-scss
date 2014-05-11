meteor-scss
===========

Node-sass wrapped to work with meteor.

This allows .scss files to work with meteor - N.B. node-sass only supports scss files, so apologies to those who want sass support, this package will not help you.

To use:
This package is configured to find *.scss files and compile them through node-sass and provide them to the page. So just start using it, the scss files can be anywhere in the project.

Configuration
-------------

Add a `scss.json` file at the project's root to pass configuration options to node-sass. See [node-sass](https://github.com/andrew/node-sass)'s documentation for a list of options.

Example (for using bourbon and neat with meteor-bower):

```json
{
  "includePaths": [
    ".meteor/local/bower",
    ".meteor/local/bower/node-bourbon/assets/stylesheets",
    ".meteor/local/bower/neat/app/assets/stylesheets"
  ]
}
```

Meteor 0.8.0
------------
Please use 0.8.4 or above for meteor 0.8.x, and 0.8.3 for earlier. The API has changed and as such these are the compatible versions.
