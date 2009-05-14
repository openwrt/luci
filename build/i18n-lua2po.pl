#!/usr/bin/perl

@ARGV == 3 || die "Usage: $0 <source-dir> <dest-dir> <target-language>\n";

my $source_dir  = shift @ARGV;
my $target_dir  = shift @ARGV;
my $target_lang = shift @ARGV;
my $master_lang = "en";


if( ! -d $target_dir )
{
	system('mkdir', '-p', $target_dir);
}


my %target_strings;


if( open F, "find $source_dir -path '*/luasrc/i18n/*' -name '*.$target_lang.lua' |" )
{
	while( chomp( my $file = readline F ) )
	{
		if( open L, "< $file" )
		{
			my ( $basename ) = $file =~ m{.+/([^/]+)\.\w+\.lua$};
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
	while( chomp( my $file = readline F ) )
	{
		if( open L, "< $file" )
		{
			my ( $basename ) = $file =~ m{.+/([^/]+)\.\w+\.lua$};

			if( open T, "> $target_dir/$basename.$target_lang.po" )
			{
				printf "Generating %-40s ",
					"$target_dir/$basename.$target_lang.po";
		
				printf T "#  %s.%s.po\n#  generated from %s\n\nmsgid \"\"\n" .
				         "msgstr \"Content-Type: text/plain; charset=UTF-8\"\n\n",
					$basename, $target_lang, $file;
		
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
						printf T "#: %s:%d\n#. \"%s\"\nmsgid \"%s\"\nmsgstr \"%s\"\n\n",
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
