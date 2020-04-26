;(function($){

var design = function(options) {

	var _ = this;
 	var settings = $.extend({
 	 	  defaultPage: 'dashboard'
        }, options);


 	if (settings.navigation) {
 		$(settings.navigation).find('a').bind('click',function(event){
 			
			event.preventDefault();

			var loadPage = $(this).data('page');

			if (loadPage) {
				_.switchPage.apply(null, [loadPage]);
			}

 		});
 	}

	this.switchPage = function(loadPage) {

		var loadPage = !loadPage ? settings.defaultPage : loadPage ;

		$('#' + loadPage).removeClass('d-none').siblings().addClass('d-none');
	};

 }


 $(document).ready(function(){

 	var interface = new design({
 		navigation: '#navigation'
 	});


		interface.switchPage();

  });

})(jQuery);