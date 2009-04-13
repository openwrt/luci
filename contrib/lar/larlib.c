/*
 * lar - Lua Archive Library
 *
 *   Copyright (C) 2009 Jo-Philipp Wich <xm@subsignal.org>
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */


#include "lua.h"
#include "lualib.h"
#include "lauxlib.h"
#include "lar.h"

typedef struct {
	int fd;
	char *data;
	size_t length;
} mmap_handle;

static int larlib_perror( lua_State *L, const char *message )
{
	lua_pushnil(L);
	lua_pushstring(L, message);

	return 2;
}

int larlib_open( lua_State *L )
{
	lar_archive *ar, **udata;
	const char *filename = luaL_checkstring( L, 1 );

	if( filename != NULL && (ar = lar_open(filename)) != NULL )
	{
		if( (udata = lua_newuserdata(L, sizeof(lar_archive *))) != NULL )
		{
			*udata = ar;
			luaL_getmetatable(L, "lar.archive");
			lua_setmetatable(L, -2);
		}
		else
		{
			return luaL_error(L, "Out of memory");
		}
	}
	else
	{
		return larlib_perror(L, "Archive not found");
	}

	return 1;
}

int larlib_find( lua_State *L )
{
	const char *filename = luaL_checkstring( L, 1 );
	const char *basepath = luaL_optstring( L, 2, "./" );
	int is_pkg = strstr(filename, "/") ? 0 : 1;
	lar_archive *ar, **udata;

	if( ((ar = lar_find_archive(filename, basepath, is_pkg)) != NULL) ||
	    ((ar = lar_find_archive(filename, LUA_LDIR, is_pkg)) != NULL) ||
		((ar = lar_find_archive(filename, LUA_CDIR, is_pkg)) != NULL) )
	{
		if( (udata = lua_newuserdata(L, sizeof(lar_archive *))) != NULL )
		{
			*udata = ar;
			luaL_getmetatable(L, "lar.archive");
			lua_setmetatable(L, -2);
		}
		else
		{
			return luaL_error(L, "Out of memory");
		}
	}
	else
	{
		return larlib_perror(L, "Archive not found");
	}

	return 1;
}

int larlib_md5( lua_State *L )
{
	int i;
	char md5[16], md5_hex[33];
	const char *data = luaL_checkstring( L, 1 );
	md5_state_t state;

	md5_init(&state);
	md5_append(&state, (const md5_byte_t *)data, strlen(data));
	md5_finish(&state, (md5_byte_t *)md5);

	for( i = 0; i < 16; i++ )
		sprintf(&md5_hex[i*2], "%02x", (unsigned char)md5[i]);

	lua_pushstring(L, md5_hex);
	return 1;
}

int larlib_md5_file( lua_State *L )
{
	int i, fd, len;
	char md5[16], md5_hex[33], buffer[1024];
	const char *filename = luaL_checkstring( L, 1 );
	md5_state_t state;

	if( (fd = open(filename, O_RDONLY)) != -1 )
	{
		md5_init(&state);

		while( (len = read(fd, buffer, 1024)) > 0 )
			md5_append(&state, (const md5_byte_t *)buffer, len);

		md5_finish(&state, (md5_byte_t *)md5);

		for( i = 0; i < 16; i++ )
			sprintf(&md5_hex[i*2], "%02x", (unsigned char)md5[i]);

		close(fd);
		lua_pushstring(L, md5_hex);
	}
	else
	{
		return larlib_perror(L, strerror(errno));
	}

	return 1;
}

static int larlib_mkpath( const char *name, const char *path, char *buffer )
{
	int nlen = strlen(name);
	int plen = strlen(path);

	if( (nlen + plen + 1) <= LAR_FNAME_BUFFER )
	{
		strcpy(buffer, path);

		if( buffer[plen-1] != '/' )
			buffer[plen++] = '/';

		strcpy(&buffer[plen], name);
		buffer[plen + nlen] = '\0';

		return 0;
	}

	return 1;
}

static int larlib__gc( lua_State *L )
{
	lar_archive **archive = luaL_checkudata( L, 1, "lar.archive" );

	if( *archive )
		lar_close(*archive);

	*archive = NULL;
	return 0;
}


static int larlib_member__open( lua_State *L, lar_member *mb )
{
	lar_archive **archive = NULL;
	const char *filename = NULL;
	lar_member **udata;

	if( mb == NULL )
	{
		*archive = luaL_checkudata( L, 1, "lar.archive" );
		filename = luaL_checkstring( L, 2 );
	}

	if( mb != NULL || (mb = lar_open_member(*archive, filename)) != NULL )
	{
		if( (udata = lua_newuserdata(L, sizeof(lar_member *))) != NULL )
		{
			*udata = mb;
			luaL_getmetatable(L, "lar.member");
			lua_setmetatable(L, -2);
		}
		else
		{
			return luaL_error(L, "Out of memory");
		}
	}
	else
	{
		return larlib_perror(L, "Member not found in archive");
	}

	return 1;
}

