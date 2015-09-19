/**
 *  Material is a clean HTML5 theme for LuCI. It is based on luci-theme-bootstrap and MUI
 *
 *  luci-theme-material
 *      Copyright 2015 Lutty Yang <lutty@wcan.in>
 *
 *  Have a bug? Please create an issue here on GitHub!
 *      https://github.com/LuttyYang/luci-theme-material/issues
 *
 *  luci-theme-bootstrap:
 *      Copyright 2008 Steven Barth <steven@midlink.org>
 *      Copyright 2008 Jo-Philipp Wich <jow@openwrt.org>
 *      Copyright 2012 David Menting <david@nut-bolt.nl>
 *
 *  MUI:
 *      https://github.com/muicss/mui
 *
 *  Licensed to the public under the Apache License 2.0
 */
(function ($) {
    var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",
        a256 = '',
        r64 = [256],
        r256 = [256],
        i = 0;
    var UTF8 = {
        /**
         * Encode multi-byte Unicode string into utf-8 multiple single-byte characters
         * (BMP / basic multilingual plane only)
         *
         * Chars in range U+0080 - U+07FF are encoded in 2 chars, U+0800 - U+FFFF in 3 chars
         *
         * @param {String} strUni Unicode string to be encoded as UTF-8
         * @returns {String} encoded string
         */
        encode: function (strUni) {
            // use regular expressions & String.replace callback function for better efficiency
            // than procedural approaches
            var strUtf = strUni.replace(/[\u0080-\u07ff]/g, // U+0080 - U+07FF => 2 bytes 110yyyyy, 10zzzzzz
                function (c) {
                    var cc = c.charCodeAt(0);
                    return String.fromCharCode(0xc0 | cc >> 6, 0x80 | cc & 0x3f);
                })
                .replace(/[\u0800-\uffff]/g, // U+0800 - U+FFFF => 3 bytes 1110xxxx, 10yyyyyy, 10zzzzzz
                function (c) {
                    var cc = c.charCodeAt(0);
                    return String.fromCharCode(0xe0 | cc >> 12, 0x80 | cc >> 6 & 0x3F, 0x80 | cc & 0x3f);
                });
            return strUtf;
        },
        /**
         * Decode utf-8 encoded string back into multi-byte Unicode characters
         *
         * @param {String} strUtf UTF-8 string to be decoded back to Unicode
         * @returns {String} decoded string
         */
        decode: function (strUtf) {
            // note: decode 3-byte chars first as decoded 2-byte strings could appear to be 3-byte char!
            var strUni = strUtf.replace(/[\u00e0-\u00ef][\u0080-\u00bf][\u0080-\u00bf]/g, // 3-byte chars
                function (c) { // (note parentheses for precence)
                    var cc = ((c.charCodeAt(0) & 0x0f) << 12) | ((c.charCodeAt(1) & 0x3f) << 6) | (c.charCodeAt(2) & 0x3f);
                    return String.fromCharCode(cc);
                })
                .replace(/[\u00c0-\u00df][\u0080-\u00bf]/g, // 2-byte chars
                function (c) { // (note parentheses for precence)
                    var cc = (c.charCodeAt(0) & 0x1f) << 6 | c.charCodeAt(1) & 0x3f;
                    return String.fromCharCode(cc);
                });
            return strUni;
        }
    };
    while (i < 256) {
        var c = String.fromCharCode(i);
        a256 += c;
        r256[i] = i;
        r64[i] = b64.indexOf(c);
        ++i;
    }
    function code(s, discard, alpha, beta, w1, w2) {
        s = String(s);
        var buffer = 0,
            i = 0,
            length = s.length,
            result = '',
            bitsInBuffer = 0;
        while (i < length) {
            var c = s.charCodeAt(i);
            c = c < 256 ? alpha[c] : -1;
            buffer = (buffer << w1) + c;
            bitsInBuffer += w1;
            while (bitsInBuffer >= w2) {
                bitsInBuffer -= w2;
                var tmp = buffer >> bitsInBuffer;
                result += beta.charAt(tmp);
                buffer ^= tmp << bitsInBuffer;
            }
            ++i;
        }
        if (!discard && bitsInBuffer > 0) result += beta.charAt(buffer << (w2 - bitsInBuffer));
        return result;
    }

    var Plugin = $.base64 = function (dir, input, encode) {
        return input ? Plugin[dir](input, encode) : dir ? null : this;
    };
    Plugin.btoa = Plugin.encode = function (plain, utf8encode) {
        plain = Plugin.raw === false || Plugin.utf8encode || utf8encode ? UTF8.encode(plain) : plain;
        plain = code(plain, false, r256, b64, 8, 6);
        return plain + '===='.slice((plain.length % 4) || 4);
    };
    Plugin.atob = Plugin.decode = function (coded, utf8decode) {
        coded = String(coded).split('=');
        var i = coded.length;
        do {
            --i;
            coded[i] = code(coded[i], true, r64, a256, 6, 8);
        } while (i > 0);
        coded = coded.join('');
        return Plugin.raw === false || Plugin.utf8decode || utf8decode ? UTF8.decode(coded) : coded;
    };
}(jQuery));

