(function () {
	'use strict';
	var root = document.documentElement;
	var styleAttempts = 0;
	var styleRetryPending = false;
	function recoverStyles(link) {
		if (
			!link ||
			styleRetryPending ||
			styleAttempts >= 2 ||
			getComputedStyle(root).getPropertyValue('--athena-bg').trim()
		)
			return;
		styleRetryPending = true;
		setTimeout(
			function () {
				styleRetryPending = false;
				if (getComputedStyle(root).getPropertyValue('--athena-bg').trim()) return;
				var url = new URL(link.getAttribute('href'), window.location.href);
				url.searchParams.set('retry', String(++styleAttempts));
				link.setAttribute('href', url.href);
			},
			250 * (styleAttempts + 1)
		);
	}
	document.addEventListener(
		'error',
		function (event) {
			if (event.target.id === 'athena-stylesheet') recoverStyles(event.target);
		},
		true
	);
	document.addEventListener(
		'load',
		function (event) {
			if (event.target.id === 'athena-stylesheet') recoverStyles(event.target);
		},
		true
	);
	var system = window.matchMedia('(prefers-color-scheme: dark)');
	var defaultMode = ['light', 'dark', 'system'].includes(root.dataset.themeDefault)
		? root.dataset.themeDefault
		: 'system';
	var mode = defaultMode;
	try {
		mode = localStorage.getItem('athena-mode') || defaultMode;
	} catch (e) {}
	function apply(next, persist) {
		mode = ['light', 'dark', 'system'].includes(next) ? next : defaultMode;
		var dark = mode === 'system' ? system.matches : mode === 'dark';
		root.dataset.theme = dark ? 'dark' : 'light';
		root.dataset.darkmode = String(dark);
		root.dataset.themeMode = mode;
		root.classList.toggle('dark', dark);
		document.querySelectorAll('[data-theme-choice]').forEach(function (button) {
			button.setAttribute('aria-pressed', String(button.dataset.themeChoice === mode));
		});
		if (persist)
			try {
				localStorage.setItem('athena-mode', mode);
			} catch (e) {}
	}
	apply(mode, false);
	// The next theme expands directly from the chosen top-right button.
	// The browser snapshots the original page; controls and form nodes stay intact.
	var reveal = null,
		revealTimer = 0,
		revealSerial = 0,
		pendingMode = mode;
	function stopReveal() {
		revealSerial++;
		if (reveal) reveal.skipTransition();
		reveal = null;
		clearTimeout(revealTimer);
		delete root.dataset.themeTransition;
		root.style.removeProperty('--athena-theme-clip');
	}
	function revealFrames(button) {
		var w = window.innerWidth,
			h = window.innerHeight,
			box = button.getBoundingClientRect();
		var cx = box.left + box.width / 2,
			cy = box.top + box.height / 2;
		var radius =
			Math.max(
				Math.hypot(cx, cy),
				Math.hypot(w - cx, cy),
				Math.hypot(cx, h - cy),
				Math.hypot(w - cx, h - cy)
			) * 1.02;
		return [0, radius].map(function (r) {
			return { clipPath: 'circle(' + r + 'px at ' + cx + 'px ' + cy + 'px)' };
		});
	}
	function changeMode(next, button) {
		stopReveal();
		pendingMode = next;
		var dark = next === 'system' ? system.matches : next === 'dark';
		if (
			root.dataset.theme === (dark ? 'dark' : 'light') ||
			document.hidden ||
			window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
			!document.startViewTransition ||
			!root.animate
		) {
			apply(next, true);
			return;
		}
		var frames = revealFrames(button),
			serial = revealSerial;
		root.dataset.themeTransition = 'droplet';
		root.style.setProperty('--athena-theme-clip', frames[0].clipPath);
		try {
			var transition = document.startViewTransition(function () {
				if (serial === revealSerial) apply(next, true);
			});
			reveal = transition;
			transition.ready
				.then(function () {
					if (serial !== revealSerial) return;
					return root.animate(frames, {
						duration: 700,
						easing: 'cubic-bezier(.22,.7,.25,1)',
						fill: 'forwards',
						pseudoElement: '::view-transition-new(root)'
					}).finished;
				})
				.catch(function () {
					if (serial === revealSerial) {
						apply(next, true);
						root.style.setProperty('--athena-theme-clip', frames.at(-1).clipPath);
					}
				});
			transition.finished
				.catch(function () {})
				.finally(function () {
					if (serial === revealSerial) stopReveal();
				});
			revealTimer = setTimeout(function () {
				if (serial === revealSerial) {
					apply(next, true);
					stopReveal();
				}
			}, 1600);
		} catch (e) {
			apply(next, true);
			stopReveal();
		}
	}
	system.addEventListener('change', function () {
		if (mode === 'system') {
			stopReveal();
			apply(mode, false);
		}
	});
	window.addEventListener('storage', function (event) {
		if (event.key === 'athena-mode' || event.key === null) {
			stopReveal();
			apply(event.newValue, false);
		}
	});
	document.addEventListener('visibilitychange', function () {
		if (document.hidden && reveal) {
			apply(pendingMode, true);
			stopReveal();
		}
	});
	document.addEventListener('athena:mode-controls', function () {
		apply(mode, false);
	});
	document.addEventListener('click', function (event) {
		var button = event.target.closest('[data-theme-choice]');
		if (button) changeMode(button.dataset.themeChoice, button);
		var toggle = event.target.closest('[data-login-password-toggle]');
		if (toggle) {
			var input = document.getElementById('luci_password');
			if (!input) return;
			input.type = input.type === 'password' ? 'text' : 'password';
			toggle.setAttribute(
				'aria-label',
				input.type === 'password'
					? toggle.dataset.labelShow || '显示密码'
					: toggle.dataset.labelHide || '隐藏密码'
			);
			toggle.setAttribute('aria-pressed', String(input.type === 'text'));
			toggle
				.querySelector('use')
				?.setAttribute(
					'href',
					'/luci-static/athena/icons/sprite.svg#' + (input.type === 'password' ? 'eye' : 'eyeOff')
				);
		}
	});
	document.addEventListener('DOMContentLoaded', function () {
		recoverStyles(document.getElementById('athena-stylesheet'));
		// Plugin-owned button tabs are not native LuCI content panes. Mark them before
		// LuCI's DOM-ready initialization, which otherwise creates an empty tab menu.
		document.querySelectorAll('.oc-tpl-tabs').forEach(function (group) {
			if (
				group.querySelector(':scope > button[data-tab]') &&
				!group.querySelector('[data-tab-title]')
			)
				group.setAttribute('data-initialized', 'true');
		});
		apply(mode, false);
		if (document.body.dataset.logo)
			document.querySelectorAll('[data-athena-logo]').forEach(function (image) {
				image.src = document.body.dataset.logo;
			});
		document.querySelector('body.athena-login-screen input[type="password"]')?.focus();
	});
})();
