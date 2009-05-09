#!/usr/bin/perl

@ARGV || die "Usage: $0 template1.htm [... templateN.htm]\n";


my %tags;

foreach my $file ( @ARGV )
{
	if( open F, "< $file" )
	{
		local $/ = undef;

		my $data = <F>;

		while( $data =~ m/ <%: -? (\w+) (.*?) %> /sgx )
		{
			my ( $key, $val ) = ( $1, $2 );

			if( $key && $val )
			{
				$val =~ s/\s+/ /sg;
				$val =~ s/^\s+//;
				$val =~ s/\s+$//;

				$tags{$key} = $val;
			}
			else
			{
				$tags{$key} ||= '';
			}
		}

		close F;
	}
}

foreach my $key ( sort keys %tags )
{
	if( $val =~ /'/ )
	{
		printf "%s = [[%s]]\n", $key, $tags{$key};
	}
	else
	{
		printf "%s = '%s'\n", $key, $tags{$key};
	}
}
