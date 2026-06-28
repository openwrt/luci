// See https://github.com/acmesh-official/acme.sh/wiki/DNS-API-Structural-Info-description
class DnsApiInfo {
	Id = '';
	Name = '';
	Domains = '';
	OptsTitle = '';
	Opts = [];
	OptsAltTitle = '';
	OptsAlt = [];
}

class DnsApiInfoOpt {
	Name = '';
	Title = '';
	Description = '';
	Default = '';
}

function parseFile(infoFileText) {
	let infoFileLines = infoFileText.split('\n');
	let infos = [];
	let startIdx = 0;
	for (let i = 1; i < infoFileLines.length; i++) {
		if (infoFileLines[i] == '') {
			if (i - startIdx > 2) {
				let infoLines = infoFileLines.slice(startIdx, i);
				let info = parseDnsApiInfoLines(infoLines);
				infos.push(info);
			}
			startIdx = i + 1;
		}
	}
	return infos;
}

function parseDnsApiInfoLines(lines) {
	let info = new DnsApiInfo();
	info.Id = lines.shift();
	info.Name = lines.shift();
	let optsField = getFieldVal(lines, 'Options:');
	let [optsTitle, opts] = parseOpts(optsField);
	info.OptsTitle = optsTitle;
	info.Opts = opts;
	let optsAltField = getFieldVal(lines, 'OptionsAlt:');
	let [optsAltTitle, optsAlt] = parseOpts(optsAltField);
	info.OptsAltTitle = optsAltTitle;
	info.OptsAlt = optsAlt;
	info.Domains = getFieldVal(lines, 'Domains:');
	return info;
}

function parseOpts(options) {
	let opts = [];
	let optLines = options.split('\n');
	let optsTitle = optLines.shift();
	for (let optLine of optLines) {
		let posName = optLine.indexOf(' ');
		if (posName <= 0) {
			continue;
		}
		let opt = new DnsApiInfoOpt();
		opt.Name = optLine.substring(0, posName);
		let posTitle = optLine.indexOf('.');
		if (posTitle <= 0) {
			opt.Title = optLine.substring(posName + 1);
		} else {
			opt.Title = optLine.substring(posName + 1, posTitle);
			opt.Description = optLine.substring(posTitle);
			let defaultPos = opt.Description.indexOf(' Default: "');
			if (defaultPos >= 0) {
				let defaultPosEnd = opt.Description.indexOf('".', defaultPos + 1);
				opt.Default = opt.Description.substring(defaultPos + ' Default: "'.length, defaultPosEnd);
				opt.Description = opt.Description.substring(0, defaultPos);
			}
			if (opt.Description.startsWith('. ')) {
				opt.Description = opt.Description.substring(2);
			} else if (opt.Description == '.') {
				opt.Description = '';
			}
		}
		opts.push(opt);
	}
	return [optsTitle, opts];
}

function getFieldVal(lines, fieldName) {
	for (let i = 0; i < lines.length; i++) {
		if (lines[i].startsWith(fieldName)) {
			let firstVal = lines[i].substring(fieldName.length).trim();
			let nextLines = lines.slice(i + 1);
			return fieldMultiLines(nextLines, firstVal);
		}
	}
	return '';
}

function fieldMultiLines(lines, fieldVal) {
	while (lines.length > 0) {
		if (!lines[0].startsWith(' ')) {
			break;
		}
		let line = lines.shift().trim();
		fieldVal += '\n' + line;
	}
	return fieldVal;
}

return L.Class.extend({
	parseFile: parseFile,
});
