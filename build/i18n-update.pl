#!/usr/bin/perl

@ARGV >= 1 || die "Usage: $0 <po directory> [<file pattern>]\n";

my $source  = shift @ARGV;
my $pattern = shift @ARGV || '*.po';

sub fixup_header_order
{
	my $file = shift || return;
	local $/;

	open P, "< $file" || die "open(): $!";
	my $data = readline P;
	close P;

	$data =~ s/("Language-Team: .*?\\n"\n)(.+?)("Language: .*?\\n"\n)/$1$3$2/s;

	open P, "> $file" || die "open(): $!";
	print P $data;
	close P;
}

if( open F, "find $source -type f -name '$pattern' |" )
{
	while( chomp( my $file = readline F ) )
	{
		my ( $basename ) = $file =~ m{.+/([^/]+)\.po$};
		
		if( -f "$source/templates/$basename.pot" )
		{
			printf "Updating %-40s", $file;
			system("msgmerge", "-U", "-N", $file, "$source/templates/$basename.pot");
			fixup_header_order($file);
		}
	}

	close F;
}
