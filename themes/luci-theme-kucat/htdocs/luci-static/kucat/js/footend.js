
	// thanks for sirpdboy Wich <herboy2008@gmail.com>  footer差补代码
    var winHeight = window.innerHeight;
    
    function debounce(func, delay) {
        let timeoutId;
        return function() {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(func, delay);
        };
    }

    function adjustLayout() {
        var currentHeight = window.innerHeight;
        var winWidth = window.innerWidth;
        
        var footer = document.querySelector('footer');
        var footerHeight = footer ? footer.offsetHeight : 0;
        
        var footerRect = footer ? footer.getBoundingClientRect() : null;
        var footerBottomPos = footerRect ? footerRect.bottom : 0;
        var spaceBelowFooter = currentHeight - footerBottomPos;
        
        if (winWidth < 768) {
            var keyboardHeight = currentHeight - winHeight;
            document.querySelectorAll('.footend').forEach(function(element) {
                element.style.bottom = (keyboardHeight + 80) + 'px';
            });
        }
        
        document.querySelectorAll('.footend').forEach(function(element) {
            if (spaceBelowFooter < 0) {
                element.style.paddingBottom = '100px';
            } else {
                element.style.paddingBottom = '';
            }
        });
    }

    adjustLayout();
    window.addEventListener('resize', debounce(adjustLayout, 200));

