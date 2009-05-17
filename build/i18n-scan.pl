#!/usr/bin/perl

use strict;
use warnings;
use Text::Balanced qw(extract_codeblock);

@ARGV == 1 || die "Usage: $0 <source direcory>\n";


sub _parse
{
	my ( $code ) = @_;
	my ( $k, $v );
	
	if( $code =~ s/^<%:-?\s*(.+)\s*%>/$1/s )
	{
		my ( $key, @text ) = split /[\n\s]+/, $code;

		$k = $key;
		$v = join ' ', @text;
	}
	elsif( $code =~ s/^\(\s*(.+)\s*\)/$1/s )
	{
		if( $code =~ /^(?:"(\w+)"|'(\w+)')\s*,\s*(?:"(.+?)"|'(.+?)')/s )
		{
			$k = $1 || $2;
			$v = $3 || $4 || '';
			$v =~ s/\s+/ /sg;
		}
		elsif( $code =~ /^(?:"(\w+)"|'(\w+)')/ )
		{
			$k = $1 || $2;
			$v = '';
		}
		else
		{
			return ();
		}
	}
	else
	{
		return ();
	}

	$v =~ s/\\"/"/g;
	$v =~ s/"/\\"/g;
	
	return ( $k, $v );
}


if( open F, "find $ARGV[0] -type f -name '*.htm' -or -name '*.lua' |" )
{
	while( defined( my $file = readline F ) )
	{
		chomp $file;

		if( open S, "< $file" )
		{
			my $text = '';
			$text .= $_ foreach( readline S );

			while(
				$text =~ s/
					^ .*?
					(?:
						(?: translate f? | i18n )
						[\s\n]* ( \( )
					|
						( \<%: -? )
					)
				/$1 || $2/segx
			) {
				my $code;

				( $code, $text ) = extract_codeblock( $text, '', '^', '()' );
				if( ! $code ) {
					( $code, $text ) = extract_codeblock( $text, '', '^', '<>' );
				}

				if( ! $code ) {
					# Corner case:
					$text =~ s/(#[^\n]*)%>/$1\n%>/;
					( $code, $text ) = extract_codeblock( $text, '<>', '^' );
					if( ! $code ) {
						last;
					}
				}

				my ( $k, $v ) = _parse( $code );
				if( $k && defined($v) )
				{
					if( $v )
					{
						printf "#. %s\n", $v || $k;
					}

					printf "msgid \"%s\"\nmsgstr \"%s\"\n\n",
						$k, $v;
				}
			}

			close S;
		}
	}

	close F;
}
