//
// Rendering of DSL spectrum graphs  showing
// US/DS SNR and US/DS bits/tone
//
// This version does depend on an ubus version that support DSL line stattiscis  but 
// does not depend on chart.js or any other package

class DataSet {
	constructor (input, extractFunction) {
		this.groupSize = input.groupsize;
		this.numData = input.groups;
		// needs to be validated with various input
		this.maxX = this.numData * this.groupSize;
		this.data = input.data.map(extractFunction,
			{groupSize: this.groupSize}
		);
	}
}

function myBitsFunction(value, index, array) {
	return({x: index, y: value, error: false});
}

function mySnrFunction(value, index, array) {
	let result;

	if (value == null) {
		result = {
			x: index * this.groupSize,
			y: -40 ,
			error: true
		}
	} else {
		result = {
			x: index * this.groupSize,
			y: value,
			error: false
		}
	}

	return(result);
}

function myQLNFunction(value, index, array) {
	let result;

	if (value == null) {
		result = {
			x: index * this.groupSize,
			y:  - 150,
			error: true
		}
	} else {
		result = {
			x: index * this.groupSize,
			y:  value,
			error: false
		}
	}

	return(result);
}

function myHLOGFunction(value, index, array) {
	let result;

	if (value == null) {
		result = {
			x: index * this.groupSize,
			y: -100,
			error: true
		}
	} else {
		result = {
			x: index * this.groupSize,
			y: value,
			error: false
		}
	}

	return(result);
}

const usSnrData  = new DataSet(window.json['snr']['upstream'], mySnrFunction);
const dsSnrData  = new DataSet(window.json['snr']['downstream'], mySnrFunction);
const usBitsData = new DataSet(window.json['bits']['upstream'], myBitsFunction);
const dsBitsData = new DataSet(window.json['bits']['downstream'], myBitsFunction);
const usQLNData  = new DataSet(window.json['qln']['upstream'], myQLNFunction);
const dsQLNData  = new DataSet(window.json['qln']['downstream'], myQLNFunction);
const usHLOGData = new DataSet(window.json['hlog']['upstream'], myHLOGFunction);
const dsHLOGData = new DataSet(window.json['hlog']['downstream'], myHLOGFunction);

const marginX = 50;
const marginY = 80;
let darkMode = document.getElementsByTagName("body")[0].parentNode.dataset.darkmode;

let bitsChart = {
	"config": {
		"canvas": document.getElementById("bitsChart"),
		"ctx" : document.getElementById("bitsChart").getContext("2d"),
		"minX" : 0,
		"maxX" : Math.max(dsBitsData.maxX, usBitsData.maxX),
		"stepX": Math.max(dsBitsData.maxX, usBitsData.maxX) / 16,
		"graphWidth" : document.getElementById("bitsChart").width - 2 * marginX,
		"lineWidth" : 1,
		"titleX" : _("Sub-carrier"),
		"minY" : 0,
		"maxY" : 16,
		"stepY": 2,
		"graphHeight" : document.getElementById("bitsChart").height - 2 * marginY,
		"titleY" : _("bits")
	},
	"dataSet" : [
		{
			"data" :usBitsData.data,
			"color":"YellowGreen",
			"title": ("Upstream bits allocation")
		},
		{
			"data" : dsBitsData.data,
			"color": "navy",
			"title": _("Downstream bits allocation")
		}
	]
};

let dBChart = {
	"config": {
		"canvas": document.getElementById("dbChart"),
		"ctx" : document.getElementById("dbChart").getContext("2d"),
		"minX" : 0,
		"maxX" : Math.max(dsSnrData.maxX, usSnrData.maxX),
		"stepX": Math.max(dsSnrData.maxX, usSnrData.maxX) / 16,
		"graphWidth" : document.getElementById("dbChart").width - 2 * marginX,
		"lineWidth": 4,
		"titleX" : _("Sub-carrier"),
		"minY" : -40,
		"maxY" : 100,
		"stepY": 10,
		"graphHeight" : document.getElementById("dbChart").height - 2 * marginY,
		"titleY" : _("dB")
	},
	"dataSet" : [
		{
			"data" :usSnrData.data,
			"color":"Turquoise",
			"title": _("Upstream SNR")
		},
		{
			"data" : dsSnrData.data,
			"color": "Coral",
			"title" : _("Downstream SNR")
		}
	]
};

