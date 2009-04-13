#!/usr/bin/perl

use strict;
use File::Find;
use Digest::MD5 qw(md5 md5_hex);

my @search = @ARGV;
if( !@search ) {
	@search = (
		glob("libs/*"),
		glob("applications/*"),
		glob("i18n/*"),
		glob("modules/*")
	);
}


sub depth {
	my $p = shift;
	my $d = 0;
	$d++ while( $p =~ m{/}g );
	return $d;
};


my @index;
my $offset = 0;


#
# Build File Members
#

find( sub {
	# Skip non-files
	( -f $_ ) || return;

	# Skip stuff not in /luasrc/
	( $File::Find::name =~ m{/luasrc/} ) || return;

	# Skip .svn foo
	( $File::Find::name !~ m{/\.svn\z} ) || return;

	# Skip non-lua files
	( $File::Find::name =~ m{\.lua\z} ) || return;

	# Skip i18n files
	( $File::Find::name !~ m{/i18n/} ) || return;
	
	# Exclude cbi models and controllers for now
	( $File::Find::name !~ m{/controller/} && $File::Find::name !~ m{/model/cbi/} ) || return;

	# Exclude luci-statistics and lucittpd for now
	( $File::Find::name !~ m{/luci-statistics/} && $File::Find::name !~ m{/lucittpd/} ) || return;


	my $file = $File::Find::name;
	$file =~ s{^.+/luasrc/}{luci/};

	if( open F, "< $_" )
	{
		warn sprintf "Member at 0x%08X: %s\n", $offset, $file;
		push @index, [ ];

		my $size = 0;
		my $pad  = 0;

		$index[-1][0] = $offset;
		
		while( read F, my $buffer, 4096 ) {
			$size += length $buffer;
			print $buffer;
		}

		if( $size % 4 ) {
			$pad = ( 4 - ( $size % 4 ) );
		}

		print "\0" x $pad;

		$index[-1][1] = $size;
		$index[-1][2] = md5($file);
		$index[-1][3] = 0x0000;
		$index[-1][4] = $file;

		$offset += $size + $pad;

		close F;
	}
}, @search );


#
# Build File List Member
#

my $filelist = join("\0", map $_->[4], @index) . "\0";
my $listsize = length $filelist;
push @index, [ $offset, $listsize, "", 0xFFFF, undef ];
warn sprintf "Filelist at 0x%08X\n", $offset;

if( $listsize % 4 )
{
	$listsize += ( 4 - ($listsize % 4) );
	$filelist .= "\0" x ( 4 - ($listsize % 4) );
}

print $filelist;
$offset += $listsize;


my $count = 1;
foreach my $file ( @index )
{
	warn sprintf "Index[%4d]: 0x%08X 0x%08X 0x%04X 0x%04X %32s\n",
		$count++, $file->[0], $file->[1], $file->[3], 0x0000,
		$file->[4] ? md5_hex($file->[4]) : "0" x 32
	;

	print pack "NNnna16", $file->[0], $file->[1], $file->[3], 0x0000, $file->[2];
}

warn sprintf "Index at 0x%08X, length 0x%08X\n", $offset, @index * 28;
print pack "N", $offset;
