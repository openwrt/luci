#ifndef __FWD_CONFIG_H__
#define __FWD_CONFIG_H__

#include "fwd.h"
#include "ucix.h"

/* fwd_check_option(uci_ctx, section, name, type) */
#define fwd_check_option(uci, sct, name, type)                       \
	struct fwd_##type *name = NULL;                                  \
	if( fwd_read_##type(uci, sct, #name, &name) )                    \
	{                                                                \
		printf("ERROR: section '%s' contains invalid %s in '%s'!\n", \
			sct, #type, #name);                                      \
        return;                                                      \
	}

/* structure to access fwd_data* in uci iter callbacks */
struct fwd_data_conveyor {
	struct fwd_data *head;
	struct fwd_data *cursor;
};

/* api */
struct fwd_data * fwd_read_config(struct fwd_handle *);
struct fwd_zone * fwd_lookup_zone(struct fwd_data *, const char *);

void fwd_free_config(struct fwd_data *);

#endif
