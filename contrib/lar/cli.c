#include "lar.h"

int do_print_member( lar_archive *ar, const char *name )
{
	lar_member *member;

	if( (member = lar_open_member(ar, name)) != NULL )
	{
		write(fileno(stdout), member->data, member->length);
		lar_close_member(member);
	}
	else
		LAR_DIE("Unable to locate archive member");

	return 0;
}

int do_print_index( lar_archive *ar )
{
	lar_index *index = ar->index;
	LAR_FNAME(filename);

	while(index)
	{
		lar_get_filename(ar, index, filename);
		printf("%s\n", filename);
		index = index->next;
	}

	return 0;	
}

int main( int argc, const char* argv[] )
{
	lar_archive *ar;
	int stat = 0;

	if( argv[1] != NULL )
	{
		if( (ar = lar_open(argv[1])) != NULL )
		{
			if( argv[2] )
				stat = do_print_member(ar, argv[2]);
			else
				stat = do_print_index(ar);

			lar_close(ar);
			return stat;
		}
		else
		{
			LAR_DIE("Failed to open archive");
		}
	}
	else
	{
		printf("Usage: lar <archive> [<member>]\n");
		return 1;
	}

	return 0;
}