let qLNChart = {
	"config": {
		"canvas": document.getElementById("qlnChart"),
		"ctx" : document.getElementById("qlnChart").getContext("2d"),
		"minX" : 0,
		"maxX" : Math.max(dsQLNData.maxX, usQLNData.maxX),
		"stepX": Math.max(dsQLNData.maxX, usQLNData.maxX) / 16,
		"graphWidth" : document.getElementById("qlnChart").width - 2 * marginX,
		"lineWidth": 4,
		"titleX" : _("Sub-carrier"),
		"minY" : -150,
		"maxY" : -20,
		"stepY": 10,
		"graphHeight" : document.getElementById("qlnChart").height - 2 * marginY,
		"titleY" : _("dBm/Hz")
	},
	"dataSet" : [
		{
			"data" :usQLNData.data,
			"color":"brown",
			"title": _("Upstream QLN")
		},
		{
			"data" : dsQLNData.data,
			"color": "teal",
			"title" : _("Downstream QLN")
		}
	]
};

let hLogChart = {
	"config": {
		"canvas": document.getElementById("hlogChart"),
		"ctx" : document.getElementById("hlogChart").getContext("2d"),
		"minX" : 0,
		"maxX" : Math.max(dsHLOGData.maxX, usHLOGData.maxX),
		"stepX": Math.max(dsHLOGData.maxX, usHLOGData.maxX) / 16,
		"graphWidth" : document.getElementById("hlogChart").width - 2 * marginX,
		"lineWidth": 4,
		"titleX" : _("Sub-carrier"),
		"minY" : -100,
		"maxY" : 14,
		"stepY": 10,
		"graphHeight" : document.getElementById("hlogChart").height - 2 * marginY,
		"titleY" : _("dB")
	},
	"dataSet" : [
		{
			"data" :usHLOGData.data,
			"color":"#E8E800",
			"title": _("Upstream HLOG")
		},
		{
			"data" : dsHLOGData.data,
			"color": "darkmagenta",
			"title" : _("Downstream HLOG")
		}
	]
};

function drawChart (info) {
	drawAxisX(info.config, info.config.minX, info.config.maxX, info.config.stepX, info.config.titleX);
	drawAxisY(info.config, info.config.minY, info.config.maxY, info.config.stepY, info.config.titleY);

	drawLegend(info.config, info.dataSet);

	drawData(info.config, info.dataSet[0].data, info.dataSet[0].color);
	drawData(info.config, info.dataSet[1].data, info.dataSet[1].color);
}

function drawBlocks(config, dataPoints, color, borders) {
	borders.map(drawBlock, {config, dataPoints, color, borders});
}

function drawData(config, dataPoints, color) {
	let ctx = config.ctx;
	let len = dataPoints.length;
	let minX =config.minX;
	let maxX = config.maxX;
	let minY = config.minY;
	let maxY = config.maxY;
	let startX = (dataPoints[0].x  - config.minX) / (config.maxX - config.minX)
	let startY = (config.minY - config.minY) / (config.maxY - config.minY)

	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.moveTo(startX * config.graphWidth + marginX, marginY + config.graphHeight - startY * config.graphHeight);

	for (let i  = 1 ;  i < len  ; i++) {
		let relX = (dataPoints[i].x - minX) / (maxX - minX);
		let relY = (dataPoints[i].y - minY) / (maxY - minY);
		ctx.lineTo(relX * config.graphWidth + marginX, marginY + config.graphHeight - relY * config.graphHeight);
	}

	let endX = (dataPoints[len-1].x - minX) / (maxX - minX)
	let endY = (config.minY - minY) / (maxY - minY)

	ctx.lineTo(endX * config.graphWidth + marginX, marginY + config.graphHeight - endY * config.graphHeight);
	ctx.lineTo(startX * config.graphWidth + marginX, marginY + config.graphHeight - startY * config.graphHeight);
	ctx.closePath();
	ctx.fill();
}

