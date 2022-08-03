//
// Rendering of DSL spectrum graphs  showing
// US/DS SNR and US/DS bits/tone
//
// This version does not depend on chart.js or
// any other package

 class DataSet {
    constructor (inputString, extractFunction) {
       this.groupSize = this.getGroupSize(inputString);
       this.dataPos = this.getDataPos(inputString);
       this.numData = this.getNumData(inputString);
       if (!isNaN(this.groupSize)) {                   // this is the tricky part as output of all commands is not consistant
          this.maxX = this.numData * this.groupSize;   // needs to be validated with various input
       } else {
          this.maxX = this.numData;
          this.groupSize = 1
       }
       this.data = inputString.substr(this.dataPos).slice(0, -5).split(" ").map(extractFunction,{groupSize: this.groupSize});
   }

   getGroupSize(data) {
      let groupSizePos = data.search('nGroupSize=') + 11
      return (parseInt(data.substr(groupSizePos,2),10))
   }

   getDataPos(data) {
      let dataPos = data.search('nData=') + 7
      return (dataPos)
   }

   getNumData(data) {
      let nNumDataPos = data.search('nNumData=') + 9
      return (parseInt(data.substr(nNumDataPos,4),10))
   }

 }
 
 const usSnrData   = new DataSet(document.getElementById("usdB").innerText, mySnrFunction);
 const dsSnrData   = new DataSet(document.getElementById("dsdB").innerText, mySnrFunction); 
 const usBitsData = new DataSet(document.getElementById("usBits").innerText, myBitsFunction);
 const dsBitsData = new DataSet(document.getElementById("dsBits").innerText, myBitsFunction);
 const usQLNData  = new DataSet(document.getElementById("usQln").innerText, myQLNFunction);
 const dsQLNData  = new DataSet(document.getElementById("dsQln").innerText, myQLNFunction);
 const usHLOGData = new DataSet(document.getElementById("usHLog").innerText, myHLOGFunction);
 const dsHLOGData = new DataSet(document.getElementById("dsHLog").innerText, myHLOGFunction);


 function myBitsFunction(value, index, array) {
    return({x: parseInt(index), y: parseInt(value, 16), error: false});
 }

 function mySnrFunction(value, index, array) {
    let t = value.replace(/[\(\)\n]/g,'').split(',');
    let result;

    let v = t[1];
    let i = t[0];
    if (v == 255) {                                                                      // this is the only special value
       result = {x: parseInt(i) * this.groupSize, y: -40 , error: true}
    } else {
       result = {x: parseInt(i) * this.groupSize, y: parseInt(- 32 + v / 2), error: false} // rec ITU-T G.933.2, section 11.4.1.1.3, SNR(k × G × Δf) = −32 + (snr(k)/2) dB
    };
    return(result);
 }

 function myQLNFunction(value, index, array) {
    let t = value.replace(/[\(\)\n]/g,'').split(',');
    let result;

    let v = t[1];
    let i = t[0];
    if (v == 255) {                                                                 // this is the only  special value defined
       result = { x: parseInt(i) * this.groupSize, y:  - 150, error: true}
    } else {
       result = { x: parseInt(i) * this.groupSize, y:  - 23 - v / 2, error: false}  // ref ITU-T G.933.2, section 11.4.1.1.2, QLN(k × G × Δf) = −23 − (n(k)/2) dBm/Hz
    };
    return(result);
 }

 function myHLOGFunction(value, index, array) {
    let t = value.replace(/[\(\)\n]/g,'').split(',');

    let v = t[1];
    let i = t[0];
    let result;
    if (v == 1023) {                                                            // this is the only special value defined
       result = {x: parseInt(i) * this.groupSize, y: -100, error: true}
    } else {
       result = {x: parseInt(i) * this.groupSize, y: 6 - v / 10, error: false}  // ref ITU-T G.933.2,  section 11.4.1.1.1, Hlog(k × G × Δf) = 6 − (m(k)/10)
    };
    return(result);
 }


const marginX = 50;
const marginY = 80;
let darkMode = document.getElementsByTagName("body")[0].parentNode.dataset.darkmode;


bitsChart = {
   "config": {
       "canvas": document.getElementById("bitsChart"),
       "ctx" : document.getElementById("bitsChart").getContext("2d"),
       "minX" : 0,
       "maxX" : Math.max(dsBitsData.maxX, usBitsData.maxX),
       "stepX": Math.max(dsBitsData.maxX, usBitsData.maxX) / 16,
       "graphWidth" : document.getElementById("bitsChart").width - 2 * marginX,
       "lineWidth" : 1,
       "titleX" : "Sub-carrier",
       "minY" : 0,
       "maxY" : 16,
       "stepY": 2,
       "graphHeight" : document.getElementById("bitsChart").height - 2 * marginY,
       "titleY" : "bits",
   },
   "dataSet" : [
      {
         "data" :usBitsData.data,
         "color":"YellowGreen",
         "title": "Upstream bits allocation"
      },
      {
         "data" : dsBitsData.data,
         "color": "navy",
         "title": "Downstream bits allocation"
      }
   ] 
};