(function ($) {
    $(".main > .loading").fadeOut();

    /**
     * trim text, Remove spaces, wrap
     * @param text
     * @returns {string}
     */
    function trimText(text) {
        return text.replace(/[ \t\n\r]+/g, " ");
    }


    var tree = undefined;
    var lastNode = undefined;
    var mainNodeName = undefined;

    /**
     * get the current node by Burl (primary)
     * @returns {boolean} success?
     */
    function getCurrentNodeByUrl() {
        var ret = false;
        var getUrlNode = function (href){
            var linkPos = href.indexOf(";");
            if (linkPos == -1){
                return "login";
            }else{
                linkPos = href.indexOf("/", linkPos);
                if (linkPos == -1){
                    return "overview";
                }else{
                    var link = href.substr(linkPos);
                    if (link == "/")
                        return "overview";
                    else
                        return link;
                }
            }
        };

        var currentNode = getUrlNode(window.location.pathname);

        if (currentNode == "login"){
            tree = ["Main", "Login"];
            return false;
        }else if(currentNode == "overview"){
            tree = ["Status", "Overview"];
            lastNode = $($($(".main > .main-left > .nav > .slide > .menu")[0]).next().find("a")[0]).parent();
            return false;
        }

        $(".main > .main-left > .nav > .slide > .menu").each(function () {
            var ulNode = $(this);
            ulNode.next().find("a").each(function () {
                var that = $(this);
                var href = that.attr("href");

                if (currentNode.indexOf(getUrlNode(href)) != -1){
                    ulNode.click();
                    lastNode = that.parent();
                    tree = [trimText(ulNode.data("title")), trimText(that.data("title"))];
                    lastNode.addClass("active");
                    ret = true;
                    return true;
                }
            });
        });
        return ret;
    }

    /**
     * menu click
     */
    $(".main > .main-left > .nav > .slide > .menu").click(function () {
        var ul = $(this).next(".slide-menu");
        var menu = $(this);
        if (!ul.is(":visible")) {
            menu.addClass("active");
            ul.addClass("active");
            ul.stop(true).slideDown();
        } else {
            ul.slideUp(function () {
                menu.removeClass("active");
                ul.removeClass("active");
            });
        }
    });

    /**
     * hook menu click and add the hash
     */
    $(".main > .main-left > .nav > .slide > .slide-menu > li > a").click(function () {
        if (lastNode != undefined) lastNode.removeClass("active");
        $(this).parent().addClass("active");
        $(".main > .loading").fadeIn();
        return true;
    });

    /**
     * fix menu click
     */
    $(".main > .main-left > .nav > .slide > .slide-menu > li").click(function () {
        if (lastNode != undefined) lastNode.removeClass("active");
        $(this).addClass("active");
        $(".main > .loading").fadeIn();
        window.location = $($(this).find("a")[0]).attr("href");
        return;
    });

    /**
     * get current node and open it
     */
    if (!getCurrentNodeByUrl()){
        if (tree != undefined && tree[0] == "Status" && tree[1] == "Overview"){
            //overview
            lastNode.addClass("active");
            $($(".main > .main-left > .nav > .slide > .menu")[0]).click();
        }
    }
    if (tree != undefined){
        mainNodeName = "node-"+ tree[0] + "-" + tree[1];
        mainNodeName = mainNodeName.replace(/[ \t\n\r\/]+/g,"_").toLowerCase();
        $("body").addClass(mainNodeName);

    }
    $(".cbi-button-up").val("");
    $(".cbi-button-down").val("");


    /**
     * hook other "A Label" and add hash to it.
     */
    $("#maincontent > .container").find("a").each(function () {
        var that = $(this);
        var onclick = that.attr("onclick");
        if (onclick == undefined || onclick == ""){
            that.click(function () {
                var href = that.attr("href");
                if (href.indexOf("#") == -1){
                    $(".main > .loading").fadeIn();
                    return true;
                }
            });
        }
    });

    /**
     * Sidebar expand
     */
    var showSide = false;
    $(".showSide").click(function () {
        if (showSide){
            $(".darkMask").stop(true).fadeOut();
            $(".main-left").stop(true).animate({
                width: "0"
            });
            showSide = false;
        }else{
            $(".darkMask").stop(true).fadeIn();
            $(".main-left").stop(true).animate({
                width: "15rem"
            });
            showSide = true;
        }
    });


    $(".darkMask").click(function () {
        if (showSide){
            showSide = false;
            $(".darkMask").stop(true).fadeOut();
            $(".main-left").stop(true).animate({
                width: "0"
            });
        }
    });

    $(window).resize(function() {
        if ($(window).width() > 921) {
            $(".main-left").css("width", "");
            $(".darkMask").stop(true);
            $(".darkMask").css("display", "none");
            showSide = false;
        }
    });

    /**
     * fix legend position
     */
    $("legend").each(function () {
        var that = $(this);
        that.after("<span class='panel-title'>" + that.text() + "</span>");
    });


    $(".main-right").focus();
    $(".main-right").blur();

    if (mainNodeName != undefined){
        console.log(mainNodeName);
        switch (mainNodeName){
            case "node-status-system_log":
            case "node-status-kernel_log":
                $("#syslog").focus(function () {
                    $("#syslog").blur();
                    $(".main-right").focus();
                    $(".main-right").blur();
                });
                break;
        }
    }
})(jQuery);
