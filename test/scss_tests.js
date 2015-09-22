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
