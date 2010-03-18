#ifndef _UHTTPD_MIMETYPES_

static struct mimetype uh_mime_types[] = {

	{ "txt",    "text/plain" },
	{ "log",    "text/plain" },
	{ "js",     "text/javascript" },
	{ "css",    "text/css" },
	{ "htm",    "text/html" },
	{ "html",   "text/html" },
	{ "diff",   "text/x-patch" },
	{ "patch",  "text/x-patch" },
	{ "c",      "text/x-csrc" },
	{ "h",      "text/x-chdr" },
	{ "o",      "text/x-object" },
	{ "ko",     "text/x-object" },

	{ "bmp",    "image/bmp" },
	{ "gif",    "image/gif" },
	{ "png",    "image/png" },
	{ "jpg",    "image/jpeg" },
	{ "jpeg",   "image/jpeg" },
	{ "svg",    "image/svg+xml" },

	{ "zip",    "application/zip" },
	{ "pdf",    "application/pdf" },
	{ "xml",    "application/xml" },
	{ "xsl",    "application/xml" },
	{ "doc",    "application/msword" },
	{ "ppt",    "application/vnd.ms-powerpoint" },
	{ "xls",    "application/vnd.ms-excel" },
	{ "odt",    "application/vnd.oasis.opendocument.text" },
	{ "odp",    "application/vnd.oasis.opendocument.presentation" },
	{ "pl",     "application/x-perl" },
	{ "sh",     "application/x-shellscript" },
	{ "php",    "application/x-php" },
	{ "deb",    "application/x-deb" },
	{ "iso",    "application/x-cd-image" },
	{ "tgz",    "application/x-compressed-tar" },
	{ "gz",     "application/x-gzip" },
	{ "bz2",    "application/x-bzip" },
	{ "tar",    "application/x-tar" },
	{ "rar",    "application/x-rar-compressed" },

	{ "mp3",    "audio/mpeg" },
	{ "ogg",    "audio/x-vorbis+ogg" },
	{ "wav",    "audio/x-wav" },

	{ "mpg",    "video/mpeg" },
	{ "mpeg",   "video/mpeg" },
	{ "avi",    "video/x-msvideo" },

	{ "README", "text/plain" },
	{ "log",    "text/plain" },
	{ "cfg",    "text/plain" },
	{ "conf",   "text/plain" },

	{ NULL, NULL }
};

#endif