function drawLegend(config, dataSet){
	let ctx = config.ctx;
	let graphWidth = config.graphWidth;
	let graphHeight = config.graphHeight;

	ctx.font = "12px Arial";
	ctx.fillStyle = dataSet[0].color;
	ctx.fillRect(0.5 * graphWidth + marginX - ctx.measureText(dataSet[0].title).width - 50, config.canvas.height - marginY*1/4 - 8, 30, 10);
	ctx.strokeStyle = "#C0C0C0";
	ctx.strokeRect(0.5 * graphWidth + marginX - ctx.measureText(dataSet[0].title).width - 50, config.canvas.height - marginY*1/4 - 8, 30, 10);

	if (darkMode == "true") {
		ctx.strokeStyle = "#505050";
		ctx.fillStyle = "#A0A0A0";
	} else {
		ctx.strokeStyle = "#303030";
		ctx.fillStyle = "#303030";
	}

	ctx.textAlign = "right"
	ctx.fillText(dataSet[0].title, 0.5 * graphWidth + marginX - 10, config.canvas.height - marginY*1/4);

	ctx.fillStyle = dataSet[1].color;
	ctx.fillRect(0.5 * graphWidth + marginX, config.canvas.height - marginY*1/4 - 8, 30, 10);
	ctx.strokeStyle = "#C0C0C0";
	ctx.strokeRect(0.5 * graphWidth + marginX, config.canvas.height - marginY*1/4 - 8, 30, 10);

	if (darkMode == "true") {
		ctx.fillStyle = "#A0A0A0";
	} else {
		ctx.fillStyle = "#303030";
	}

	ctx.textAlign = "left"
	ctx.fillText(dataSet[1].title, 0.5 * graphWidth + marginX + 40, config.canvas.height - marginY*1/4);
}

function drawAxisX(config, minValue, maxValue, step, title) {
	let ctx = config.ctx;
	let graphWidth = config.graphWidth;
	let graphHeight = config.graphHeight;

	ctx.font = "12px Arial";
	ctx.textAlign = "center";

	if (darkMode == "true") {
		ctx.strokeStyle = "#505050";
		ctx.fillStyle = "#A0A0A0";
	} else {
		ctx.strokeStyle = "#E0E0E0";
		ctx.fillStyle = "#303030";
	}

	for (let x = minValue ; x <= maxValue ; x=x+step) {
		let relX = (x - config.minX) / (config.maxX - config.minX);

		ctx.fillText(x , relX * graphWidth + marginX,  config.canvas.height - marginY*3/4);

		ctx.beginPath();
		ctx.moveTo(relX * graphWidth + marginX, marginY);
		ctx.lineTo(relX * graphWidth + marginX, config.canvas.height - marginY);
		ctx.stroke();
	}

	ctx.font = "12px Arial";
	ctx.textAlign = "center";
	ctx.fillText(title, config.canvas.width/2, config.canvas.height - marginY*2/4);
}

function drawAxisY(config, minValue, maxValue, step, title) {
	let ctx = config.ctx
	let graphWidth = config.graphWidth;
	let graphHeight = config.graphHeight;

	ctx.font = "12px Arial";
	ctx.textAlign = "center";

	if (darkMode == "true") {
		ctx.strokeStyle = "#505050";
		ctx.fillStyle = "#A0A0A0";
	} else {
		ctx.strokeStyle = "#E0E0E0";
		ctx.fillStyle = "#303030";
	}

	for (let y = minValue ; y <= maxValue ; y=y+step) {
		let relY = (y - config.minY) / (config.maxY - config.minY);

		ctx.fillText(y , marginX *2 / 3,  marginY + graphHeight - relY * graphHeight + 4);

		ctx.beginPath();
		ctx.moveTo(marginX, marginY + graphHeight - relY * graphHeight );
		ctx.lineTo(config.canvas.width - marginX, marginY + graphHeight - relY * graphHeight);
		ctx.stroke();
	}

	ctx.font = "12px Arial";
	ctx.textAlign = "center";
	ctx.translate(marginX/3, marginY + graphHeight / 2);
	ctx.rotate(-3.14 /2);
	ctx.fillText(title, 0, 0);
	ctx.rotate(3.14 /2)
	ctx.translate(-marginX/3,-(marginY + graphHeight / 2));
}

drawChart(dBChart);
drawChart(bitsChart);
drawChart(qLNChart);
drawChart(hLogChart);