int larlib_member_open( lua_State *L )
{
	return larlib_member__open( L, NULL );
}

int larlib_member_find( lua_State *L )
{
	lar_archive **archive = luaL_checkudata( L, 1, "lar.archive" );
	const char *package = luaL_checkstring( L, 2 );
	lar_member *mb, **udata;

	if( (mb = lar_find_member(*archive, package)) != NULL )
	{
		if( (udata = lua_newuserdata(L, sizeof(lar_member *))) != NULL )
		{
			*udata = mb;
			luaL_getmetatable(L, "lar.member");
			lua_setmetatable(L, -2);
		}
		else
		{
			return luaL_error(L, "Out of memory");
		}
	}
	else
	{
		return larlib_perror(L, "Member not found in archive");
	}

	return 1;
}

int larlib_member_size( lua_State *L )
{
	lar_member **member = luaL_checkudata( L, 1, "lar.member" );
	lua_pushnumber(L, (*member)->length);
	return 1;
}

int larlib_member_type( lua_State *L )
{
	lar_member **member = luaL_checkudata( L, 1, "lar.member" );
	lua_pushnumber(L, (*member)->type);
	return 1;
}

int larlib_member_flags( lua_State *L )
{
	lar_member **member = luaL_checkudata( L, 1, "lar.member" );
	lua_pushnumber(L, (*member)->flags);
	return 1;
}

int larlib_member_read( lua_State *L )
{
	lar_member **member = luaL_checkudata( L, 1, "lar.member" );
	int start  = luaL_checknumber( L, 2 );
	int length = luaL_optnumber( L, 3, (*member)->length );
	char *stringcopy;

	if( (start >= 0) && (start < (*member)->length) && (length > 0) )
	{
		if( (start + length) >= (*member)->length )
			length = (*member)->length - start;

		if( (stringcopy = (char *)malloc(length + 1)) != NULL )
		{
			memcpy(stringcopy, &(*member)->data[start], length);
			stringcopy[length] = '\0';
			lua_pushstring(L, stringcopy);
			free(stringcopy);
		}
		else
		{
			return luaL_error(L, "Out of memory");
		}
	}
	else
	{
		return larlib_perror(L, "Invalid argument");
	}

	return 1;
}

int larlib_member_data( lua_State *L )
{
	lar_member **member = luaL_checkudata( L, 1, "lar.member" );
	lua_pushstring(L, (*member)->data);
	return 1;
}

int larlib_member_load( lua_State *L )
{
	lar_member **member = luaL_checkudata( L, 1, "lar.member" );
	int status = luaL_loadbuffer( L, (*member)->data, (*member)->length,
		"=(lar member)" );

	if( status )
	{
		lua_pushnil(L);
		lua_insert(L, -2);
		return 2;
	}

	return 1;
}

static int larlib_member__gc( lua_State *L )
{
	lar_member **member = luaL_checkudata( L, 1, "lar.member" );

	if( *member )
		lar_close_member(*member);

	*member = NULL;
	return 0;
}


static int larlib_mmfile__open( lua_State *L, const char *filename )
{
	struct stat s;
	mmap_handle *fh, **udata;

	if( filename == NULL )
		filename = (const char *)luaL_checkstring( L, 1 );

	if( (fh = (mmap_handle *)malloc(sizeof(mmap_handle))) == NULL )
		return larlib_perror(L, "Out of memory");

	if( stat(filename, &s) > -1 && (fh->fd = open(filename, O_RDONLY)) > -1 )
	{
		fh->length = s.st_size;
		fh->data   = mmap( 0, s.st_size, PROT_READ, MAP_PRIVATE, fh->fd, 0 );

		if( fh->data == MAP_FAILED )
			return larlib_perror(L, "Failed to mmap() file");

		if( (udata = lua_newuserdata(L, sizeof(char *))) != NULL )
		{
			*udata = fh;
			luaL_getmetatable(L, "lar.mmfile");
			lua_setmetatable(L, -2);
		}
		else
		{
			return larlib_perror(L, "Out of memory");
		}
	}
	else
	{
		return larlib_perror(L, strerror(errno));
	}

	return 1;
}

int larlib_mmfile_open( lua_State *L )
{
	return larlib_mmfile__open(L, NULL);
}

int larlib_mmfile_size( lua_State *L )
{
	mmap_handle **fh = luaL_checkudata( L, 1, "lar.mmfile" );
	lua_pushnumber(L, (*fh)->length);
	return 1;
}

