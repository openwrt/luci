'use strict';
'require view';
'require dom';
'require network';
'require rpc';

// Add custom stylesheet
document.querySelector('head').appendChild(E('link', {
    'rel': 'stylesheet',
    'type': 'text/css',
    'href': L.resource('view/tplink_dashboard/css/custom.css')
}));

// RPC call to get system board info (for model name)
var callSystemBoard = rpc.declare({
    object: 'system',
    method: 'board'
});

// Set a default value for device model
var deviceModelName = 'Router';

// Track the active polling interval so we can clear it when switching icons
var activeInterval = null;

// Function to create an icon with label and optional badge
function createIcon(src, title, onClick, clickedSrc, label, showBadge) {
    var iconDiv = E('div', { 'class': 'icon-container', 'title': title, 'style': 'position: relative;' });

    // Create the image for the icon
    var iconImg = E('img', {
        'src': L.resource('view/tplink_dashboard/icons/' + src),
        'class': 'icon',
        'data-inactive': src,
        'data-active': clickedSrc
    });
    iconDiv.appendChild(iconImg);

    // Create the label for the icon
    var iconLabel = E('div', { 'class': 'icon-label' }, [label]);
    iconDiv.appendChild(iconLabel);

    // Optionally add a badge
    var badge;
    if (showBadge) {
        badge = E('span', {
            'class': 'notification-badge',
            'style': 'display: none;' // Hide it initially
        }, ['0']);
        iconDiv.appendChild(badge);
    }

    // Add click event handler
    iconDiv.addEventListener('click', function () {
        resetIcons();
        iconImg.src = L.resource('view/tplink_dashboard/icons/' + clickedSrc);
        iconLabel.classList.add('active'); // Add active class to the label
        onClick(badge);
    });

    return { iconDiv, badge }; // Return both iconDiv and badge (badge can be undefined)
}

// Function to reset icons and labels
function resetIcons() {
    var allIcons = document.querySelectorAll('.icon-container img');
    allIcons.forEach(function (icon) {
        icon.src = L.resource('view/tplink_dashboard/icons/' + icon.getAttribute('data-inactive'));
    });

    var allLabels = document.querySelectorAll('.icon-label');
    allLabels.forEach(function (label) {
        label.classList.remove('active');
    });

    // Ensure the DHCP badge is visible
    var dhcpBadge = document.querySelector('.dhcp-badge');
    if (dhcpBadge) {
        dhcpBadge.style.display = 'block';
    }

    // Clear any existing polling interval when switching icons
    if (activeInterval) {
        clearInterval(activeInterval);
        activeInterval = null;
    }
}

// Main view rendering
return view.extend({
    render: function () {
        var container = E('div', { 'class': 'dashboard-container' });
        var detailContainer = E('div', { 'id': 'detail-container', 'class': 'detail-container' });

        // Fetch device model name first
        return callSystemBoard().then(function(boardInfo) {
            if (boardInfo.model) {
                deviceModelName = boardInfo.model;
            }

            // Internet connection icon
            let internetIcon = createIcon('internet.png', _('Internet Connection'), function (badge) {
                L.require('view.tplink_dashboard.include.d_internet').then(function (internet) {
                    startPolling([internet], [detailContainer]);
                    updateInternetBadge(badge);

                    // Clear any existing interval and set a new one for Internet
                    if (activeInterval) clearInterval(activeInterval);
                    activeInterval = setInterval(function() {
                        startPolling([internet], [detailContainer]);
                        updateInternetBadge(badge);
                    }, 15000);  // 15000 milliseconds = 15 seconds
                });
            }, 'internet_active.png', _('Internet'), true); 
            internetIcon.badge.classList.add('internet-badge'); 
            container.appendChild(internetIcon.iconDiv);

            container.appendChild(createSeparator());

            // Device details icon (now with fetched model name)
            let devicesIcon = createIcon('devices.png', _('Device Details'), function () {
                L.require('view.tplink_dashboard.include.d_devices').then(function (devices) {
                    startPolling([devices], [detailContainer]);

                    // Clear any existing interval as devices icon doesn't need refreshing
                    if (activeInterval) clearInterval(activeInterval);
                    activeInterval = setInterval(function() {
                        startPolling([devices], [detailContainer]);
                    }, 5000);  // 15000 milliseconds = 15 seconds
                });
            }, 'devices_active.png', deviceModelName, false); 
            container.appendChild(devicesIcon.iconDiv);

            container.appendChild(createSeparator());

            // DHCP information icon
            let dhcpIcon = createIcon('dhcp.png', _('DHCP Information'), function (badge) {
                L.require('view.tplink_dashboard.include.d_dhcp').then(function (dhcp) {
                    startPolling([dhcp], [detailContainer]);
                    updateDhcpBadge(badge);

                    // Clear any existing interval and set a new one for DHCP
                    if (activeInterval) clearInterval(activeInterval);
                    activeInterval = setInterval(function() {
                        startPolling([dhcp], [detailContainer]);
                        updateDhcpBadge(badge);
                    }, 15000);  // 15000 milliseconds = 15 seconds
                });
            }, 'dhcp_active.png', _('Clients'), true); 
            dhcpIcon.badge.classList.add('dhcp-badge'); 
            container.appendChild(dhcpIcon.iconDiv);

            // Initial updates for DHCP and Internet badges
            updateDhcpBadge(dhcpIcon.badge);
            updateInternetBadge(internetIcon.badge);

            return E('div', {}, [container, detailContainer]);
        });
    }
});

// Helper functions
function createSeparator() {
    return E('div', { 'class': 'separator' });
}

function updateDhcpBadge(badge) {
    L.require('view.tplink_dashboard.include.d_dhcp').then(function (dhcp) {
        dhcp.load().then(function (data) {
            var leases = data[0].dhcp_leases || [];
            var connectedClients = leases.length;
            if (badge) {
                badge.textContent = connectedClients;
                badge.style.display = 'block';
            }
        });
    });
}

function updateInternetBadge(badge) {
    network.getWANNetworks().then(function (data) {
        var connected = data[0] && data[0].isUp();
        if (badge) {
            var badgeIcon = connected ? 'yes.png' : 'no.png';
            badge.style.backgroundImage = `url(${L.resource('view/tplink_dashboard/icons/' + badgeIcon)})`;
            badge.style.backgroundSize = 'cover';
            badge.textContent = '';
            badge.style.display = 'block';
        }
    });
}

function startPolling(includes, containers) {
    var step = function () {
        return network.flushCache().then(function () {
            return invokeIncludesLoad(includes);
        }).then(function (results) {
            for (var i = 0; i < includes.length; i++) {
                if (includes[i].failed) continue;
                var content = includes[i].render ? includes[i].render(results[i]) : includes[i].content;
                if (content) {
                    containers[i].parentNode.style.display = '';
                    containers[i].parentNode.classList.add('fade-in');
                    dom.content(containers[i], content);
                }
            }
        });
    };
    step();
}

function invokeIncludesLoad(includes) {
    return Promise.all(includes.map(function (include) {
        return include.load().catch(function (err) {
            include.failed = true;
            console.error('Error loading include:', err);
        });
    }));
}
