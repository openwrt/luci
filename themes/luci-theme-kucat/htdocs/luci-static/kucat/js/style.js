(function ($) {

    // 修复某些插件导致在https下env(safe-area-inset-bottom)为0的情况
    var url = self.location.href; 
    if ((/(iPhone|iPad|iPod|iOS|Mac|Macintosh)/i.test(navigator.userAgent)) && url.indexOf("openclash") != -1 ) {
        var oMeta = document.createElement('meta');
        oMeta.content = 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=0,viewport-fit=cover';
        oMeta.name = 'viewport';
        document.getElementsByTagName('head')[0].appendChild(oMeta);
    }


})(jQuery);

function pdopenbar() {
    document.getElementById("header-bar-left").style.width = "300px";
    document.getElementById("header-bar-left").style.display = "block";
    document.getElementById("header-bar-right").style.width = "0";
    document.getElementById("header-bar-right").style.display = "none"
}

function pdclosebar() {
    document.getElementById("header-bar-left").style.display = "none";
    document.getElementById("header-bar-left").style.width = "0";
    document.getElementById("header-bar-right").style.display = "block";
    document.getElementById("header-bar-right").style.width = "50px"
}
