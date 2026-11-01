(function () {
  'use strict';
  if (window.__darkstrapThemeJs) return;
  window.__darkstrapThemeJs = true;

  function qsa(sel, root) {
    root = root || document;
    var nodes = [];

    if (root.nodeType === 1 && root.matches && root.matches(sel))
      nodes.push(root);

    if (root.querySelectorAll)
      nodes = nodes.concat(Array.prototype.slice.call(root.querySelectorAll(sel)));

    return nodes;
  }

  function compactProgressTitle(title) {
    var value = String(title || '').split('/')[0].trim();
    if (!value) return '';
    value = value.replace(/\s+/g, ' ');
    return value;
  }

  function addProgressNumbers(root) {
    qsa('.cbi-progressbar[title], .progress[title]', root).forEach(function (bar) {
      var text = compactProgressTitle(bar.getAttribute('title'));
      if (!text) return;
      bar.classList.add('darkstrap-title-numbered');
      var span = bar.querySelector('.darkstrap-progress-title');
      if (!span) {
        span = document.createElement('span');
        span.className = 'darkstrap-progress-title';
        bar.appendChild(span);
      }
      if (span.textContent !== text) span.textContent = text;
    });
  }

  function descriptionContainer(desc) {
    if (desc.matches && desc.matches('.cbi-section-descr, .cbi-section-table-descr, .cbi-tblsection-descr')) {
      return desc.closest('.cbi-section, .cbi-tblsection') || desc.parentElement;
    }
    if (desc.matches && desc.matches('.cbi-tab-descr')) {
      return desc.closest('.cbi-tabcontainer, .tab-pane') || desc.parentElement;
    }
    return desc.closest('.cbi-value') || desc.closest('.tr') || desc.closest('tr') || desc.closest('.cbi-section') || desc.parentElement;
  }

  function findTitleElement(container, desc) {
    if (container.classList.contains('cbi-section') || container.classList.contains('cbi-tblsection')) {
      var header = container.querySelector('legend, h3, h2, h1, .cbi-title');
      if (header) return header;
    }
    var title = container.querySelector('.cbi-value-title, label.cbi-value-title');
    if (title) return title;
    var legend = container.querySelector('legend, h3, h2, h1');
    if (legend) return legend;
    var label = container.querySelector('label');
    if (label) return label;
    // In tables, only use td if it does not contain empty state messages
    var firstTd = container.querySelector('.td:first-child, td:first-child');
    if (firstTd && !firstTd.textContent.includes('no values') && !firstTd.querySelector('.alert, .notice')) {
      return firstTd;
    }
    return null;
  }

  function addHelpButtons(root) {
    var selector = [
      '.cbi-value-description:not(.darkstrap-help-managed)',
      '.cbi-section-descr:not(.darkstrap-help-managed)',
      '.cbi-section-table-descr:not(.darkstrap-help-managed)',
      '.cbi-tab-descr:not(.darkstrap-help-managed)',
      '.description:not(.darkstrap-help-managed)',
      '.help-block:not(.darkstrap-help-managed)',
      '.help-inline:not(.darkstrap-help-managed)',
      '.cbi-map-descr:not(.darkstrap-help-managed)'
    ].join(',');

    qsa(selector, root).forEach(function (desc) {
      var text = (desc.textContent || '').trim();
      if (!text) return;
      // Never fold alerts, notices, port boxes, logins, empty states, or active validation errors
      if (desc.closest('.alert-message, .alert, .notice, .zonebadge, .ifacebadge, .ifacebox, .modal.login, .cbi-value-error, .error')) return;
      if (desc.classList.contains('cbi-value-error') || desc.classList.contains('error') || desc.querySelector('.cbi-value-error, .error')) return;

      var container = descriptionContainer(desc);
      if (!container) return;
      desc.classList.add('darkstrap-help-managed');

      if (!desc.id) desc.id = 'darkstrap-help-' + Math.random().toString(36).slice(2, 10);
      if (root.querySelector('.darkstrap-help-btn[data-darkstrap-help-for="' + desc.id + '"]')) return;

      var titleEl = findTitleElement(container, desc);
      if (!titleEl) return;

      // Avoid duplicate buttons on re-renders
      if (titleEl.querySelector('.darkstrap-help-btn[data-darkstrap-help-for="' + desc.id + '"]')) return;

      desc.classList.add('darkstrap-help-managed');

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'darkstrap-help-btn';
      btn.setAttribute('aria-label', 'Show help');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', desc.id);
      btn.setAttribute('data-darkstrap-help-for', desc.id);
      btn.textContent = '?';

      btn.addEventListener('pointerdown', function (ev) {
        ev.stopPropagation();
      });

      btn.addEventListener('mousedown', function (ev) {
        ev.stopPropagation();
      });

      btn.addEventListener('touchstart', function (ev) {
        ev.stopPropagation();
      }, { passive: true });

      btn.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var isOpen = desc.classList.toggle('darkstrap-help-open');
        btn.classList.toggle('darkstrap-help-active', isOpen);
        btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        btn.setAttribute('aria-label', isOpen ? 'Hide help' : 'Show help');
      });

      titleEl.appendChild(btn);
    });
  }

  function isNetworkInterfacesPage() {
    var page = document.body ? document.body.getAttribute('data-page') : '';
    return /^admin-network-(network|interface)/.test(page || '');
  }

  function collapseEmptyNetworkBlocks(root) {
    if (!isNetworkInterfacesPage()) return;

    var selector = [
      '.cbi-map-descr',
      '.cbi-section-descr',
      '.cbi-section-table-descr',
      '.cbi-tab-descr',
      '.cbi-value-description',
      '.description',
      '.help-block',
      '.help-inline',
      '.cbi-value'
    ].join(',');

    qsa(selector, root).forEach(function (el) {
      if (el.closest('#modal_overlay, .modal, .alert-message, .cbi-page-actions, .actions')) return;
      if (el.classList.contains('darkstrap-help-managed')) return;

      var text = (el.textContent || '').replace(/\u00a0/g, ' ').trim();
      var useful = el.querySelector('input, select, textarea, button, a, img, svg, canvas, table, .table, .tr, .td, .th, .cbi-button, .ifacebox, .ifacebadge, .cbi-dropdown, [data-tab-active="true"]');
      el.classList.toggle('darkstrap-empty-structural', !text && !useful);
    });

    qsa('.cbi-section, .cbi-tblsection', root).forEach(function (section) {
      if (section.closest('#modal_overlay, .modal, .alert-message, .cbi-page-actions, .actions')) return;

      var text = (section.textContent || '').replace(/\u00a0/g, ' ').trim();
      var useful = section.querySelector('input, select, textarea, button, a, img, svg, canvas, table, .table, .tr, .td, .th, .cbi-button, .ifacebox, .ifacebadge, .cbi-dropdown, [data-tab-active="true"]');
      var hasVisibleBox = false;

      Array.prototype.slice.call(section.children || []).some(function (child) {
        if (child.classList && (child.classList.contains('darkstrap-empty-structural') || child.classList.contains('hidden'))) return false;
        if (child.style && (child.style.display === 'none' || child.style.visibility === 'hidden')) return false;
        hasVisibleBox = (child.children && child.children.length > 0) || (child.textContent || '').trim().length > 0;
        return hasVisibleBox;
      });

      section.classList.toggle('darkstrap-empty-structural', !text && !useful && !hasVisibleBox);
    });
  }

  var lockedScrollY = 0;

  function modalIsOpen() {
    return document.body ? document.body.classList.contains('modal-overlay-active') : false;
  }

  function setModalScrollLock(lock) {
    if (!document.body || !document.documentElement) return;
    if (lock && !document.body.classList.contains('darkstrap-modal-open')) {
      lockedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      document.documentElement.classList.add('darkstrap-modal-open');
      document.body.classList.add('darkstrap-modal-open');
      document.body.style.top = '-' + lockedScrollY + 'px';
    }
    else if (!lock && document.body.classList.contains('darkstrap-modal-open')) {
      document.documentElement.classList.remove('darkstrap-modal-open');
      document.body.classList.remove('darkstrap-modal-open');
      document.body.style.top = '';
      window.scrollTo(0, lockedScrollY);
    }
  }

  function tagWirelessBadges(root) {
    if (!document.body || document.body.getAttribute('data-page') !== 'admin-network-wireless')
      return;

    qsa('[data-name="_badge"] .ifacebadge, #wifi_assoclist_table .ifacebadge', root).forEach(function (badge) {
      var text = (badge.textContent || '').trim().toLowerCase();
      var img = badge.querySelector('img');
      var src = img ? (img.getAttribute('src') || '').toLowerCase() : '';
      var isClient = !!badge.closest('#wifi_assoclist_table, .assoclist');
      var isRadio = /(^|\s)radio[0-9]+(\s|$)/.test(text) || /radio[0-9]+/.test(src);
      var isWireless = isClient || isRadio || /wifi|wireless|signal/.test(src + ' ' + text);

      badge.classList.toggle('darkstrap-radio-badge', isRadio && !isClient);
      badge.classList.toggle('darkstrap-wireless-client-badge', isClient);

      if (img && isWireless)
        img.removeAttribute('aria-hidden');
    });
  }

  function tagProcessRows(root) {
    if (!document.body || document.body.getAttribute('data-page') !== 'admin-status-processes')
      return;

    qsa('table.table tr.tr:not(.table-titles), .table .tr:not(.table-titles)', root).forEach(function (row) {
      var cells = Array.prototype.slice.call(row.children || []);
      if (cells.length < 6) return;

      var cpu = parseFloat((cells[3].textContent || '').replace('%', '').trim());
      var mem = parseFloat((cells[4].textContent || '').replace('%', '').trim());
      var cpuActive = isFinite(cpu) && cpu > 0;
      var memActive = isFinite(mem) && mem > 0;

      row.classList.toggle('darkstrap-cpu-active-row', cpuActive);
      row.classList.toggle('darkstrap-mem-active-row', memActive);
      row.setAttribute('data-darkstrap-cpu', isFinite(cpu) ? String(cpu) : '0');
      row.setAttribute('data-darkstrap-mem', isFinite(mem) ? String(mem) : '0');
      cells[3].classList.add('darkstrap-process-cpu-cell');
      cells[4].classList.add('darkstrap-process-mem-cell');
      cells[5].classList.add('darkstrap-process-actions-cell');

      var actions = cells[5].querySelector('div');
      if (actions)
        actions.classList.add('darkstrap-process-actions');
    });
  }

  function normalizeActionDropdowns(root) {
    qsa('.cbi-page-actions .cbi-dropdown.cbi-button, .actions .cbi-dropdown.cbi-button', root).forEach(function (drop) {
      var preview = Array.prototype.slice.call(drop.children || []).filter(function (child) {
        return child.tagName === 'UL' && !child.classList.contains('dropdown') && !child.classList.contains('preview');
      })[0];
      if (!preview) return;

      var previewText = (preview.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      var isSaveApply = drop.classList.contains('cbi-button-apply') ||
        (previewText.indexOf('save') !== -1 && previewText.indexOf('apply') !== -1);

      if (!isSaveApply) return;

      var items = Array.prototype.slice.call(preview.children || []).filter(function (child) {
        return child.tagName === 'LI';
      });
      if (!items.length) return;

      var main = items.filter(function (item) {
        return item.hasAttribute('display') || item.hasAttribute('selected');
      })[0] || null;

      items.forEach(function (item) {
        var text = (item.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        var isUnchecked = text.indexOf('unchecked') !== -1;
        item.classList.remove('darkstrap-action-preview-main');
        item.classList.remove('darkstrap-action-preview-extra');

        if (isUnchecked || item.getAttribute('aria-hidden') === 'true')
          item.classList.add('darkstrap-action-preview-extra');
        else if (!main)
          main = item;
      });

      main = main || items[0];
      drop.classList.add('darkstrap-save-apply-combo');
      preview.classList.add('darkstrap-save-apply-preview');
      main.classList.remove('darkstrap-action-preview-extra');
      main.classList.add('darkstrap-action-preview-main');
    });
  }

  function normalizeComboButtons(root) {
    qsa('.cbi-dropdown.cbi-button, .cbi-dropdown.btn', root).forEach(function (btn) {
      if (btn.classList.contains('darkstrap-save-apply-combo')) return;
      var ul = btn.querySelector('ul:not(.dropdown)');
      if (!ul) return;
      var items = ul.querySelectorAll('li');
      var sel = ul.querySelector('li[selected], li[display]');
      if (!sel && items.length > 0) {
        items[0].setAttribute('display', '0');
        items[0].setAttribute('selected', '');
      }
    });
  }

  var graphObserver = null;

  function processGraphElements() {
    var polys = document.querySelectorAll('svg polyline');
    var arcs = document.querySelectorAll('#channel_graph svg polyline');
    if (!polys.length && !arcs.length) return;

    polys.forEach(function (poly) {
      var id = poly.getAttribute('id');
      if (!id) return;

      var pathId = id + '-darkstrap-line';
      var path = document.getElementById(pathId);
      if (!path) {
        path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.id = pathId;
        path.setAttribute('class', 'darkstrap-premium-line ' + id);
        poly.parentNode.appendChild(path);
      }

      var ptStr = poly.getAttribute('points') || '';
      if (path.getAttribute('data-last-points') === ptStr) return;
      path.setAttribute('data-last-points', ptStr);

      try {
        var ptsRaw = ptStr.trim().split(/\s+/);
        if (ptsRaw.length > 3) {
          var dataPts = ptsRaw.slice(1, ptsRaw.length - 1).map(function (p) {
            var coords = p.split(',');
            return { x: parseFloat(coords[0]), y: parseFloat(coords[1]) };
          });

          var validPts = dataPts.filter(function (p) { return !isNaN(p.x) && !isNaN(p.y); });
          if (validPts.length > 1) {
            var d = "M " + validPts[0].x + " " + validPts[0].y + " ";
            for (var i = 0; i < validPts.length - 1; i++) {
              var p1 = validPts[i];
              var p2 = validPts[i + 1];
              var midX = (p1.x + p2.x) / 2;
              if (isNaN(midX)) {
                d += "L " + p2.x + " " + p2.y + " ";
              } else {
                d += "C " + midX + " " + p1.y + ", " + midX + " " + p2.y + ", " + p2.x + " " + p2.y + " ";
              }
            }
            path.setAttribute('d', d);
            poly.style.opacity = '0';
            poly.style.stroke = 'none';
          }
        }
      } catch (e) {}
    });

    arcs.forEach(function (arc) {
      var id = arc.getAttribute('id');
      if (!id) {
        id = 'arc-' + Math.random().toString(36).slice(2, 10);
        arc.setAttribute('id', id);
      }

      var pathId = id + '-path';
      var path = document.getElementById(pathId);
      if (!path) {
        path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.id = pathId;
        path.classList.add('darkstrap-channel-arc-premium');
        arc.parentNode.appendChild(path);
      }

      var ptStr = arc.getAttribute('points') || '';
      if (path.getAttribute('data-last-points') === ptStr) return;
      path.setAttribute('data-last-points', ptStr);
      var ptsRaw = ptStr.trim().split(/\s+/);
      if (ptsRaw.length === 4) {
        var p0 = ptsRaw[0].split(',');
        var p1 = ptsRaw[1].split(',');
        var p2 = ptsRaw[2].split(',');
        var p3 = ptsRaw[3].split(',');

        p0 = { x: parseFloat(p0[0]), y: parseFloat(p0[1]) };
        p1 = { x: parseFloat(p1[0]), y: parseFloat(p1[1]) };
        p2 = { x: parseFloat(p2[0]), y: parseFloat(p2[1]) };
        p3 = { x: parseFloat(p3[0]), y: parseFloat(p3[1]) };

        var midX = (p1.x + p2.x) / 2;
        var d = "M " + p0.x + " " + p0.y +
          " C " + p1.x + " " + p0.y + ", " + p1.x + " " + p1.y + ", " + midX + " " + p1.y +
          " C " + p2.x + " " + p1.y + ", " + p2.x + " " + p3.y + ", " + p3.x + " " + p3.y;

        path.setAttribute('d', d);
        arc.style.opacity = '0';
        arc.style.stroke = 'none';
        arc.style.fill = 'none';
        path.style.fill = 'none';
        path.style.stroke = '#f59e0b';
        path.style.strokeWidth = '3.5px';
        path.style.strokeLinecap = 'round';
      }
    });
  }

  function upgradeGraphs() {
    processGraphElements();

    if (!graphObserver && 'MutationObserver' in window) {
      var view = document.getElementById('view') || document.getElementById('maincontent') || document.body;
      if (view) {
        graphObserver = new MutationObserver(function () {
          processGraphElements();
        });
        graphObserver.observe(view, {
          subtree: true,
          attributes: true,
          attributeFilter: ['points']
        });
      }
    }
  }

  function injectGraphGradients() {
    if (document.getElementById('darkstrap-graph-defs')) return;
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.id = 'darkstrap-graph-defs';
    svg.style.width = '0';
    svg.style.height = '0';
    svg.style.position = 'absolute';
    svg.setAttribute('aria-hidden', 'true');
    var defs = document.createElementNS(svgNS, 'defs');
    
    function makeGrad(id, color) {
      var g = document.createElementNS(svgNS, 'linearGradient');
      g.id = id; g.setAttribute('x1','0'); g.setAttribute('y1','0'); g.setAttribute('x2','0'); g.setAttribute('y2','1');
      var s1 = document.createElementNS(svgNS, 'stop'); s1.setAttribute('offset','0%'); s1.setAttribute('stop-color',color); s1.setAttribute('stop-opacity','0.35');
      var s2 = document.createElementNS(svgNS, 'stop'); s2.setAttribute('offset','100%'); s2.setAttribute('stop-color',color); s2.setAttribute('stop-opacity','0.0');
      g.appendChild(s1); g.appendChild(s2);
      return g;
    }
    
    defs.appendChild(makeGrad('grad-primary', '#00e5ff'));
    defs.appendChild(makeGrad('grad-secondary', '#ff3366'));
    defs.appendChild(makeGrad('grad-tertiary', '#ffb020'));
    defs.appendChild(makeGrad('grad-quaternary', '#a352ff'));
    
    svg.appendChild(defs);
    if (document.body) document.body.appendChild(svg);
  }

  function wrapAssocTable(root) {
    var tbl = (root || document).querySelector('#wifi_assoclist_table');
    if (tbl && tbl.parentElement && !tbl.parentElement.classList.contains('darkstrap-table-scroll-wrap')) {
      var wrap = document.createElement('div');
      wrap.className = 'darkstrap-table-scroll-wrap';
      tbl.parentNode.insertBefore(wrap, tbl);
      wrap.appendChild(tbl);
    }
  }

  function run(root) {
    qsa(".port-status-device, .port-status-link, .ifacebadge", root).forEach(function (el) {
      if (el.closest('#wifi_assoclist_table, .assoclist')) return;
      var text = (el.textContent || "").toLowerCase();
      var hasDisabled = !!el.querySelector('img[src*="_disabled"]');
      var inactive = hasDisabled || /no link|not connected|disabled|down/.test(text);
      el.classList.toggle("darkstrap-active-port", !inactive);
      el.classList.toggle("darkstrap-inactive-port", inactive);
    });
    qsa("label", root).forEach(function (label) { if (label.querySelector("select.mode, select.band, select.channel, select.htmode")) label.classList.add("darkstrap-frequency-control"); });
    tagPortBoxes(root);
    tagWirelessBadges(root);
    tagProcessRows(root);
    normalizeActionDropdowns(root);
    normalizeComboButtons(root);
    addProgressNumbers(root);
    addHelpButtons(root);
    collapseEmptyNetworkBlocks(root);
    setModalScrollLock(modalIsOpen());
    wrapAssocTable(root);
    upgradeGraphs(root);
    injectGraphGradients();
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function tagPortBoxes(root) {
    qsa('.ifacebox', root).forEach(function (box) {
      var text = (box.textContent || '').toLowerCase();
      var activeIcon = !!box.querySelector('img[src*="port_up.svg"], img[src*="pse_up.svg"]');
      var inactiveIcon = !!box.querySelector('img[src*="port_down.svg"], img[src*="pse_down.svg"], img[src*="_disabled"]');
      var inactive = inactiveIcon || /no link|not connected|disabled|down/.test(text);
      box.classList.toggle('darkstrap-active-port', activeIcon && !inactive);
      box.classList.toggle('darkstrap-inactive-port', inactive);
    });
  }

  var runScheduled = false;
  var mutationDebounceTimer = null;
  var pendingRoots = [];

  function isDarkstrapInternalNode(node) {
    if (!node || node.nodeType !== 1) return false;
    var sel = '.darkstrap-help-btn, .darkstrap-progress-title, #darkstrap-graph-defs, #darkstrap-mobile-toggle, #modal_overlay, .proc-gold-table, #indicators, #indicators *, header, header *, #topmenu, #topmenu *, #modemenu, #modemenu *, #wifi_assoclist_table, #wifi_assoclist_table *, svg, svg *, .darkstrap-premium-line, .darkstrap-premium-dome, .darkstrap-table-scroll-wrap, #dns-query-log, .cbi-dynlist, .cbi-dynlist *';
    if (node.matches && node.matches(sel)) return true;
    if (node.closest && node.closest(sel)) return true;
    return false;
  }

  function queueRoot(root) {
    if (!root) return;
    if (root.nodeType === 3) root = root.parentElement;
    if (!root || !root.nodeType) return;

    if (isDarkstrapInternalNode(root)) return;

    if (root === document || root.nodeType === 9) {
      pendingRoots = [document];
      return;
    }

    if (root.nodeType === 1 && pendingRoots.indexOf(root) === -1) {
      if (pendingRoots.length < 20) {
        pendingRoots.push(root);
      }
    }
  }

  function flushRun() {
    runScheduled = false;
    var roots = pendingRoots.length ? pendingRoots.splice(0) : [document];

    if (roots.indexOf(document) !== -1)
      run(document);
    else
      roots.forEach(run);
  }

  function scheduleRun(root) {
    queueRoot(root || document);
    if (runScheduled) return;
    runScheduled = true;
    if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer);
    mutationDebounceTimer = setTimeout(function () {
      if (window.requestAnimationFrame) {
        window.requestAnimationFrame(flushRun);
      } else {
        flushRun();
      }
    }, 80);
  }

  function scheduleFromMutations(records) {
    var hasExternalMutation = false;
    for (var i = 0; i < records.length; i++) {
      var record = records[i];
      var target = record.target;
      if (isDarkstrapInternalNode(target)) continue;

      if (record.addedNodes && record.addedNodes.length) {
        for (var j = 0; j < record.addedNodes.length; j++) {
          var node = record.addedNodes[j];
          if (!node || node.nodeType !== 1) continue;
          if (isDarkstrapInternalNode(node)) continue;
          queueRoot(node);
          hasExternalMutation = true;
        }
      }
    }

    if (hasExternalMutation && pendingRoots.length > 0) {
      scheduleRun();
    }
  }

  function initMobileNav() {
    var header = document.querySelector('header');
    if (!header || document.getElementById('darkstrap-mobile-toggle')) return;

    var toggle = document.createElement('button');
    toggle.id = 'darkstrap-mobile-toggle';
    toggle.type = 'button';
    toggle.className = 'darkstrap-mobile-toggle-btn';
    toggle.setAttribute('aria-label', 'Toggle Navigation Menu');

    for (var b = 0; b < 3; b++) {
      var bar = document.createElement('span');
      bar.className = 'darkstrap-hamburger-bar';
      toggle.appendChild(bar);
    }

    toggle.addEventListener('click', function (ev) {
      ev.stopPropagation();
      var isOpen = document.body.classList.toggle('darkstrap-mobile-menu-open');
      toggle.classList.toggle('active', isOpen);
    });

    document.addEventListener('click', function (ev) {
      if (document.body.classList.contains('darkstrap-mobile-menu-open')) {
        if (!ev.target.closest('#topmenu, #darkstrap-mobile-toggle')) {
          document.body.classList.remove('darkstrap-mobile-menu-open');
          toggle.classList.remove('active');
        }
      }
    });

    // Universal Event delegation for dropdown menus (desktop & mobile)
    document.addEventListener('click', function (ev) {
      var menuLink = ev.target.closest('#topmenu > li.dropdown > a.menu');
      if (menuLink) {
        ev.preventDefault();
        ev.stopPropagation();
        var parent = menuLink.parentElement;
        var wasOpen = parent.classList.contains('darkstrap-touch-open');
        qsa('#topmenu > li.dropdown').forEach(function (li) { li.classList.remove('darkstrap-touch-open'); });
        if (!wasOpen) parent.classList.add('darkstrap-touch-open');
      } else if (!ev.target.closest('#topmenu > li.dropdown')) {
        qsa('#topmenu > li.dropdown.darkstrap-touch-open').forEach(function (li) { li.classList.remove('darkstrap-touch-open'); });
      }
    });

    header.insertBefore(toggle, header.firstChild);
  }

  function initAbstractBackground() {
    if (document.getElementById('darkstrap-abstract-bg')) return;
    var container = document.createElement('div');
    container.id = 'darkstrap-abstract-bg';
    container.setAttribute('aria-hidden', 'true');
    var pos = document.createElement('div');
    pos.className = 'darkstrap-abstract-positioner';

    // Synchronize animation timeline across page loads and menu switches via localStorage
    var epochKey = 'darkstrap_bg_anim_epoch';
    var epoch = localStorage.getItem(epochKey);
    var now = Date.now();
    if (!epoch || isNaN(parseInt(epoch, 10))) {
      epoch = now;
      try { localStorage.setItem(epochKey, epoch); } catch (e) {}
    }
    var cycleDuration = 52; // 52s compound 3D loop
    var elapsed = (now - parseInt(epoch, 10)) / 1000;
    var delayOffset = -(elapsed % cycleDuration);

    var spinner = document.createElement('div');
    spinner.className = 'darkstrap-abstract-spinner';
    spinner.style.animationDelay = delayOffset.toFixed(3) + 's';

    // Depth layers
    var depths = [-28, -14, 0, 14, 28];
    var layerOpacities = [0.20, 0.28, 0.38, 0.30, 0.22];
    for (var i = 0; i < depths.length; i++) {
      var layer = document.createElement('div');
      layer.className = 'darkstrap-abstract-layer darkstrap-layer-' + i;
      layer.style.transform = 'translateZ(' + depths[i] + 'px)';
      layer.style.opacity = layerOpacities[i];
      spinner.appendChild(layer);
    }

    pos.appendChild(spinner);
    container.appendChild(pos);
    if (document.body) {
      document.body.insertBefore(container, document.body.firstChild);
    }
  }

  // Synchronize animation state
  function syncBgAnimation() {
    var spinner = document.querySelector('.darkstrap-abstract-spinner');
    if (!spinner) return;
    var cycle = 52;
    var elapsed = (Date.now() / 1000) % cycle;
    spinner.style.animationDelay = '-' + elapsed.toFixed(3) + 's';
    spinner.style.animationPlayState = 'running';
  }

  window.addEventListener('pageshow', function () {
    syncBgAnimation();
    if (document.body) {
      document.body.classList.remove('darkstrap-switching-page');
    }
  });

  /* Navigation and modal handlers */
  function initFastNav() {
    document.addEventListener('click', function (ev) {
      var a = ev.target && ev.target.closest ? ev.target.closest('#topmenu a, #modemenu a') : null;
      if (a && a.href && a.origin === window.location.origin && a.pathname !== window.location.pathname && !a.target) {
        document.body.classList.add('darkstrap-switching-page');
        setTimeout(function () {
          if (document.body) document.body.classList.remove('darkstrap-switching-page');
        }, 80);
      }
    }, true);

    // Modal dismissal handler
    document.addEventListener('click', function (ev) {
      var target = ev.target;
      if (!target) return;
      var dismissBtn = target.closest('#modal_overlay .button-row button, #modal_overlay .right button, #modal_overlay button[class*="dismiss"], #modal_overlay [data-dismiss="modal"]');
      if (dismissBtn) {
        var text = (dismissBtn.textContent || dismissBtn.value || '').trim().toLowerCase();
        if (text === 'dismiss' || text === 'cancel' || text === 'close') {
          setTimeout(function () {
            if (window.L && window.L.hideModal) {
              window.L.hideModal();
            }
            if (document.body) {
              document.body.classList.remove('modal-overlay-active', 'darkstrap-modal-open');
              document.body.style.top = '';
            }
            if (document.documentElement) {
              document.documentElement.classList.remove('darkstrap-modal-open');
            }
          }, 10);
        }
      }
    }, true);
  }

  function initTooltipViewportGuards() {
    function adjustTooltip(container) {
      var tt = container.querySelector('.cbi-tooltip');
      if (!tt) return;

      var sec = container.closest('.cbi-section, .cbi-tblsection, .ifacebox');
      if (sec) sec.style.zIndex = '100';

      var wasHidden = (window.getComputedStyle(tt).display === 'none');
      if (wasHidden) {
        tt.style.display = 'flex';
        tt.style.visibility = 'hidden';
      }

      var cRect = container.getBoundingClientRect();
      var ttRect = tt.getBoundingClientRect();
      var winW = window.innerWidth;
      var winH = window.innerHeight;
      var pad = 12;

      // 1. Vertical flip check:
      if (ttRect.bottom > winH - pad && (cRect.top - ttRect.height > pad)) {
        tt.classList.add('darkstrap-tooltip-above');
        tt.classList.remove('darkstrap-tooltip-below');
      } else if (cRect.top - ttRect.height < pad && (winH - cRect.bottom > ttRect.height + pad)) {
        tt.classList.add('darkstrap-tooltip-below');
        tt.classList.remove('darkstrap-tooltip-above');
      }

      // 2. Horizontal positioning & arrow alignment:
      // Prefer card boundaries (.cbi-section, .cbi-tblsection) or fallback to #maincontent / viewport
      var card = container.closest('.cbi-section, .cbi-tblsection') || container.closest('#maincontent') || document.body;
      var cardRect = card.getBoundingClientRect();
      var minLeft = Math.max(pad, cardRect.left + 8);
      var maxRight = Math.min(winW - pad, cardRect.right - 8);

      // Target center: if inside an ifacebox port card, center relative to the port card
      var portBox = container.closest('.ifacebox');
      var targetRect = portBox ? portBox.getBoundingClientRect() : cRect;
      var targetCenterX = targetRect.left + targetRect.width / 2;

      var ttWidth = ttRect.width || 240;
      var maxCardWidth = Math.max(160, maxRight - minLeft);
      if (ttWidth > maxCardWidth) {
        ttWidth = maxCardWidth;
        tt.style.maxWidth = maxCardWidth + 'px';
      }

      var desiredTtLeft = targetCenterX - ttWidth / 2;

      // Rigid clamp: desiredTtLeft MUST stay within [minLeft, maxRight - ttWidth]
      if (desiredTtLeft + ttWidth > maxRight) {
        desiredTtLeft = maxRight - ttWidth;
      }
      if (desiredTtLeft < minLeft) {
        desiredTtLeft = minLeft;
      }

      var relativeTtLeft = desiredTtLeft - cRect.left;
      var arrowX = Math.max(16, Math.min(ttWidth - 16, targetCenterX - desiredTtLeft));

      tt.style.setProperty('--darkstrap-tt-left', relativeTtLeft + 'px');
      tt.style.setProperty('--darkstrap-tt-right', 'auto');
      tt.style.setProperty('--darkstrap-tt-transform', 'none');
      tt.style.setProperty('--darkstrap-arrow-left', arrowX + 'px');
      tt.style.setProperty('--darkstrap-arrow-right', 'auto');
      tt.style.setProperty('--darkstrap-arrow-tx', '-50%');

      if (wasHidden) {
        tt.style.display = '';
        tt.style.visibility = '';
      }
    }

    function resetTooltip(container) {
      var sec = container.closest('.cbi-section, .cbi-tblsection, .ifacebox');
      if (sec) sec.style.removeProperty('z-index');

      var tt = container.querySelector('.cbi-tooltip');
      if (tt) {
        tt.classList.remove('darkstrap-tooltip-above');
        tt.classList.remove('darkstrap-tooltip-below');
        tt.style.removeProperty('--darkstrap-tt-left');
        tt.style.removeProperty('--darkstrap-tt-right');
        tt.style.removeProperty('--darkstrap-tt-transform');
        tt.style.removeProperty('--darkstrap-arrow-left');
        tt.style.removeProperty('--darkstrap-arrow-right');
        tt.style.removeProperty('--darkstrap-arrow-tx');
      }
    }

    document.addEventListener('mouseover', function (ev) {
      var container = ev.target && ev.target.closest && ev.target.closest('.cbi-tooltip-container');
      if (container) adjustTooltip(container);
    }, { passive: true });

    document.addEventListener('focusin', function (ev) {
      var container = ev.target && ev.target.closest && ev.target.closest('.cbi-tooltip-container');
      if (container) adjustTooltip(container);
    }, { passive: true });

    document.addEventListener('mouseout', function (ev) {
      var container = ev.target && ev.target.closest && ev.target.closest('.cbi-tooltip-container');
      if (container && (!ev.relatedTarget || !container.contains(ev.relatedTarget))) {
        resetTooltip(container);
      }
    }, { passive: true });
  }

  ready(function () {
    syncBgAnimation();
    initFastNav();
    initAbstractBackground();
    initMobileNav();
    initTooltipViewportGuards();
    run(document);
    document.addEventListener('click', function (ev) {
      if (ev.target.closest('.darkstrap-help-btn, .darkstrap-help-managed, .cbi-value, .cbi-section, .cbi-tabcontainer')) {
        return; // Don't dismiss help while interacting with form fields
      }
      qsa('.darkstrap-help-managed.darkstrap-help-open').forEach(function (descEl) {
        descEl.classList.remove('darkstrap-help-open');
        var b = document.querySelector('.darkstrap-help-btn[data-darkstrap-help-for="' + descEl.id + '"]');
        if (b) {
          b.classList.remove('darkstrap-help-active');
          b.setAttribute('aria-expanded', 'false');
          b.setAttribute('aria-label', 'Show help');
        }
      });
    });
    if ('MutationObserver' in window && document.body) {
      new MutationObserver(scheduleFromMutations).observe(document.body, { childList: true, subtree: true });
      // Reset scroll lock when modal closes
      new MutationObserver(function () {
        if (!document.body.classList.contains('modal-overlay-active')) {
          if (document.body.classList.contains('darkstrap-modal-open')) {
            document.body.classList.remove('darkstrap-modal-open');
            document.body.style.top = '';
          }
          if (document.documentElement && document.documentElement.classList.contains('darkstrap-modal-open')) {
            document.documentElement.classList.remove('darkstrap-modal-open');
          }
        }
      }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        setTimeout(function () { setModalScrollLock(modalIsOpen()); }, 0);
      }
    }, true);
    document.addEventListener('click', function () {
      setTimeout(function () { setModalScrollLock(modalIsOpen()); }, 0);
    }, true);
  });
}());