dBChart = {
   "config": {
       "canvas": document.getElementById("dbChart"),
       "ctx" : document.getElementById("dbChart").getContext("2d"),
       "minX" : 0,
       "maxX" : Math.max(dsSnrData.maxX, usSnrData.maxX),
       "stepX": Math.max(dsSnrData.maxX, usSnrData.maxX) / 16,
       "graphWidth" : document.getElementById("dbChart").width - 2 * marginX,
       "lineWidth": 4,
       "titleX" : "Sub-carrier",
       "minY" : -40,
       "maxY" : 100,
       "stepY": 10,
       "graphHeight" : document.getElementById("dbChart").height - 2 * marginY,
       "titleY" : "dB"
   },
   "dataSet" : [
      {
         "data" :usSnrData.data,
         "color":"Turquoise",
         "title": "Upstream SNR"
      },
      {
         "data" : dsSnrData.data,
         "color": "Coral",
         "title" : "Downstream SNR"
      }
   ]

};


qLNChart = {
   "config": {
       "canvas": document.getElementById("qlnChart"),
       "ctx" : document.getElementById("qlnChart").getContext("2d"),
       "minX" : 0,
       "maxX" : Math.max(dsQLNData.maxX, usQLNData.maxX),
       "stepX": Math.max(dsQLNData.maxX, usQLNData.maxX) / 16,
       "graphWidth" : document.getElementById("qlnChart").width - 2 * marginX,
       "lineWidth": 4,
       "titleX" : "Sub-carrier",
       "minY" : -150,
       "maxY" : -20,
       "stepY": 10,
       "graphHeight" : document.getElementById("qlnChart").height - 2 * marginY,
       "titleY" : "dBm/Hz"
   },
   "dataSet" : [
      {
         "data" :usQLNData.data,
         "color":"brown",
         "title": "Upstream QLN"
      },
      {
         "data" : dsQLNData.data,
         "color": "teal",
         "title" : "Downstream QLN"
      }
   ]

};


hLogChart = {
   "config": {
       "canvas": document.getElementById("hlogChart"),
       "ctx" : document.getElementById("hlogChart").getContext("2d"),
       "minX" : 0,
       "maxX" : Math.max(dsHLOGData.maxX, usHLOGData.maxX),
       "stepX": Math.max(dsHLOGData.maxX, usHLOGData.maxX) / 16,
       "graphWidth" : document.getElementById("hlogChart").width - 2 * marginX,
       "lineWidth": 4,
       "titleX" : "Sub-carrier",
       "minY" : -100,
       "maxY" : 14,
       "stepY": 10,
       "graphHeight" : document.getElementById("hlogChart").height - 2 * marginY,
       "titleY" : "dB"
   },
   "dataSet" : [
      {
         "data" :usHLOGData.data,
         "color":"#E8E800",
         "title": "Upstream HLOG"
      },
      {
         "data" : dsHLOGData.data,
         "color": "darkmagenta",
         "title" : "Downstream HLOG"
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

   borders.map(drawBlock,{config, dataPoints, color, borders});
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
   ctx.fillRect(                  0.5 * graphWidth + marginX - ctx.measureText(dataSet[0].title).width - 50, config.canvas.height - marginY*1/4 - 8, 30, 10);
   ctx.strokeStyle = "#C0C0C0";
   ctx.strokeRect(                  0.5 * graphWidth + marginX - ctx.measureText(dataSet[0].title).width - 50, config.canvas.height - marginY*1/4 - 8, 30, 10);

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
   ctx.fillRect(      0.5 * graphWidth + marginX,                  config.canvas.height - marginY*1/4 - 8, 30, 10);
   ctx.strokeStyle = "#C0C0C0";
   ctx.strokeRect(      0.5 * graphWidth + marginX,                  config.canvas.height - marginY*1/4 - 8, 30, 10);

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

   };

   ctx.font = "12px Arial";
   ctx.textAlign = "center";
   ctx.translate(marginX/3, marginY + graphHeight / 2);
   ctx.rotate(-3.14 /2);
   ctx.fillText(title, 0, 0);
   ctx.rotate(3.14 /2)
   ctx.translate(-marginX/3,-(marginY + graphHeight / 2));
}


//console.time();
drawChart(dBChart);
drawChart(bitsChart);
drawChart(qLNChart);
drawChart(hLogChart);
//console.timeEnd();
