<?xml version="1.0" encoding="utf-8"?>
<!--
Copyright (C) 2008  Alina Friedrichsen <x-alina@gmx.net>

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions
are met:
1. Redistributions of source code must retain the above copyright
   notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE AUTHOR AND CONTRIBUTORS ``AS IS'' AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED.  IN NO EVENT SHALL THE AUTHOR OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
SUCH DAMAGE.
-->

<xsl:transform version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:i18n="http://luci.freifunk-halle.net/2008/i18n#" xmlns:h="http://www.w3.org/1999/xhtml" xmlns="http://www.w3.org/1999/xhtml" exclude-result-prefixes="i18n h">
<xsl:output method="text" encoding="utf-8" media-type="text/x-lua" indent="no"/>

<xsl:template match="/i18n:msgs">
	<xsl:apply-templates select="i18n:msg" />
</xsl:template>

<xsl:template match="i18n:msg">
	<xsl:if test="@xml:id != '' and translate(@xml:id, '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz', '') = ''">
		<xsl:if test="translate(substring(@xml:id, 0, 2), 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', '') = ''">
			<xsl:if test="@xml:id != 'and' and @xml:id != 'break' and @xml:id != 'do' and @xml:id != 'else' and @xml:id != 'elseif' and @xml:id != 'end' and @xml:id != 'false' and @xml:id != 'for' and @xml:id != 'function' and @xml:id != 'if' and @xml:id != 'in' and @xml:id != 'local' and @xml:id != 'nil' and @xml:id != 'not' and @xml:id != 'or' and @xml:id != 'repeat' and @xml:id != 'return' and @xml:id != 'then' and @xml:id != 'true' and @xml:id != 'until' and @xml:id != 'while'">
				<xsl:value-of select="@xml:id"/>
				<xsl:text> = '</xsl:text>
				<xsl:choose>
					<xsl:when test="@method = 'text'">
						<xsl:call-template name="escape-lua">
							<xsl:with-param name="string" select="."/>
						</xsl:call-template>
					</xsl:when>
					<xsl:otherwise>
						<xsl:apply-templates select="node()" mode="xhtml"/>
					</xsl:otherwise>
				</xsl:choose>
				<xsl:text>'&#10;</xsl:text>
			</xsl:if>
		</xsl:if>
	</xsl:if>
</xsl:template>

<xsl:template match="h:*" priority="-1" mode="xhtml">
	<xsl:text>&lt;</xsl:text>
	<xsl:value-of select="local-name(.)"/>
	<xsl:apply-templates select="@*" mode="xhtml"/>
	<xsl:text>&gt;</xsl:text>
	<xsl:apply-templates mode="xhtml"/>
	<xsl:text>&lt;/</xsl:text>
	<xsl:value-of select="local-name(.)"/>
	<xsl:text>&gt;</xsl:text>
</xsl:template>

<xsl:template match="*" priority="-2" mode="xhtml">
	<xsl:text>&lt;span class=&quot;</xsl:text>
	<xsl:value-of select="local-name(.)"/>
	<xsl:text>&quot;</xsl:text>
	<xsl:apply-templates select="@*" mode="xhtml"/>
	<xsl:text>&gt;</xsl:text>
	<xsl:apply-templates mode="xhtml"/>
	<xsl:text>&lt;/span&gt;</xsl:text>
</xsl:template>

<xsl:template match="h:br" mode="xhtml">
	<xsl:text>&lt;br</xsl:text>
	<xsl:apply-templates select="@*" mode="xhtml"/>
	<xsl:text> /&gt;</xsl:text>
</xsl:template>

<xsl:template match="h:img" mode="xhtml">
	<xsl:text>&lt;img</xsl:text>
	<xsl:apply-templates select="@*" mode="xhtml"/>
	<xsl:text> /&gt;</xsl:text>
</xsl:template>

<xsl:template match="@*" priority="-1" mode="xhtml">
	<xsl:if test="namespace-uri(.) = '' and local-name(.) != 'lang' or namespace-uri(.) = 'http://www.w3.org/XML/1998/namespace'">
		<xsl:if test="namespace-uri(..) = 'http://www.w3.org/1999/xhtml' or local-name(.) != 'class'">
			<xsl:text> </xsl:text>
			<xsl:if test="namespace-uri(.) = 'http://www.w3.org/XML/1998/namespace'">
				<xsl:text>xml:</xsl:text>
			</xsl:if>
			<xsl:value-of select="local-name(.)"/>
			<xsl:text>=&quot;</xsl:text>
			<xsl:variable name="escaped">
				<xsl:call-template name="escape-lua-xhtml1">
					<xsl:with-param name="string" select="."/>
				</xsl:call-template>
			</xsl:variable>
			<xsl:value-of select="$escaped"/>
			<xsl:text>&quot;</xsl:text>
		</xsl:if>
	</xsl:if>
</xsl:template>

