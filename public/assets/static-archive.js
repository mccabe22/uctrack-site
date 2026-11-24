/*
 * The WordPress site loaded past seasons and record-book tabs from the server on demand.
 * On the static site those are pre-built files; this maps the old requests onto them
 * so the original page scripts keep working unchanged.
 */
(function () {
  'use strict';
  var nativeFetch = window.fetch;
  if (!nativeFetch || window.__ucStaticArchive) return;
  window.__ucStaticArchive = true;

  function mapUrl(input, init) {
    var url;
    try { url = new URL(typeof input === 'string' ? input : input.url, window.location.href); } catch (e) { return null; }
    var p = url.searchParams;
    if (p.has('uc_xc_year')) return '/archive/xc-' + p.get('uc_xc_year') + '.html';
    if (p.has('uc_spring_legacy_year')) return '/archive/spring-legacy-' + p.get('uc_spring_legacy_year') + '.html';
    if (p.has('uc_spring_year')) return '/archive/spring-' + p.get('uc_spring_year') + '.html';
    if (p.has('uc_winter_legacy')) return '/archive/winter-legacy-' + p.get('uc_winter_legacy') + '.html';
    if (p.has('uc_winter_year')) return '/archive/winter-' + p.get('uc_winter_year') + '.html';
    if (url.pathname.indexOf('/wp-json/uc-records/v1/tab') === 0) {
      return '/records-data/' + encodeURIComponent(p.get('page') || '') + '/' + encodeURIComponent(p.get('tab') || '') + '.json';
    }
    if (url.pathname.indexOf('/wp-admin/admin-ajax.php') === 0 && init && typeof init.body === 'string') {
      var body = new URLSearchParams(init.body);
      if (body.get('action') === 'uc_xc_load_legacy_year') return '/archive/xc-legacy-' + body.get('year') + '.html';
    }
    return null;
  }

  window.fetch = function (input, init) {
    var mapped = mapUrl(input, init);
    if (mapped) return nativeFetch.call(this, mapped, { credentials: 'same-origin' });
    return nativeFetch.apply(this, arguments);
  };
})();
