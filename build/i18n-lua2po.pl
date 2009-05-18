#!/usr/bin/perl

@ARGV >= 2 || die "Usage: $0 <source-dir> <dest-dir> [<target-language>]\n";

my $source_dir  = shift @ARGV;
my $target_dir  = shift @ARGV;
my $target_lang = shift @ARGV;
my $master_lang = "en";


if( ! -d "$target_dir/" . ( $target_lang || 'templates' ) )
{
	system('mkdir', '-p', "$target_dir/" . ( $target_lang || 'templates' ));
}


my %target_strings;

if( $target_lang && open F, "find $source_dir -path '*/luasrc/i18n/*' -name '*.$target_lang.lua' |" )
{
	while( chomp( my $file = readline F ) )
	{
		if( open L, "< $file" )
		{
			my ( $basename ) = $file =~ m{.+/([^/]+)\.[\w\-]+\.lua$};
			$target_strings{$basename} = { };

			while( chomp( my $entry = readline L ) )
			{
				my ( $k, $v );
				if( $entry =~ /^\s*(\w+)\s*=\s*\[\[(.+)\]\]/ )
				{
					( $k, $v ) = ( $1, $2 );
				}
				elsif( $entry =~ /^\s*(\w+)\s*=\s*'(.+)'/ )
				{
					( $k, $v ) = ( $1, $2 );
				}
				elsif( $entry =~ /^\s*(\w+)\s*=\s*"(.+)"/ )
				{
					( $k, $v ) = ( $1, $2 );
				}
				
				if( $k && $v )
				{
					$v =~ s/"/\\"/g;
					$v =~ s/\\\\"/\\"/g;
					$target_strings{$basename}{$k} = $v;
				}
			}

			close L;
		}
	}

	close F;
}


if( open F, "find . -path '*/luasrc/i18n/*' -name '*.$master_lang.lua' |" )
{
	my $destfile = sprintf '%s/%s/%%s.%s',
		$target_dir,
		$target_lang || 'templates',
		$target_lang ? 'po' : 'pot'
	;

	while( chomp( my $file = readline F ) )
	{
		if( open L, "< $file" )
		{
			my ( $basename ) = $file =~ m{.+/([^/]+)\.\w+\.lua$};
			my $filename = sprintf $destfile, $basename;

			if( open T, "> $filename" )
			{
				printf "Generating %-40s ", $filename;

				printf T "#  %s.%s\n#  generated from %s\n\nmsgid \"\"\n" .
				         "msgstr \"Content-Type: text/plain; charset=UTF-8\"\n\n",
					$basename, $target_lang ? 'po' : 'pot', $file;
		
				while( chomp( my $entry = readline L ) )
				{
					my ( $k, $v );
					if( $entry =~ /^\s*(\w+)\s*=\s*\[\[(.+)\]\]/ )
					{
						( $k, $v ) = ( $1, $2 );
					}
					elsif( $entry =~ /^\s*(\w+)\s*=\s*'(.+)'/ )
					{
						( $k, $v ) = ( $1, $2 );
					}
					elsif( $entry =~ /^\s*(\w+)\s*=\s*"(.+)"/ )
					{
						( $k, $v ) = ( $1, $2 );
					}
				
					if( $k && $v )
					{
						$v =~ s/"/\\"/g;
						$v =~ s/\\\\"/\\"/g;
						printf T "#: %s:%d\n#. %s\nmsgid \"%s\"\nmsgstr \"%s\"\n\n",
							$file, $., $v, $k,
							( $target_strings{$basename} && $target_strings{$basename}{$k} )
								? $target_strings{$basename}{$k} : $v;
					}
				}
				
				close T;
				
				print "done\n";
			}

			close L;
		}
	}

	close F;
}