<xsl:template match="@xml:lang" mode="xhtml">
	<xsl:variable name="escaped">
		<xsl:call-template name="escape-lua-xhtml1">
			<xsl:with-param name="string" select="."/>
		</xsl:call-template>
	</xsl:variable>
	<xsl:text> xml:lang=&quot;</xsl:text>
	<xsl:value-of select="$escaped"/>
	<xsl:text>&quot;</xsl:text>
	<xsl:text> lang=&quot;</xsl:text>
	<xsl:value-of select="$escaped"/>
	<xsl:text>&quot;</xsl:text>
</xsl:template>

<xsl:template match="text()" priority="-1" mode="xhtml">
	<xsl:variable name="escaped">
		<xsl:call-template name="escape-lua-xhtml1">
			<xsl:with-param name="string" select="."/>
		</xsl:call-template>
	</xsl:variable>
	<xsl:value-of select="$escaped"/>
</xsl:template>

<xsl:template name="escape-xhtml1">
	<xsl:param name="string"/>
	<xsl:variable name="escaped">
		<xsl:call-template name="replace">
			<xsl:with-param name="string" select="$string"/>
			<xsl:with-param name="search" select="'&amp;'"/>
			<xsl:with-param name="replace" select="'&amp;amp;'"/>
		</xsl:call-template>
	</xsl:variable>
	<xsl:variable name="escaped1">
		<xsl:call-template name="replace">
			<xsl:with-param name="string" select="$escaped"/>
			<xsl:with-param name="search" select="'&quot;'"/>
			<xsl:with-param name="replace" select="'&amp;quot;'"/>
		</xsl:call-template>
	</xsl:variable>
	<xsl:variable name="escaped2">
		<xsl:call-template name="replace">
			<xsl:with-param name="string" select="$escaped1"/>
			<xsl:with-param name="search" select='"&#39;"'/>
			<xsl:with-param name="replace" select="'&amp;#39;'"/>
		</xsl:call-template>
	</xsl:variable>
	<xsl:variable name="escaped3">
		<xsl:call-template name="replace">
			<xsl:with-param name="string" select="$escaped2"/>
			<xsl:with-param name="search" select="'&lt;'"/>
			<xsl:with-param name="replace" select="'&amp;lt;'"/>
		</xsl:call-template>
	</xsl:variable>
	<xsl:call-template name="replace">
		<xsl:with-param name="string" select="$escaped3"/>
		<xsl:with-param name="search" select="'&gt;'"/>
		<xsl:with-param name="replace" select="'&amp;gt;'"/>
	</xsl:call-template>
</xsl:template>

<xsl:template name="escape-lua">
	<xsl:param name="string"/>
	<xsl:variable name="escaped">
		<xsl:call-template name="replace">
			<xsl:with-param name="string" select="$string"/>
			<xsl:with-param name="search" select="'\'"/>
			<xsl:with-param name="replace" select="'\\'"/>
		</xsl:call-template>
	</xsl:variable>
	<xsl:variable name="escaped1">
		<xsl:call-template name="replace">
			<xsl:with-param name="string" select="$escaped"/>
			<xsl:with-param name="search" select="'&#10;'"/>
			<xsl:with-param name="replace" select="'\n'"/>
		</xsl:call-template>
	</xsl:variable>
	<xsl:variable name="escaped2">
		<xsl:call-template name="replace">
			<xsl:with-param name="string" select="$escaped1"/>
			<xsl:with-param name="search" select="'&#13;'"/>
			<xsl:with-param name="replace" select="'\r'"/>
		</xsl:call-template>
	</xsl:variable>
	<xsl:variable name="escaped3">
		<xsl:call-template name="replace">
			<xsl:with-param name="string" select="$escaped2"/>
			<xsl:with-param name="search" select="'&quot;'"/>
			<xsl:with-param name="replace" select="'\&quot;'"/>
		</xsl:call-template>
	</xsl:variable>
	<xsl:call-template name="replace">
		<xsl:with-param name="string" select="$escaped3"/>
		<xsl:with-param name="search" select='"&#39;"'/>
		<xsl:with-param name="replace" select='"\&#39;"'/>
	</xsl:call-template>
</xsl:template>

<xsl:template name="escape-lua-xhtml1">
	<xsl:param name="string"/>
	<xsl:variable name="escaped">
		<xsl:call-template name="escape-xhtml1">
			<xsl:with-param name="string" select="$string"/>
		</xsl:call-template>
	</xsl:variable>
	<xsl:call-template name="escape-lua">
		<xsl:with-param name="string" select="$escaped"/>
	</xsl:call-template>
</xsl:template>

<xsl:template name="replace">
	<xsl:param name="string"/>
	<xsl:param name="search"/>
	<xsl:param name="replace"/>
	<xsl:choose>
		<xsl:when test="contains($string, $search)">
			<xsl:value-of select="substring-before($string, $search)"/>
			<xsl:value-of select="$replace"/>
			<xsl:call-template name="replace">
				<xsl:with-param name="string" select="substring-after($string, $search)"/>
				<xsl:with-param name="search" select="$search"/>
				<xsl:with-param name="replace" select="$replace"/>
			</xsl:call-template>
		</xsl:when>
		<xsl:otherwise>
			<xsl:value-of select="$string"/>
		</xsl:otherwise>
	</xsl:choose>
</xsl:template>

</xsl:transform>
