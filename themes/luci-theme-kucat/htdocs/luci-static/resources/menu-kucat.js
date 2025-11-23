/*
 *  luci-theme-kucat
 *  Copyright (C) 2019-2025 The Sirpdboy <herboy2008@gmail.com> 
 *
 *  Have a bug? Please create an issue here on GitHub!
 *      https://github.com/sirpdboy/luci-theme-kucat/issues
 *
 *  luci-theme-bootstrap:
 *      Copyright 2008 Steven Barth <steven@midlink.org>
 *      Copyright 2008 Jo-Philipp Wich <jow@openwrt.org>
 *      Copyright 2012 David Menting <david@nut-bolt.nl>
 *
 *  luci-theme-material:
 *      https://github.com/LuttyYang/luci-theme-material/
 *  luci-theme-opentopd:
 *      https://github.com/sirpdboy/luci-theme-opentopd
 *
 *  Licensed to the public under the Apache License 2.0
 */

'use strict';
'require baseclass';
'require ui';

/**
 * Lightweight animation utilities for menu interactions
 */
const KucatAnimations = {
    durations: {
        fast: 200,
        normal: 300,
        slow: 400
    },

    /**
     * Smooth slide down animation
     */
    slideDown: function(element, duration = 'normal') {
        if (!element) return;
        
        const animDuration = typeof duration === 'string' ? 
            this.durations[duration] || this.durations.normal : 
            duration;
        
        // Store original state
        const originalDisplay = element.style.display;
        const originalHeight = element.style.height;
        
        // Prepare for animation
        element.style.display = 'block';
        element.style.overflow = 'hidden';
        element.style.height = '0px';
        element.style.transition = `height ${animDuration}ms ease-out`;
        
        // Trigger animation
        requestAnimationFrame(() => {
            element.style.height = element.scrollHeight + 'px';
        });
        
        // Clean up after animation
        setTimeout(() => {
            element.style.height = originalHeight;
            element.style.overflow = '';
            element.style.transition = '';
            if (originalDisplay === 'none') {
                element.style.display = 'block';
            }
        }, animDuration);
    },

    /**
     * Smooth slide up animation
     */
    slideUp: function(element, duration = 'normal') {
        if (!element) return;
        
        const animDuration = typeof duration === 'string' ? 
            this.durations[duration] || this.durations.normal : 
            duration;
        
        // Store original state
        const originalHeight = element.style.height;
        
        // Prepare for animation
        element.style.overflow = 'hidden';
        element.style.height = element.scrollHeight + 'px';
        element.style.transition = `height ${animDuration}ms ease-out`;
        
        // Trigger animation
        requestAnimationFrame(() => {
            element.style.height = '0px';
        });
        
        // Clean up after animation
        setTimeout(() => {
            element.style.display = 'none';
            element.style.height = originalHeight;
            element.style.overflow = '';
            element.style.transition = '';
        }, animDuration);
    }
};

/**
 * Kucat Theme Menu Handler
 * Optimized for mobile responsiveness and CSS compatibility
 */
