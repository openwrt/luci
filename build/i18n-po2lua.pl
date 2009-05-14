#!/usr/bin/perl

@ARGV == 2 || die "Usage: $0 <source-dir> <dest-dir>\n";

my $source_dir  = shift @ARGV;
my $target_dir  = shift @ARGV;

if( ! -d $target_dir )
{
	system('mkdir', '-p', $target_dir);
}


my %target_strings;


if( open F, "find $source_dir -type f -name '*.po' |" )
{
	while( chomp( my $file = readline F ) )
	{
		if( open L, "< $file" )
		{
			my ( $basename ) = $file =~ m{.+/([^/]+\.[\w\-]+)\.po$};

			if( open D, "> $target_dir/$basename.lua" )
			{
				printf "Generating %-40s ", "$target_dir/$basename.lua";

				my ( $k, $v );

				while( chomp( my $line = readline L ) )
				{
					if( $line =~ /^msgid "(.+)"/ )
					{
						$k = $1;
					}
					elsif( $k && $line =~ /^msgstr "(.*)"/ )
					{
						$v = $1;
					}
					elsif( $k && defined($v) && $line =~ /^"(.+)"/ )
					{
						$v .= $1;
					}
					else
					{
						if( $k && defined($v) )
						{
							$v =~ s/\\(['"\\])/$1/g;
							$v =~ s/(['\\])/\\$1/g;

							printf D "%s%s='%s'\n", $v ? '' : '--', $k, $v;
						}
		
						$k = $v = undef;
					}
				}

				print "done\n";

				close D;
			}

			close L;
		}
	}

	close F;
}
