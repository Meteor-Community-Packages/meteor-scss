renderToDiv = function(comp) {
  var body = document.getElementsByTagName("body")[0];
  Blaze.render(comp, body);
}

Tinytest.add("sass - presence", function(test) {
  renderToDiv(Template.test_p_tag);

  var p = $('.sass-dashy-left-border-transition');

  test.equal(p.css('border-left-style'), "dashed");

  // test @import
  test.equal(p.css('border-right-style'), "dotted");

  p.remove();
});

Tinytest.add("sass - autprefixer presence and function", function(test) {
  renderToDiv(Template.test_p_tag);

  var p = $('.sass-dashy-left-border-transition');

  test.equal(p.css('-webkit-background-size'), "20px");

  p.remove();
});
