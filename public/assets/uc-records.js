(function () {
  'use strict';

  function setFiltered(el, filtered) {
    if (!el) return;
    el.classList.toggle('ucrl-filter-hidden', !!filtered);
    if (filtered) {
      el.style.setProperty('display', 'none', 'important');
      el.setAttribute('aria-hidden', 'true');
    } else {
      el.style.removeProperty('display');
      el.removeAttribute('aria-hidden');
    }
  }

  function init(root) {
    if (!root || root.getAttribute('data-ucrl-ready') === '1') return;
    root.setAttribute('data-ucrl-ready', '1');

    var page = root.getAttribute('data-ucrl-page');
    var panel = root.querySelector('.ucrl-panel');
    var status = root.querySelector('.ucrl-status');
    var search = root.querySelector('.ucrl-search input');
    var empty = root.querySelector('.ucrl-empty');
    var buttons = Array.prototype.slice.call(root.querySelectorAll('.ucrl-tab'));
    var cache = {};

    if (!panel || !search) return;

    cache[panel.getAttribute('data-active-tab')] = panel.innerHTML;

    function clearFilterState() {
      Array.prototype.forEach.call(panel.querySelectorAll('.ucrl-filter-hidden'), function (el) {
        setFiltered(el, false);
      });
    }

    function applyFilter() {
      var q = (search.value || '').trim().toLowerCase();
      var visible = 0;
      var sections = Array.prototype.slice.call(panel.querySelectorAll('.ucrl-filter-item'));

      clearFilterState();

      if (!q) {
        if (empty) setFiltered(empty, true);
        return;
      }

      if (sections.length) {
        sections.forEach(function (section) {
          var rows = Array.prototype.slice.call(section.querySelectorAll('.ucrl-data-row'));
          var sectionHay = (section.getAttribute('data-search') || '').toLowerCase();

          if (rows.length) {
            var rowVisible = 0;
            rows.forEach(function (row) {
              var hay = (row.getAttribute('data-search') || row.textContent || '').toLowerCase();
              var show = hay.indexOf(q) !== -1;
              setFiltered(row, !show);
              if (show) rowVisible++;
            });

            var sectionMatches = sectionHay.indexOf(q) !== -1;
            if (sectionMatches) {
              rows.forEach(function (row) { setFiltered(row, false); });
              rowVisible = rows.length;
            }

            setFiltered(section, rowVisible === 0);
            if (rowVisible > 0) visible++;
          } else {
            var hay = (section.getAttribute('data-search') || section.textContent || '').toLowerCase();
            var show = hay.indexOf(q) !== -1;
            setFiltered(section, !show);
            if (show) visible++;
          }
        });
      } else {
        var rows = Array.prototype.slice.call(panel.querySelectorAll('.ucrl-data-row'));
        rows.forEach(function (row) {
          var hay = (row.getAttribute('data-search') || row.textContent || '').toLowerCase();
          var show = hay.indexOf(q) !== -1;
          setFiltered(row, !show);
          if (show) visible++;
        });
      }

      if (empty) setFiltered(empty, visible > 0);
    }

    function skeleton() {
      return '<div class="ucrl-skeleton"></div><div style="height:10px"></div><div class="ucrl-skeleton"></div>';
    }

    function setActive(button) {
      buttons.forEach(function (btn) {
        var active = btn === button;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    }

    function loadTab(button) {
      var tab = button.getAttribute('data-tab');
      if (!tab || tab === panel.getAttribute('data-active-tab')) return;

      setActive(button);
      panel.setAttribute('data-active-tab', tab);
      search.value = '';
      if (empty) setFiltered(empty, true);

      if (cache[tab]) {
        panel.innerHTML = cache[tab];
        if (status) status.textContent = '';
        applyFilter();
        return;
      }

      panel.innerHTML = skeleton();
      if (status) {
        status.classList.add('is-loading');
        status.textContent = 'Loading records…';
      }

      var url = UCRL.endpoint + '?page=' + encodeURIComponent(page) + '&tab=' + encodeURIComponent(tab);
      fetch(url, { credentials: 'same-origin' })
        .then(function (response) {
          if (!response.ok) throw new Error('Unable to load this section.');
          return response.json();
        })
        .then(function (data) {
          if (!data || !data.html) throw new Error('Unable to load this section.');
          cache[tab] = data.html;
          panel.innerHTML = data.html;
          if (status) {
            status.textContent = '';
            status.classList.remove('is-loading');
          }
          applyFilter();
        })
        .catch(function () {
          panel.innerHTML = '<div class="ucrl-empty">This section could not be loaded right now. The main record book is still available.</div>';
          if (status) {
            status.textContent = '';
            status.classList.remove('is-loading');
          }
        });
    }

    buttons.forEach(function (button) {
      button.addEventListener('click', function () { loadTab(button); });
    });

    search.addEventListener('input', applyFilter);
    search.addEventListener('search', applyFilter);
  }

  function boot() {
    Array.prototype.forEach.call(document.querySelectorAll('.ucrl-shell'), init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
