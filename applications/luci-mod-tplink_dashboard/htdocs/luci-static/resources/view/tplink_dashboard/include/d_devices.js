'use strict';
'require baseclass';
'require rpc';
'require fs';  // Required for CPU load fetching

// System Info
var callSystemBoard = rpc.declare({
    object: 'system',
    method: 'board'
});

var callSystemInfo = rpc.declare({
    object: 'system',
    method: 'info'
});

// Memory Info
var callMemoryInfo = rpc.declare({
    object: 'system',
    method: 'info'
});

// Storage Info
var callMountPoints = rpc.declare({
    object: 'luci',
    method: 'getMountPoints',
    expect: { result: [] }
});

var MountSkipList = [
    "/rom",
    "/tmp",
    "/dev",
    "/overlay",
    "/",
];

function progressbar(value, max, byte) {
    var vn = parseInt(value) || 0,
        mn = parseInt(max) || 100,
        fv = byte ? String.format('%1024.2mB', value) : value,
        fm = byte ? String.format('%1024.2mB', max) : max,
        pc = Math.floor((100 / mn) * vn);

    return E('div', {
        'class': 'cbi-progressbar-tplink',
        'title': '%s / %s (%d%%)'.format(fv, fm, pc)
    }, E('div', { 'style': 'width:%.2f%%'.format(pc) }));
}

// Function to create a styled card for system information
function createInfoCard(title, value) {
    return E('div', { 'class': 'info-card' }, [
        E('h3', {}, [title]),
        E('p', {}, [value || '?']),
    ]);
}

// CPU usage integration
var cpuStatArray = null;  // To store previous CPU stats

function loadCpuData() {
    return L.resolveDefault(fs.read('/proc/stat'), null);
}

function renderCpuUsage(cpuData) {
    if (!cpuData) return;

    let cpuStatArrayNew = [];
    let statItemsArray = cpuData.trim().split('\n').filter(s => s.startsWith('cpu'));

    for (let str of statItemsArray) {
        let arr = str.split(/\s+/).slice(0, 8);
        arr[0] = (arr[0] === 'cpu') ? Infinity : arr[0].replace('cpu', '');
        arr = arr.map(e => Number(e));
        cpuStatArrayNew.push([
            arr[0],
            arr[1] + arr[2] + arr[3] + arr[5] + arr[6] + arr[7],
            arr[4],
        ]);
    }

    cpuStatArrayNew.sort((a, b) => a[0] - b[0]);

    let cpuTable = E('div', { 'class': 'cpu-info' });

    // For single-core CPU (hide 'total')
    if (cpuStatArrayNew.length === 2) {
        cpuStatArrayNew = cpuStatArrayNew.slice(0, 1);
    }

    cpuStatArrayNew.forEach((c, i) => {
        let loadAvg = 0;
        if (cpuStatArray !== null) {
            let idle = c[2] - cpuStatArray[i][2];
            let sum = c[1] - cpuStatArray[i][1];
            loadAvg = Math.round(100 * sum / (sum + idle));
        }

        cpuTable.append(
            E('div', { 'class': 'cpu-progress' }, [
                E('h3', {}, (cpuStatArrayNew[i][0] === Infinity) ? _('Total Load') : _('CPU') + ' ' + cpuStatArrayNew[i][0]),
                E('div', {
                        'class': 'cbi-progressbar-tplink',
                        'title': (cpuStatArray !== null) ? loadAvg + '%' : _('Calculating') + '...',
                    },
                    E('div', { 'style': 'width:' + loadAvg + '%' })
                )
            ])
        );
    });

    cpuStatArray = cpuStatArrayNew;
    return cpuTable;
}