return baseclass.extend({
    __init__: function() {
        ui.menu.load().then(L.bind(this.render, this));
    },

    render: function(tree) {
        var node = tree,
            url = '';

        // Render main menu structure
        this.renderModeMenu(tree);

        // Render tab menu for deep navigation
        if (L.env.dispatchpath.length >= 3) {
            for (var i = 0; i < 3 && node; i++) {
                node = node.children[L.env.dispatchpath[i]];
                url = url + (url ? '/' : '') + L.env.dispatchpath[i];
            }

            if (node) {
                this.renderTabMenu(node, url);
            }
        }

        // Initialize sidebar functionality
        this.initSidebar();

        // Hide loading indicator
        this.hideLoading();

        // Initialize responsive behavior
        this.initResponsive();
    },

    /**
     * Initialize sidebar toggle functionality
     */
    initSidebar: function() {
        var showSide = document.querySelector('.showSide');
        var darkMask = document.querySelector('.darkMask');

        if (showSide) {
            showSide.addEventListener('click', L.bind(this.toggleSidebar, this));
        }
        
        if (darkMask) {
            darkMask.addEventListener('click', L.bind(this.toggleSidebar, this));
        }
    },

    /**
     * Initialize responsive behavior
     */
    initResponsive: function() {
        // Set initial state for mobile
        if (window.innerWidth <= 920) {
            this.closeSidebar();
        }

        // Add resize handler with debouncing
        let resizeTimeout;
        window.addEventListener('resize', L.bind(function() {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleResize();
            }, 100);
        }, this));
    },

    /**
     * Handle window resize events
     */
    handleResize: function() {
        var width = window.innerWidth;
        var mainLeft = document.querySelector('.main-left');
        var darkMask = document.querySelector('.darkMask');

        if (width > 920) {
            // Desktop - ensure sidebar is visible
            if (mainLeft) {
                mainLeft.style.width = '';
                mainLeft.style.visibility = 'visible';
            }
            if (darkMask) {
                darkMask.style.visibility = 'hidden';
                darkMask.style.opacity = '0';
            }
        } else {
            // Mobile - ensure sidebar is hidden by default
            this.closeSidebar();
        }
    },

    /**
     * Toggle sidebar visibility (mobile)
     */
    toggleSidebar: function() {
        var mainLeft = document.querySelector('.main-left');
        var darkMask = document.querySelector('.darkMask');
        var mainRight = document.querySelector('.main-right');
        var showSide = document.querySelector('.showSide');

        if (!mainLeft || !darkMask) return;

        var isOpen = mainLeft.style.width !== '0px' && mainLeft.style.width !== '0';

        if (isOpen) {
            this.closeSidebar();
        } else {
            this.openSidebar();
        }
    },

    /**
     * Open sidebar (mobile)
     */
    openSidebar: function() {
        var mainLeft = document.querySelector('.main-left');
        var darkMask = document.querySelector('.darkMask');
        var mainRight = document.querySelector('.main-right');

        if (mainLeft) {
            mainLeft.style.width = '15rem';
            mainLeft.style.visibility = 'visible';
        }
        if (darkMask) {
            darkMask.style.visibility = 'visible';
            darkMask.style.opacity = '1';
        }
        if (mainRight) {
            mainRight.style.overflowY = 'hidden';
        }

        // Add active class for CSS targeting
        document.body.classList.add('sidebar-open');
    },

    /**
     * Close sidebar (mobile)
     */
    closeSidebar: function() {
        var mainLeft = document.querySelector('.main-left');
        var darkMask = document.querySelector('.darkMask');
        var mainRight = document.querySelector('.main-right');

        if (mainLeft) {
            mainLeft.style.width = '0';
            mainLeft.style.visibility = 'hidden';
        }
        if (darkMask) {
            darkMask.style.visibility = 'hidden';
            darkMask.style.opacity = '0';
        }
        if (mainRight) {
            mainRight.style.overflowY = 'auto';
        }

        // Remove active class
        document.body.classList.remove('sidebar-open');
    },

    /**
     * Hide loading indicator
     */
    hideLoading: function() {
        var loading = document.querySelector('.main > .loading');
        if (loading) {
            loading.style.opacity = '0';
            loading.style.visibility = 'hidden';
            
            // Remove from DOM after fade out
            setTimeout(() => {
                if (loading && loading.parentNode) {
                    loading.parentNode.removeChild(loading);
                }
            }, 300);
        }
    },

    /**
     * Handle menu expand/collapse with smooth animations
     */
    handleMenuExpand: function(ev) {
        var target = ev.target;
        var slideItem = target.parentNode;
        var slideMenu = target.nextElementSibling;

        // Prevent default behavior
        ev.preventDefault();
        ev.stopPropagation();

        if (!slideMenu || !slideMenu.classList.contains('slide-menu')) {
            return;
        }

        var isActive = slideItem.classList.contains('active');
        var allSlideItems = document.querySelectorAll('.main .main-left .nav > li.slide');

        // Close all other menus
        allSlideItems.forEach(function(item) {
            if (item !== slideItem) {
                var otherMenu = item.querySelector('.slide-menu');
                if (otherMenu && otherMenu.style.display !== 'none') {
                    item.classList.remove('active');
                    item.querySelector('a.menu').classList.remove('active');
                    KucatAnimations.slideUp(otherMenu, 'fast');
                }
            }
        });

        // Toggle current menu
        if (isActive) {
            // Close current menu
            slideItem.classList.remove('active');
            target.classList.remove('active');
            KucatAnimations.slideUp(slideMenu, 'fast');
        } else {
            // Open current menu
            slideItem.classList.add('active');
            target.classList.add('active');
            KucatAnimations.slideDown(slideMenu, 'fast');
        }

        // Remove focus from clicked element
        target.blur();
    },

    /**
     * Render main navigation menu
     */
    renderMainMenu: function(tree, url, level) {
        var currentLevel = (level || 0) + 1;
        var ul = E('ul', { 'class': level ? 'slide-menu' : 'nav' });
        var children = ui.menu.getChildren(tree);

        if (children.length === 0 || currentLevel > 2) {
            return E([]);
        }

        for (var i = 0; i < children.length; i++) {
            var child = children[i];
            var isActive = this.isMenuItemActive(child, tree, currentLevel);
            var submenu = this.renderMainMenu(child, url + '/' + child.name, currentLevel);
            var hasChildren = submenu.children.length > 0;
            
            var slideClass = hasChildren ? 'slide' : '';
            var menuClass = hasChildren ? 'menu' : '';
            
            if (isActive) {
                slideClass += ' active';
                menuClass += ' active';
                ul.classList.add('active');
            }

            var menuItem = E('li', { 
                'class': slideClass.trim()
            }, [
                E('a', {
                    'href': L.url(url, child.name),
                    'click': (currentLevel === 1 && hasChildren) ? 
                             ui.createHandlerFn(this, 'handleMenuExpand') : null,
                    'class': menuClass.trim(),
                    'data-title': child.title.replace(/ /g, '_'),
                }, [_(child.title)]),
                submenu
            ]);

            ul.appendChild(menuItem);
        }

        // Append to main menu container for top level
        if (currentLevel === 1) {
            var container = document.querySelector('#mainmenu');
            if (container) {
                container.appendChild(ul);
                container.style.display = '';
            }
        }

        return ul;
    },

    /**
     * Check if menu item is active based on current path
     */
    isMenuItemActive: function(child, parent, level) {
        return (L.env.dispatchpath[level] === child.name) && 
               (L.env.dispatchpath[level - 1] === parent.name);
    },

    /**
     * Render mode menu (top level categories)
     */
    renderModeMenu: function(tree) {
        var ul = document.querySelector('#modemenu');
        var children = ui.menu.getChildren(tree);

        if (!ul) return;

        for (var i = 0; i < children.length; i++) {
            var isActive = (L.env.requestpath.length ? 
                children[i].name == L.env.requestpath[0] : i == 0);

            ul.appendChild(E('li', {}, [
                E('a', {
                    'href': L.url(children[i].name),
                    'class': isActive ? 'active' : null
                }, [_(children[i].title)])
            ]));

            if (isActive) {
                this.renderMainMenu(children[i], children[i].name);
            }

            // Add divider between menu items (except last)
            if (i > 0 && i < children.length - 1) {
                ul.appendChild(E('li', {'class': 'divider'}, [E('span')]));
            }
        }

        if (children.length > 1) {
            ul.parentElement.style.display = '';
        }
    },

    /**
     * Render tab menu for sub-navigation
     */
    renderTabMenu: function(tree, url, level) {
        var container = document.querySelector('#tabmenu');
        var currentLevel = (level || 0) + 1;
        var ul = E('ul', { 'class': 'tabs' });
        var children = ui.menu.getChildren(tree);
        var activeNode = null;

        if (children.length === 0 || !container) {
            return E([]);
        }

        for (var i = 0; i < children.length; i++) {
            var child = children[i];
            var isActive = (L.env.dispatchpath[currentLevel + 2] === child.name);
            var activeClass = isActive ? ' active' : '';
            var className = 'tabmenu-item-%s %s'.format(child.name, activeClass);

            ul.appendChild(E('li', { 
                'class': className.trim()
            }, [
                E('a', { 
                    'href': L.url(url, child.name) 
                }, [_(child.title)])
            ]));

            if (isActive) {
                activeNode = child;
            }
        }

        container.appendChild(ul);
        container.style.display = '';

        // Recursively render nested tabs
        if (activeNode) {
            container.appendChild(this.renderTabMenu(
                activeNode, 
                url + '/' + activeNode.name, 
                currentLevel
            ));
        }

        return ul;
    }
});