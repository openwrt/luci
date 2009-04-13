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

	if( ar->has_filenames )
	{
		while(index)
		{
			if( index->type == LAR_TYPE_REGULAR )
			{
				printf("%s\n", index->filename);
			}

			index = index->next;
		}

		return 0;
	}

	LAR_DIE("The archive contains no file list");
	return 1;
}

int do_require( const char *package, const char *path )
{
	int stat = 1;
	lar_archive *ar;
	lar_member *mb;

	if( (ar = lar_find_archive(package, path, 1)) != NULL )
	{
		if( (mb = lar_find_member(ar, package)) != NULL )
		{
			write(fileno(stdout), mb->data, mb->length);
			lar_close_member(mb);
			stat = 0;
		}

		lar_close(ar);
	}

	return stat;
}

int do_findfile( const char *filename, const char *path )
{
	int stat = 1;
	lar_archive *ar;
	lar_member *mb;

	if( (ar = lar_find_archive(filename, path, 0)) != NULL )
	{
		if( (mb = lar_open_member(ar, filename)) != NULL )
		{
			write(fileno(stdout), mb->data, mb->length);
			lar_close_member(mb);
			stat = 0;
		}

		lar_close(ar);
	}

	return stat;
}

int main( int argc, const char* argv[] )
{
	lar_archive *ar;
	int stat = 0;

	if( argv[1] != NULL && argv[2] != NULL )
	{
		switch(argv[1][0])
		{
			case 's':
				if( (ar = lar_open(argv[2])) != NULL )
				{
					if( argv[3] != NULL )
						stat = do_print_member(ar, argv[3]);
					else
						stat = do_print_index(ar);

					lar_close(ar);
				}
				else
				{
					LAR_DIE("Failed to open archive");
				}

				break;

			case 'r':
				stat = do_require(argv[2], argv[3]);
				break;

			case 'f':
				stat = do_findfile(argv[2], argv[3]);
				break;
		}

		return stat;
	}
	else
	{
		printf("Usage:\n");
		printf("\tlar show <archive> [<member>]\n");
		printf("\tlar require <package> [<path>]\n");
		printf("\tlar find <filename> [<path>]\n");

		return 1;
	}

	return 0;
}
