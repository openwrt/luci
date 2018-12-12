/**
 *  Purple is a pure HTML5 theme for LuCI.
 *
 *  luci-theme-purple
 *     Copyright 2018 Rosy Song <rosysong@rosinson.com>
 *     Copyright 2018 Yan Lan Shen <yanlan.shen@rosinson.com>
 *
 *  Have a bug? Please create an issue here on GitHub!
 *      https://github.com/rosywrt/luci-theme-purple/issues
 *
 *  Licensed to the public under the Apache License 2.0
 */

(function(win, dom, $){
 
    $('.logged-in .loading').fadeOut('slow');

    // Detect the height required for the login interface
    $('.login').height($(win).height());
    $('.logged-in .main-right .container').css('min-height', $(win).height());
    $(win).resize(function(){
        $('.login').height($(win).height());
        $('.logged-in .main-right .container').css('min-height', $(win).height());
    });

    // Whether the menu displays click events
    $('header .label.open-menu').click(function(){
        var className = $(this).attr('class');

        if(className.indexOf('open-menu') != (-1)){
            $(this).removeClass('open-menu').addClass('close-menu');
            $('.main-left').fadeIn('fast');
            $('.showSide .label-hide').text('close menu');
        }else {
            $(this).removeClass('close-menu').addClass('open-menu');
            $('.main-left').fadeOut('fast');
            $('.showSide .label-hide').text('open menu');
        }
    });

    // When the page is just logged in
    $('.logged-in .main-left .top-menu li:first-child a').addClass('active');
    $('.logged-in .main-left .all-menu .slide:first-child .slide-menu li:first-child').addClass('active');

    // Add the active class name to the menu
    var currentURL = win.location.pathname;
    var dataTitle = '';
    $('.logged-in .main-left .all-menu .slide-menu li a').each(function(){
        var allURL = $(this).attr('href');
        if(currentURL.indexOf(allURL) != (-1)){
            $('.logged-in .main-left .all-menu .slide-menu li a').parent('li').removeClass('active');
            dataTitle = $(this).parent('li').addClass('active').parent().prev().attr('data-title');
        }
    });
    $('.logged-in .main-left .top-menu li a').each(function(){
        if($(this).attr('data-title') == dataTitle) {
            $('.logged-in .main-left .top-menu li a').removeClass('active');
            $(this).addClass('active');
        }
    });
    $('.btn').prev('input').css({
        'border-radius': '4px 0 0 4px'
    });

    // Add a new class name to body
    $('body.logged-in').addClass(luciLocation[1]);

    $('.cbi-dropdown ul li input').click(function(){
        $(this).attr('checked', 'true');
    });

    $('.logged-in .main-left .all-menu .slide-menu li a').click(function(){
        $(".logged-in .loading").fadeIn("fast");
    });

})(window, document, jQuery);
