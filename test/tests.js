renderToDiv = function(comp) {
  var body = document.getElementsByTagName("body")[0];
  Blaze.render(comp, body);
}

// Enable when `indentedSyntax` is fixed in node-sass
// Also see `package.js`
// Tinytest.add("sass - presence", function(test) {
//   renderToDiv(Template.test_p_tag);

//   var p = $('#sass-sample-paragraph');

//   test.equal(p.css('border-left-style'), "dashed");
//   test.equal(p.css('border-right-style'), "dotted");

//   p.remove();
// });

Tinytest.add("scss - presence", function(test) {
  renderToDiv(Template.test_p_tag);

  var p = $('#scss-sample-paragraph');

  test.equal(p.css('border-left-style'), "dashed");
  test.equal(p.css('border-right-style'), "dotted");

  p.remove();
});
