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
			my $content = 0;
			my ( $lang, $basename ) = $file =~ m{.+/(\w+)/([^/]+)\.po$};
			$lang = lc $lang;
			$lang =~ s/_/-/g;
			
			if( open D, "> $target_dir/$basename.$lang.lua" )
			{
				printf "Generating %-40s ", "$target_dir/$basename.$lang.lua";

				my ( $k, $v );

				while( chomp( my $line = readline L ) || ( defined($k) && defined($v) ) )
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
						if( $k && defined($v) && length($v) > 0 )
						{
							$v =~ s/\\(['"\\])/$1/g;
							$v =~ s/(['\\])/\\$1/g;

							printf D "%s='%s'\n", $k, $v;
							$content++;
						}
		
						$k = $v = undef;
					}
				}

				print $content ? "done ($content strings)\n" : "empty\n";

				close D;


				unlink("$target_dir/$basename.$lang.lua")
					unless( $content > 0 );
			}

			close L;
		}
	}

	close F;
}
