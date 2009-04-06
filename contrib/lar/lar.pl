#!/usr/bin/perl

use strict;

@ARGV || die "Usage: $0 <file1> <file2> ... <fileN>\n";

my @index;
my $offset = 0;

foreach my $file ( @ARGV )
{
	if( -f $file && open F, "< $file" )
	{
		warn sprintf "Member at 0x%08X\n", $offset;
		push @index, [ ];

		my $size = length $file;

		print $file;
		print "\0" x ( $size % 4 );

		$index[-1][0] = $offset;
		$index[-1][1] = $size;
		$index[-1][2] = $offset + $size + ( $size % 4 );

		
		$size = 0;
		while( read F, my $buffer, 4096 ) {
			$size += length $buffer;
			print $buffer;
		}
		print "\0" x ( $size % 4 );

		$index[-1][3] = $size;
		$offset = $index[-1][2] + $size + ( $size % 4 );

		close F;
	}
}

my $count = 1;
foreach my $file ( @index )
{
	warn sprintf "Index[%4d]: 0x%08X 0x%08X 0x%08X 0x%08X\n", $count++, $file->[0], $file->[1], $file->[2], $file->[3];
	print pack "NNNNnn", $file->[0], $file->[1], $file->[2], $file->[3], 0x0000, 0x0000;
}

warn sprintf "Index at 0x%08X, length 0x%08X\n", $offset, @index * 20;
print pack "N", $offset;

