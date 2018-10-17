#!/usr/bin/perl

use strict;
use warnings;
use Text::Balanced qw(extract_bracketed extract_delimited extract_tagged);
use POSIX;

POSIX::setlocale(POSIX::LC_ALL, "C");

@ARGV >= 1 || die "Usage: $0 <source directory>\n";


my %stringtable;

sub dec_lua_str
{
	my $s = shift;
	$s =~ s/[\s\n]+/ /g;
	$s =~ s/\\n/\n/g;
	$s =~ s/\\t/\t/g;
	$s =~ s/\\(.)/$1/g;
	$s =~ s/^ //;
	$s =~ s/ $//;
	return $s;
}

sub dec_tpl_str
{
	my $s = shift;
	$s =~ s/-$//;
	$s =~ s/[\s\n]+/ /g;
	$s =~ s/^ //;
	$s =~ s/ $//;
	$s =~ s/\\/\\\\/g;
	return $s;
}


if( open F, "find @ARGV -type f '(' -name '*.htm' -o -name '*.lua' -o -name '*.js' ')' | sort |" )
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
			my $line = 1;

			while( $text =~ s/ ^ (.*?) (?:translate|translatef|i18n|_) ([\n\s]*) \( /(/sgx )
			{
				my ($prefix, $suffix) = ($1, $2);

				( my $code, $text ) = extract_bracketed($text, q{('")});

				$line += () = $prefix =~ /\n/g;

				my $position = "$file:$line";

				$line += () = $suffix =~ /\n/g;
				$line += () = $code   =~ /\n/g;

				$code =~ s/\\\n/ /g;
				$code =~ s/^\([\n\s]*//;
				$code =~ s/[\n\s]*\)$//;

				my $res = "";
				my $sub = "";

				if( $code =~ /^['"]/ )
				{
					while( defined $sub )
					{
						( $sub, $code ) = extract_delimited($code, q{'"}, q{\s*(?:\.\.\s*)?});

						if( defined $sub && length($sub) > 2 )
						{
							$res .= substr $sub, 1, length($sub) - 2;
						}
						else
						{
							undef $sub;
						}
					}
				}
				elsif( $code =~ /^(\[=*\[)/ )
				{
					my $stag = quotemeta $1;
					my $etag = $stag;
					   $etag =~ s/\[/]/g;

					( $res ) = extract_tagged($code, $stag, $etag);

					$res =~ s/^$stag//;
					$res =~ s/$etag$//;
				}

				$res = dec_lua_str($res);

				if ($res) {
					$stringtable{$res} ||= [ ];
					push @{$stringtable{$res}}, $position;
				}
			}


			$text = $raw;
			$line = 1;

			while( $text =~ s/ ^ (.*?) <% -? [:_] /<%/sgx )
			{
				$line += () = $1 =~ /\n/g;

				( my $code, $text ) = extract_tagged($text, '<%', '%>');

				if( defined $code )
				{
					my $position = "$file:$line";

					$line += () = $code =~ /\n/g;

					$code = dec_tpl_str(substr $code, 2, length($code) - 4);

					$stringtable{$code} ||= [];
					push @{$stringtable{$code}}, $position;
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
			my @positions = @{$stringtable{$key}};

			$key =~ s/\\/\\\\/g;
			$key =~ s/\n/\\n/g;
			$key =~ s/\t/\\t/g;
			$key =~ s/"/\\"/g;

			printf C "#: %s\nmsgid \"%s\"\nmsgstr \"\"\n\n",
				join(' ', @positions), $key;
		}
	}

	close C;
}