return baseclass.extend({
    title: _('Device Details'),

    load: function() {
        return Promise.all([
            L.resolveDefault(callSystemBoard(), {}),
            L.resolveDefault(callSystemInfo(), {}),
            L.resolveDefault(callMemoryInfo(), {}),
            L.resolveDefault(callMountPoints(), {}),
            loadCpuData()  // Load CPU data
        ]);
    },

    render: function(data) {
        var boardinfo = data[0],
            systeminfo = data[1],
            memoryinfo = data[2],
            mounts = data[3],
            cpuData = data[4];  // CPU data

        // ** System Information Section **
        var systemFields = [
            _('Device Name'), boardinfo.hostname,
            _('Uptime'), systeminfo.uptime ? '%t'.format(systeminfo.uptime) : '?',
            _('Kernel Version'), boardinfo.kernel,
            _('Firmware Version'), (L.isObject(boardinfo.release) ? boardinfo.release.description : '')
        ];

        var systemInfoCards = E('div', { 'class': 'system-info-cards' });
        for (var i = 0; i < systemFields.length; i += 2) {
            var card = createInfoCard(systemFields[i], systemFields[i + 1]);
            systemInfoCards.appendChild(card);
        }

        // ** Memory Information Section with Progress Bar **
        var mem = L.isObject(memoryinfo.memory) ? memoryinfo.memory : {};
        var totalMemory = mem.total || 0;
        var usedMemory = (mem.total && mem.free) ? (mem.total - mem.free) : 0;
        var availableMemory = mem.free || 0;
        var cachedMemory = mem.cached || 0; // Added cached memory calculation

        var memoryProgress = progressbar(usedMemory, totalMemory, true);

        // Memory information details
        var memoryDetails = E('div', { 'class': 'memory-info-details' }, [
            createInfoCard(_('Total Memory'), String.format('%1024.2mB', totalMemory)),
            createInfoCard(_('Used Memory'), String.format('%1024.2mB', usedMemory)),
            createInfoCard(_('Cached Memory'), String.format('%1024.2mB', cachedMemory)) // Added cached memory card
        ]);

        // ** Storage Information Section with Progress Bar **
        var root = L.isObject(systeminfo.root) ? systeminfo.root : {};
        var tmp = L.isObject(systeminfo.tmp) ? systeminfo.tmp : {}; // Get temp storage info

        var totalStorage = root.total * 1024 || 0;
        var usedStorage = root.used * 1024 || 0;
        var freeStorage = totalStorage - usedStorage;

        var totalTempStorage = tmp.total * 1024 || 0; // Total temp space
        var usedTempStorage = tmp.used * 1024 || 0;   // Used temp space
        var freeTempStorage = totalTempStorage - usedTempStorage; // Free temp space

        var storageProgress = progressbar(usedStorage, totalStorage, true);
        var tempStorageProgress = progressbar(usedTempStorage, totalTempStorage, true); // Temp storage progress bar

        // Storage information details
        var storageDetails = E('div', { 'class': 'storage-info-details' }, [
            createInfoCard(_('Total Storage'), String.format('%1024.2mB', totalStorage)),
            createInfoCard(_('Used Storage'), String.format('%1024.2mB', usedStorage)),
            createInfoCard(_('Free Storage'), String.format('%1024.2mB', freeStorage)),
        ]);
        
        // Temp storage information details
        var tempStorageDetails = E('div', { 'class': 'storage-info-details' }, [
            createInfoCard(_('Total Temp Space'), String.format('%1024.2mB', totalTempStorage)), // Total Temp Space card
            createInfoCard(_('Used Temp Space'), String.format('%1024.2mB', usedTempStorage)), // Used Temp Space card
            createInfoCard(_('Free Temp Space'), String.format('%1024.2mB', freeTempStorage))  // Free Temp Space card
        ]);

        // CPU Usage Section
        var cpuUsageTable = renderCpuUsage(cpuData);  // Render CPU usage with creative progress

        // Combine all sections
        var container = E('div', {}, [
            E('h2', { 'class': 'h2-System-Information' }, _('System Information')),
            systemInfoCards,
            E('h2', { 'class': 'h2-Information' }, _('CPU Usage')),  // CPU usage heading
            cpuUsageTable,  // Add CPU usage section
            E('h2', { 'class': 'h2-Information' }, _('Memory Information')),
            memoryProgress, // Display memory progress bar
            memoryDetails,  // Display memory details
            E('h2', { 'class': 'h2-Information'}, _('Storage Information')),
            storageProgress, // Display storage progress bar
            storageDetails,  // Display storage details
            E('h2', { 'class': 'h2-Information'}, _('Temp Storage Information')),
            tempStorageProgress, // Display temp storage progress bar
            tempStorageDetails, // Display temp storage details
            E('div', { style: 'height: 50px;' }) // Add space at the bottom of the page
        ]);

        return container;
    },
});
