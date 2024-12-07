'use strict';
'require baseclass';
'require fs';
'require rpc';
'require network';

// Declare system and board RPC calls
var callSystemBoard = rpc.declare({
    object: 'system',
    method: 'board'
});

var callSystemInfo = rpc.declare({
    object: 'system',
    method: 'info'
});

return baseclass.extend({
    params: [],

    // Load function to retrieve only IPv4 WAN network information
    load: function() {
        return network.getWANNetworks();  // Get only IPv4 WAN
    },

    // Function to update WAN data for IPv4
    renderUpdateWanData: function(data) {
        var min_metric = 2000000000;
        var min_metric_i = 0;

        for (var i = 0; i < data.length; i++) {
            var metric = data[i].getMetric();
            if (metric < min_metric) {
                min_metric = metric;
                min_metric_i = i;
            }
        }

        var ifc = data[min_metric_i];
        if (ifc) {
            var uptime = ifc.getUptime();
            this.params.internet.v4.uptime.value = (uptime > 0) ? '%t'.format(uptime) : '-';
            this.params.internet.v4.protocol.value = ifc.getI18n() || _('Not connected');
            this.params.internet.v4.gatewayv4.value = ifc.getGatewayAddr() || '0.0.0.0';
            this.params.internet.v4.connected.value = ifc.isUp();
            this.params.internet.v4.addrsv4.value = ifc.getIPAddrs() || ['-'];
            this.params.internet.v4.dnsv4.value = ifc.getDNSAddrs() || ['-'];
        }
    },

    // Function to render the internet section (IPv4 Only)
    renderInternetBox: function(data) {
        // Initialize this.params if it doesn't exist
        if (!this.params) {
            this.params = {};
        }

        // Define internet status parameters (IPv4 Only)
        this.params.internet = {
            v4: {
                title: _('IPv4 Internet'),
                connected: { title: _('Connected'), visible: true, value: false },
                uptime: { title: _('Uptime'), visible: true, value: '-' },
                protocol: { title: _('Protocol'), visible: true, value: '-' },
                addrsv4: { title: _('IPv4 Address'), visible: true, value: ['-'] },
                gatewayv4: { title: _('Gateway V4'), visible: true, value: '-' },
                dnsv4: { title: _('DNS V4'), visible: true, value: ['-'] }
            }
        };

        // Update WAN data for IPv4
        this.renderUpdateWanData(data);  // IPv4 Only

        // Create container for displaying Internet status
        var container = E('div', { 'class': 'internet-status creative-design' });

        // Render IPv4 section with icons and styled labels
        container.appendChild(E('div', { 'class': 'internet-card ipv4-card' }, [
            E('div', { 'class': 'status-line' }, [
                E('span', { 'class': 'status-label' }, _('Connected') + ': '),
                E('span', { 'class': 'status-value ' + (this.params.internet.v4.connected.value ? 'connected' : 'disconnected') },
                  this.params.internet.v4.connected.value ? _('Yes') : _('No'))
            ]),
            E('div', { 'class': 'status-line' }, [
                E('span', { 'class': 'status-label' }, _('Uptime') + ': '),
                E('span', { 'class': 'status-value' }, this.params.internet.v4.uptime.value)
            ]),
            E('div', { 'class': 'status-line' }, [
                E('span', { 'class': 'status-label' }, _('IPv4 Address') + ': '),
                E('span', { 'class': 'status-value' }, this.params.internet.v4.addrsv4.value.join(', '))
            ]),
            E('div', { 'class': 'status-line' }, [
                E('span', { 'class': 'status-label' }, _('Gateway') + ': '),
                E('span', { 'class': 'status-value' }, this.params.internet.v4.gatewayv4.value)
            ]),
            E('div', { 'class': 'status-line' }, [
                E('span', { 'class': 'status-label' }, _('DNS') + ': '),
                E('span', { 'class': 'status-value' }, this.params.internet.v4.dnsv4.value.join(', '))
            ])
        ]));

        return container;
    },

    // Render function to display only the IPv4 internet box
    render: function(data) {
        return this.renderInternetBox(data);
    }
});

