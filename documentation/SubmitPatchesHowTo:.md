# Checkout svn
	
	svn co http://svn.luci.subsignal.org/luci/trunk
	
and change to that directory:
	
	cd trunk
	
# Make your changes

Edit the files you want to change. If you add some new files you need to add them to the svn tree:
	
	svn add <dir/files>
	
Where <dir/files> are the directories/files you have added. Its possible to specify multiple files/directories here.

# Use svn diff to generate a patch with your changes

To check if your changes look ok first do:
	
	svn diff <dir/files>
	
and check the output. Again you can specify multiple dirs/directories here.

If everything looks like expected save the patch:
	
	svn diff <dir/files> > ./mypatch.patch
	

# Submit patches

Use the [Ticket system](http://luci.subsignal.org/trac/newticket) to submit your patch.

