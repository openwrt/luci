#!/usr/bin/perl

@ARGV >= 1 || die "Usage: $0 <po directory> [<file pattern>]\n";

my $source  = shift @ARGV;
my $pattern = shift @ARGV || '*.po';

if( open F, "find $source -type f -name '$pattern' |" )
{
	while( chomp( my $file = readline F ) )
	{
		my ( $basename ) = $file =~ m{.+/([^/]+)\.po$};
		
		if( -f "$source/templates/$basename.pot" )
		{
			printf "Updating %-40s", $file;
			system("msgmerge", "-U", "-N", $file, "$source/templates/$basename.pot");
		}
	}

	close F;
}
