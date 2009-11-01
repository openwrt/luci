#!/usr/bin/perl

use strict;
use warnings;
use Text::Balanced qw(extract_bracketed extract_delimited extract_tagged);

@ARGV >= 1 || die "Usage: $0 <source direcory>\n";


my %stringtable;

sub dec_lua_str
{
	my $s = shift;
	$s =~ s/\\n/\n/g;
	$s =~ s/\\t/\n/g;
	$s =~ s/\\(.)/$1/g;
	$s =~ s/[\s\n]+/ /g;
	$s =~ s/^ //;
	$s =~ s/ $//;
	return $s;
}

sub dec_tpl_str
{
	my $s = shift;
	$s =~ s/[\s\n]+/ /g;
	$s =~ s/^ //;
	$s =~ s/ $//;
	return $s;
}


if( open F, "find @ARGV -type f '(' -name '*.htm' -or -name '*.lua' ')' |" )
{
	while( defined( my $file = readline F ) )
	{
		chomp $file;

		if( open S, "< $file" )
		{
			local $/ = undef;
			my $raw = <S>;
			close S;


			my $text = $raw;

			while( $text =~ s/ ^ .*? (?:translate|translatef|i18n|_) [\n\s]* \( /(/sgx )
			{
				( my $code, $text ) = extract_bracketed($text, q{('")});
				$code =~ s/^\(//; $code =~ s/\)$//;

				my $res = "";
				my $sub = "";

				while( defined $sub )
				{
					( $sub, $code ) = extract_delimited($code, q{'"}, q{\s*(?:\.\.\s*)?});

					if( defined $sub )
					{
						$res .= substr $sub, 1, length($sub) - 2;
					}
				}

				$res = dec_lua_str($res);
				$stringtable{$res}++;
			}


			$text = $raw;

			while( $text =~ s/ ^ .*? <% [:_] -? /<%/sgx )
			{
				( my $code, $text ) = extract_tagged($text, '<%', '%>');

				if( defined $code )
				{
					$code = dec_tpl_str(substr $code, 2, length($code) - 4);
					$stringtable{$code}++;
				}
			}
		}
	}

	close F;
}


if( open C, "| msgcat -" )
{
	printf C "msgid \"\"\nmsgstr \"Content-Type: text/plain; charset=UTF-8\"\n\n";

	foreach my $key ( sort keys %stringtable )
	{
		if( length $key )
		{
			$key =~ s/"/\\"/g;
			printf C "msgid \"%s\"\nmsgstr \"\"\n\n", $key;
		}
	}

	close C;
}