int larlib_mmfile_read( lua_State *L )
{
	mmap_handle **fh = luaL_checkudata( L, 1, "lar.mmfile" );
	int start  = luaL_checknumber( L, 2 );
	int length = luaL_optnumber( L, 3, (*fh)->length );
	char *stringcopy;

	if( (start >= 0) && (start < (*fh)->length) && (length > 0) )
	{
		if( (start + length) >= (*fh)->length )
			length = (*fh)->length - start;

		if( (stringcopy = (char *)malloc(length + 1)) != NULL )
		{
			memcpy(stringcopy, &(*fh)->data[start], length);
			stringcopy[length] = '\0';
			lua_pushstring(L, stringcopy);
			free(stringcopy);
		}
		else
		{
			return luaL_error(L, "Out of memory");
		}
	}
	else
	{
		return larlib_perror(L, "Invalid argument");
	}

	return 1;
}

int larlib_mmfile_data( lua_State *L )
{
	mmap_handle **fh = luaL_checkudata( L, 1, "lar.mmfile" );
	lua_pushstring(L, (*fh)->data);
	return 1;
}

int larlib_mmfile_load( lua_State *L )
{
	mmap_handle **fh = luaL_checkudata( L, 1, "lar.mmfile" );
	int status = luaL_loadbuffer(L, (*fh)->data, (*fh)->length, "=(mmap file)");

	if( status )
	{
		lua_pushnil(L);
		lua_insert(L, -2);
		return 2;
	}

	return 1;
}

static int larlib_mmfile__gc( lua_State *L )
{
	mmap_handle **fh = luaL_checkudata( L, 1, "lar.mmfile" );

	if( *fh )
	{
		close((*fh)->fd);
		munmap((*fh)->data, (*fh)->length);
		free(*fh);
		*fh = NULL;
	}

	return 0;
}


int larlib_findfile( lua_State *L )
{
	int i;
	const char *filename = luaL_checkstring( L, 1 );
	const char *basepath = luaL_optstring( L, 2, "./" );
	struct stat s;
	lar_archive *ar;
	lar_member  *mb;
	LAR_FNAME(filepath);

	const char *searchpath[3] = { basepath, LUA_LDIR, LUA_CDIR };

	for( i = 0; i < 3; i++ )
		if( !larlib_mkpath(filename, searchpath[i], filepath) )
			if( stat(filepath, &s) > -1 && (s.st_mode & S_IFREG) )
				return larlib_mmfile__open( L, filepath );

	for( i = 0; i < 3; i++ )
		if( (ar = lar_find_archive(filename, searchpath[i], 0)) != NULL )
			if( (mb = lar_open_member(ar, filename)) != NULL )
				return larlib_member__open( L, mb );

	return larlib_perror(L, "File not found");
}


static const luaL_reg LAR_REG[] = {
	{ "open",			larlib_open 		},
	{ "find",			larlib_find 		},
	{ "md5",			larlib_md5			},
	{ "md5_file",		larlib_md5_file		},
	{ "mmap",			larlib_mmfile_open	},
	{ "findfile",		larlib_findfile		},
	{ NULL,				NULL				}
};

static const luaL_reg LAR_ARCHIVE_REG[] = {
	{ "member",			larlib_member_open	},
	{ "find",			larlib_member_find	},
	{ "__gc",			larlib__gc			},
	{ NULL,				NULL				}
};

static const luaL_reg LAR_MEMBER_REG[] = {
	{ "size",			larlib_member_size	},
	{ "type",			larlib_member_type	},
	{ "flags",			larlib_member_flags	},
	{ "read",			larlib_member_read	},
	{ "data",			larlib_member_data	},
	{ "load",			larlib_member_load	},
	{ "__gc",			larlib_member__gc	},
	{ NULL,				NULL				}
};

static const luaL_reg LAR_MMFILE_REG[] = {
	{ "size",			larlib_mmfile_size	},
	{ "read",			larlib_mmfile_read	},
	{ "data",			larlib_mmfile_data	},
	{ "load",			larlib_mmfile_load	},
	{ "__gc",			larlib_mmfile__gc	},
	{ NULL,				NULL				}
};


LUALIB_API int luaopen_larlib( lua_State *L )
{
	luaL_newmetatable(L, "lar");
	luaL_register(L, NULL, LAR_REG);
	lua_pushvalue(L, -1);
	lua_setfield(L, -2, "__index");
	lua_setglobal(L, "lar");

	luaL_newmetatable(L, "lar.archive");
	luaL_register(L, NULL, LAR_ARCHIVE_REG);
	lua_pushvalue(L, -1);
	lua_setfield(L, -2, "__index");
	lua_setglobal(L, "lar.archive");

	luaL_newmetatable(L, "lar.member");
	luaL_register(L, NULL, LAR_MEMBER_REG);
	lua_pushvalue(L, -1);
	lua_setfield(L, -2, "__index");
	lua_setglobal(L, "lar.member");

	luaL_newmetatable(L, "lar.mmfile");
	luaL_register(L, NULL, LAR_MMFILE_REG);
	lua_pushvalue(L, -1);
	lua_setfield(L, -2, "__index");
	lua_setglobal(L, "lar.mmfile");

	return 1;
}
