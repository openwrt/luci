#!/usr/bin/perl

use strict;
use warnings;
use Text::Balanced qw(extract_tagged gen_delimited_pat);
use POSIX;

POSIX::setlocale(POSIX::LC_ALL, "C");

@ARGV >= 1 || die "Usage: $0 <source directory>\n";


my %stringtable;

sub dec_lua_str
{
	my $s = shift;
	$s =~ s/\\n/\n/g;
	$s =~ s/\\t/\t/g;
	$s =~ s/\\(.)/$1/sg;
	$s =~ s/[\s\n]+/ /g;
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

			while ($text =~ s/ ^ (.*?) (?:translate|translatef|i18n|_) ([\n\s]*) \( //sgx)
			{
				my ($prefix, $suffix) = ($1, $2);
				my $code;
				my $res = "";
				my $sub = "";

				$line += () = $prefix =~ /\n/g;

				my $position = "$file:$line";

				$line += () = $suffix =~ /\n/g;

				while (defined $sub)
				{
					undef $sub;

					if ($text =~ /^ ([\n\s]*(?:\.\.[\n\s]*)?) (\[=*\[) /sx)
					{
						my $ws = $1;
						my $stag = quotemeta $2;
						(my $etag = $stag) =~ y/[/]/;

						($sub, $text) = extract_tagged($text, $stag, $etag, q{\s*(?:\.\.\s*)?});

						$line += () = $ws =~ /\n/g;

						if (defined($sub) && length($sub)) {
							$line += () = $sub =~ /\n/g;

							$sub =~ s/^$stag//;
							$sub =~ s/$etag$//;
							$res .= $sub;
						}
					}
					elsif ($text =~ /^ ([\n\s]*(?:\.\.[\n\s]*)?) (['"]) /sx)
					{
						my $ws = $1;
						my $quote = $2;
						my $re = gen_delimited_pat($quote, '\\');

						if ($text =~ m/\G\s*(?:\.\.\s*)?($re)/gcs)
						{
							$sub = $1;
							$text = substr $text, pos $text;
						}

						$line += () = $ws =~ /\n/g;

						if (defined($sub) && length($sub)) {
							$line += () = $sub =~ /\n/g;

							$sub =~ s/^$quote//;
							$sub =~ s/$quote$//;
							$res .= $sub;
						}
					}
				}

				if (defined($res))
				{
					$res = dec_lua_str($res);

					if ($res) {
						$stringtable{$res} ||= [ ];
						push @{$stringtable{$res}}, $position;
					}
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
			my @positions =
				map { join ':', @$_ }
				sort { ($a->[0] cmp $b->[0]) || ($a->[1] <=> $b->[1]) }
				map { [ /^(.+):(\d+)$/ ] }
				@{$stringtable{$key}};

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
