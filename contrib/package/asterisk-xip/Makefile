#
# Copyright (C) 2007 OpenWrt.org
# Copyright (C) 2008-2009 Michael Geddes
#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#
# $Id: Makefile 13712 2008-12-21 20:34:15Z zandbelt $

include $(TOPDIR)/rules.mk

PKG_NAME:=asterisk
PKG_VERSION:=1.4.22
PKG_RELEASE:=4

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=http://downloads.digium.com/pub/asterisk/releases/
PKG_MD5SUM:=7626febc4a01e16e012dfccb9e4ab9d2

PKG_BUILD_DEPENDS:= libopenh323 pwlib gsm libvorbis

include $(INCLUDE_DIR)/package.mk

STAMP_CONFIGURED:=$(STAMP_CONFIGURED)_$(call confvar, \
	CONFIG_PACKAGE_asterisk14-xip CONFIG_PACKAGE_asterisk14-xip-mini \
	CONFIG_PACKAGE_asterisk14-xip-chan-alsa CONFIG_PACKAGE_asterisk14-xip-chan-gtalk \
	CONFIG_PACKAGE_asterisk14-xip-chan-h323 CONFIG_PACKAGE_asterisk14-xip-chan-mgcp \
	CONFIG_PACKAGE_asterisk14-xip-chan-skinny CONFIG_PACKAGE_asterisk14-xip-codec-ilbc \
	CONFIG_PACKAGE_asterisk14-xip-codec-lpc10 CONFIG_PACKAGE_asterisk14-xip-codec-speex \
	CONFIG_PACKAGE_asterisk14-xip-pbx-dundi CONFIG_PACKAGE_asterisk14-xip-res-agi \
	CONFIG_PACKAGE_asterisk14-xip-res-crypto CONFIG_PACKAGE_asterisk14-xip-pgsql \
	CONFIG_PACKAGE_asterisk14-xip-sqlite CONFIG_PACKAGE_asterisk14-xip-voicemail \
	CONFIG_PACKAGE_asterisk14-xip-sounds \
)

define Package/asterisk14-xip/Default
  SUBMENU:=asterisk14-xip (Complete Open Source PBX), v1.4.x
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=Asterisk
  URL:=http://www.asterisk.org/
endef

define Package/asterisk14-xip/Default/description
 Asterisk is a complete PBX in software. It provides all of the features
 you would expect from a PBX and more. Asterisk does voice over IP in three
 protocols, and can interoperate with almost all standards-based telephony
 equipment using relatively inexpensive hardware.
endef

define Package/asterisk14-xip-core
$(call Package/asterisk14-xip/Default)
  TITLE:=Asterisk Core
  DEPENDS:=+libncurses +libpopt +libpthread @!TARGET_avr32
endef

define Package/asterisk14-xip-core/description
$(call Package/asterisk14-xip/Default/description)
Asterisk Core
  codec_gsm
  format_gsm
  pbx_config   Read Configuration
  res_indications Tone support
  app_dial
  chan_local Dial Local channel
endef

define Package/asterisk14-xip
$(call Package/asterisk14-xip/Default)
  TITLE:=Complete open source PBX
  DEPENDS:= +asterisk14-xip-core +asterisk14-xip-iax +asterisk14-xip-sip +asterisk14-xip-codec-ualaw +asterisk14-xip-codec-wav +asterisk14-xip-features +asterisk14-xip-moh \
            +asterisk14-xip-app-meetme +asterisk14-xip-chan-oss +asterisk14-xip-chan-alsa +asterisk14-xip-chan-gtalk +asterisk14-xip-chan-h323 +asterisk14-xip-chan-mgcp \
            +asterisk14-xip-chan-skinny +asterisk14-xip-codec-lpc10 +asterisk14-xip-codec-speex +asterisk14-xip-pbx-dundi +asterisk14-xip-res-agi +asterisk14-xip-res-crypto \
            +asterisk14-xip-pgsql +asterisk14-xip-sqlite +asterisk14-xip-voicemail +asterisk14-xip-sounds +asterisk14-xip-rawplayer +asterisk14-xip-agents +asterisk14-xip-iax \
            +asterisk14-xip-sip +asterisk14-xip-codec-wav +asterisk14-xip-codec-ualaw +asterisk14-xip-format-misc +asterisk14-xip-format-licensed +asterisk14-xip-codec-g726 \
            +asterisk14-xip-format-video +asterisk14-xip-variables +asterisk14-xip-enum +asterisk14-xip-basic +asterisk14-xip-encode +asterisk14-xip-realtime \
            +asterisk14-xip-ael +asterisk14-xip-adsi +asterisk14-xip-features +asterisk14-xip-moh +asterisk14-xip-smdi +asterisk14-xip-sounds-tt \
            +asterisk14-xip-sounds-demo +asterisk14-xip-linejack +asterisk14-xip-app-misc +asterisk14-xip-image +asterisk14-xip-sms +asterisk14-xip-icecast \
            +asterisk14-xip-mp3 +asterisk14-xip-cli +asterisk14-xip-isdn +asterisk14-xip-deprecated +asterisk14-xip-groups +asterisk14-xip-language +asterisk14-xip-spool \
            +asterisk14-xip-nbs +asterisk14-xip-alarmreceiver +asterisk14-xip-cdr +asterisk14-xip-channel +asterisk14-xip-debug +asterisk14-xip-menu-misc \
            +asterisk14-xip-festival +asterisk14-xip-send-app +asterisk14-xip-followme +asterisk14-xip-queues +asterisk14-xip-record +asterisk14-xip-privacy \
            +asterisk14-xip-ivr-util +asterisk14-xip-callerid +asterisk14-xip-speech +asterisk14-xip-detect +asterisk14-xip-controlflow @!TARGET_avr32
endef

define Package/asterisk14-xip/description
$(call Package/asterisk14-xip/Default/description)
endef


define Package/asterisk14-xip-mini
$(call Package/asterisk14-xip/Default)
  TITLE:=Minimal open source PBX
  DEPENDS:=+libncurses +libpthread +asterisk14-xip-core +asterisk14-xip-iax +asterisk14-xip-sip +asterisk14-xip-codec-ualaw +asterisk14-xip-codec-wav +asterisk14-xip-features +asterisk14-xip-moh +libgsm  @!TARGET_avr32
endef

define Package/asterisk14-xip-mini/description
$(call Package/asterisk14-xip/Default/description)
 This package contains only the following modules:
 - app_dial
 - chan_iax2
 - chan_local
 - chan_sip
 - codec_gsm
 - codec_ulaw
 - format_gsm
 - format_pcm
 - format_wav
 - format_wav_gsm
 - pbx_config
 - res_features
 - res_musiconhold
endef


define Package/asterisk14-xip-app-meetme
$(call Package/asterisk14-xip/Default)
  TITLE:=conferencing support
  DEPENDS:= +asterisk14-xip-core +zaptel14-libtonezone
endef

define Package/asterisk14-xip-app-meetme/description
$(call Package/asterisk14-xip/Default/description)
 This package provides the MeetMe application driver Conferencing support to 
 Asterisk.
   app_meetme
   app_page   Paging multiple extensions.
endef


define Package/asterisk14-xip-chan-oss
$(call Package/asterisk14-xip/Default)
  TITLE:=OSS soundcards support
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-chan-oss/description
$(call Package/asterisk14-xip/Default/description)
 This package provides the channel driver for OSS sound cards support to 
 Asterisk.
endef

define Package/asterisk14-xip-chan-alsa
$(call Package/asterisk14-xip/Default)
  TITLE:=ALSA soundcards support
  DEPENDS:= +asterisk14-xip-core +alsa-lib
endef

define Package/asterisk14-xip-chan-alsa/description
$(call Package/asterisk14-xip/Default/description)
 This package provides the channel driver for ALSA sound cards support to 
 Asterisk.
endef


define Package/asterisk14-xip-chan-gtalk
$(call Package/asterisk14-xip/Default)
  TITLE:=GTalk support
  DEPENDS:= +asterisk14-xip-core +libiksemel
endef

define Package/asterisk14-xip-chan-gtalk/description
$(call Package/asterisk14-xip/Default/description)
 This package provides the channel chan_gtalk and res_jabber for GTalk 
 support to Asterisk.
endef


define Package/asterisk14-xip-chan-h323
$(call Package/asterisk14-xip/Default)
  TITLE:=H.323 support for Asterisk
  DEPENDS:= +asterisk14-xip-core +uclibcxx
endef

define Package/asterisk14-xip-chan-h323/description
$(call Package/asterisk14-xip/Default/description)
 This package provides H.323 support to Asterisk.
endef


define Package/asterisk14-xip-chan-mgcp
$(call Package/asterisk14-xip/Default)
  TITLE:=MGCP support
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-chan-mgcp/description
$(call Package/asterisk14-xip/Default/description)
 This package provides MGCP (Media Gateway Control Protocol) support \\\
 to Asterisk.
endef


define Package/asterisk14-xip-chan-skinny
$(call Package/asterisk14-xip/Default)
  TITLE:=Skinny Client Control Protocol support
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-chan-skinny/description
$(call Package/asterisk14-xip/Default/description)
 This package provided Skinny Client Control Protocol support to \\\
 Asterisk.
endef


#define Package/asterisk14-xip-codec-ilbc
#$(call Package/asterisk14-xip/Default)
#  TITLE:=ILBC Translator
#  DEPENDS:= +asterisk14-xip-core
#endef

#define Package/asterisk14-xip-codec-ilbc/description
#$(call Package/asterisk14-xip/Default/description)
# This package contains the ILBC (Internet Low Bitrate Codec) translator 
# for Asterisk.
#endef


define Package/asterisk14-xip-codec-lpc10
$(call Package/asterisk14-xip/Default)
  TITLE:=LPC10 2.4kbps voice codec Translator
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-chan-lpc10/description
$(call Package/asterisk14-xip/Default/description)
 This package contains the LPC10 (Linear Predictor Code) 2.4kbps voice 
 codec translator for Asterisk.
endef


define Package/asterisk14-xip-codec-speex
$(call Package/asterisk14-xip/Default)
  TITLE:=Speex/PCM16 Codec Translator
  DEPENDS:= +asterisk14-xip-core +libspeex +libspeexdsp
endef

define Package/asterisk14-xip-chan-speex/description
$(call Package/asterisk14-xip/Default/description)
 This package contains the Speex speech compression codec translator for 
 Asterisk.
endef


define Package/asterisk14-xip-pbx-dundi
$(call Package/asterisk14-xip/Default)
  TITLE:=DUNDi support
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-pbx-dundi/description
$(call Package/asterisk14-xip/Default/description)
 This package provides DUNDi (Distributed Universal Number Discovery) 
 support to Asterisk.
endef


define Package/asterisk14-xip-res-agi
$(call Package/asterisk14-xip/Default)
  TITLE:=AGI support
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-res-agi/description
$(call Package/asterisk14-xip/Default/description)
 This package provides AGI (Asterisk Gateway Interface) support to 
 Asterisk.
endef


define Package/asterisk14-xip-res-crypto
$(call Package/asterisk14-xip/Default)
  TITLE:=Cryptographic Digital Signatures support
  DEPENDS:= +asterisk14-xip-core +libopenssl
endef

define Package/asterisk14-xip-res-crypto/description
$(call Package/asterisk14-xip/Default/description)
 This package provides Cryptographic Digital Signatures support to 
 Asterisk.
endef


define Package/asterisk14-xip-pgsql
$(call Package/asterisk14-xip/Default)
  TITLE:=PostgreSQL support
  DEPENDS:= +asterisk14-xip-core +libpq
endef

define Package/asterisk14-xip-pgsql/description
$(call Package/asterisk14-xip/Default/description)
 This package contains PostgreSQL support modules for Asterisk.
endef


define Package/asterisk14-xip-sqlite
$(call Package/asterisk14-xip/Default)
  TITLE:=SQLite modules
  DEPENDS:= +asterisk14-xip-core +libsqlite2
endef

define Package/asterisk14-xip-sqlite/description
$(call Package/asterisk14-xip/Default/description)
 This package contains SQLite support modules for Asterisk.
endef


define Package/asterisk14-xip-sounds
$(call Package/asterisk14-xip/Default)
  TITLE:=Sound files
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-sounds/description
$(call Package/asterisk14-xip/Default/description)
 This package contains sound files for Asterisk.
endef


define Package/asterisk14-xip-voicemail
$(call Package/asterisk14-xip/Default)
  TITLE:=Voicemail support
  DEPENDS:= +asterisk14-xip-core +asterisk14-xip-adsi
endef

define Package/asterisk14-xip-voicemail/description
$(call Package/asterisk14-xip/Default/description)
 This package contains voicemail related modules for Asterisk.
endef

define Package/asterisk14-xip-rawplayer
$(call Package/asterisk14-xip/Default)
  TITLE:=Play raw files for asterisk
endef

define Package/asterisk14-xip-rawplayer/description
 Contains the rawplayer utility for asterisk
endef

define Package/asterisk14-xip-agents
$(call Package/asterisk14-xip/Default)
  TITLE:=Support for user Agents
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-agents/description
$(call Package/asterisk14-xip/Default/description)
Support for user Agents
  chan_agent
endef

define Package/asterisk14-xip-iax
$(call Package/asterisk14-xip/Default)
  TITLE:=IAX2 Channel support
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-iax/description
$(call Package/asterisk14-xip/Default/description)
IAX2 Channel support
  chan_iax2
endef

define Package/asterisk14-xip-sip
$(call Package/asterisk14-xip/Default)
  TITLE:=SIP Channel support
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-sip/description
$(call Package/asterisk14-xip/Default/description)
SIP Channel support
  chan_sip
endef

define Package/asterisk14-xip-codec-wav
$(call Package/asterisk14-xip/Default)
  TITLE:=WAV/PCM Codecs
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-codec-wav/description
$(call Package/asterisk14-xip/Default/description)
WAV/PCM Codecs
  codec_adpcm
  format_pcm
  format_wav_gsm Microsoft Proprietary Wave GSM format
  format_wav
endef

define Package/asterisk14-xip-codec-ualaw
$(call Package/asterisk14-xip/Default)
  TITLE:=Ulaw/Alaw Codec support
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-codec-ualaw/description
$(call Package/asterisk14-xip/Default/description)
Ulaw/Alaw Codec support
  codec_alaw
  codec_a_mu A-Law and MUlaw direct coder/Decoder
  codec_ulaw
endef

define Package/asterisk14-xip-format-misc
$(call Package/asterisk14-xip/Default)
  TITLE:=Misc pass-through formats
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-format-misc/description
$(call Package/asterisk14-xip/Default/description)
Misc pass-through formats
  format_sln
  format_vox
  format_ilbc iLBC
endef

define Package/asterisk14-xip-format-licensed
$(call Package/asterisk14-xip/Default)
  TITLE:=Licenses and Patented Formats Passthrough
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-format-licensed/description
$(call Package/asterisk14-xip/Default/description)
Licenses and Patented Formats Passthrough
  format_g726
  format_g723
  format_g729
endef

define Package/asterisk14-xip-codec-g726
$(call Package/asterisk14-xip/Default)
  TITLE:=G726 Codec (requires license)
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-codec-g726/description
$(call Package/asterisk14-xip/Default/description)
G726 Codec (requires license)
  codec_g726
endef

define Package/asterisk14-xip-format-video
$(call Package/asterisk14-xip/Default)
  TITLE:=Video formats
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-format-video/description
$(call Package/asterisk14-xip/Default/description)
Video formats
  format_h263
  format_h264
endef

define Package/asterisk14-xip-variables
$(call Package/asterisk14-xip/Default)
  TITLE:=Read Variables and environment
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-variables/description
$(call Package/asterisk14-xip/Default/description)
Read Variables and environment
  func_db
  func_global
  func_env
  func_timeout Control timeout values
endef

define Package/asterisk14-xip-enum
$(call Package/asterisk14-xip/Default)
  TITLE:=DNS Enum support to find alternate call route
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-enum/description
$(call Package/asterisk14-xip/Default/description)
DNS Enum support to find alternate call route
  func_enum Use DNS to find alternate calling method
endef

define Package/asterisk14-xip-basic
$(call Package/asterisk14-xip/Default)
  TITLE:=Basic functions
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-basic/description
$(call Package/asterisk14-xip/Default/description)
Basic functions
  func_logic
  func_math
  func_strings
  func_rand
  func_cut
endef

define Package/asterisk14-xip-encode
$(call Package/asterisk14-xip/Default)
  TITLE:=Support for string encoding/hashing
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-encode/description
$(call Package/asterisk14-xip/Default/description)
Support for string encoding/hashing
  func_base64
  func_md5
  func_sha1
  func_uri
endef

define Package/asterisk14-xip-realtime
$(call Package/asterisk14-xip/Default)
  TITLE:=Asterisk Realtime support
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-realtime/description
$(call Package/asterisk14-xip/Default/description)
Asterisk Realtime support
  func_realtime
  pbx_realtime
  app_realtime 'Realtime' support
endef

define Package/asterisk14-xip-ael
$(call Package/asterisk14-xip/Default)
  TITLE:=AEL - Asterisk Extension Language compiler support
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-ael/description
$(call Package/asterisk14-xip/Default/description)
AEL - Asterisk Extension Language compiler support
  pbx_ael Asterisk Extension Language compiler
endef

define Package/asterisk14-xip-adsi
$(call Package/asterisk14-xip/Default)
  TITLE:=ADSI Support
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-adsi/description
$(call Package/asterisk14-xip/Default/description)
ADSI Support
  res_adsi
  app_adsiprog
endef

define Package/asterisk14-xip-features
$(call Package/asterisk14-xip/Default)
  TITLE:=Call Features / Parking
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-features/description
$(call Package/asterisk14-xip/Default/description)
Call Features / Parking
  res_features Features support.
  app_transfer
  app_parkandannounce
  res_monitor Record channels
endef

define Package/asterisk14-xip-moh
$(call Package/asterisk14-xip/Default)
  TITLE:=Music On Hold support
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-moh/description
$(call Package/asterisk14-xip/Default/description)
Music On Hold support
  res_musiconhold
  func_moh
endef

define Package/asterisk14-xip-smdi
$(call Package/asterisk14-xip/Default)
  TITLE:=Simple Message Desk Interface
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-smdi/description
$(call Package/asterisk14-xip/Default/description)
Simple Message Desk Interface
  res_smdi Simple Message Desk Interface
endef

define Package/asterisk14-xip-sounds-tt
$(call Package/asterisk14-xip/Default)
  TITLE:=Telemarketer Torture Sounds
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-sounds-tt/description
$(call Package/asterisk14-xip/Default/description)
Telemarketer Torture Sounds
endef

define Package/asterisk14-xip-sounds-demo
$(call Package/asterisk14-xip/Default)
  TITLE:=Demo Sounds
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-sounds-demo/description
$(call Package/asterisk14-xip/Default/description)
Demo Sounds
endef

define Package/asterisk14-xip-linejack
$(call Package/asterisk14-xip/Default)
  TITLE:=M chan_phone (32,988) Linejack Cards 
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-linejack/description
$(call Package/asterisk14-xip/Default/description)
M chan_phone (32,988) Linejack Cards 
endef

define Package/asterisk14-xip-app-misc
$(call Package/asterisk14-xip/Default)
  TITLE:=Misc applications
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-app-misc/description
$(call Package/asterisk14-xip/Default/description)
Misc applications
  app_random
  app_sayunixtime
  app_sendtext
  app_url
  app_readfile
  app_system Call System application.
  app_exec Exec Dialplan applications
endef

define Package/asterisk14-xip-image
$(call Package/asterisk14-xip/Default)
  TITLE:=Support for images
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-image/description
$(call Package/asterisk14-xip/Default/description)
Support for images
  app_image Transmit images
  format_jpeg
endef

define Package/asterisk14-xip-sms
$(call Package/asterisk14-xip/Default)
  TITLE:=SMS support
  DEPENDS:= +asterisk14-xip-core +libstdcpp
endef

define Package/asterisk14-xip-sms/description
$(call Package/asterisk14-xip/Default/description)
SMS support
  app_sms
endef

define Package/asterisk14-xip-icecast
$(call Package/asterisk14-xip/Default)
  TITLE:=ICEcast support
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-icecast/description
$(call Package/asterisk14-xip/Default/description)
ICEcast support
  app_ices Icecast / Ices support
endef

define Package/asterisk14-xip-mp3
$(call Package/asterisk14-xip/Default)
  TITLE:=MP3 Support
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-mp3/description
$(call Package/asterisk14-xip/Default/description)
MP3 Support
  app_mp3
endef

define Package/asterisk14-xip-cli
$(call Package/asterisk14-xip/Default)
  TITLE:=CLI Apps and events
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-cli/description
$(call Package/asterisk14-xip/Default/description)
CLI Apps and events
  app_userevent
  res_clioriginate Originate a call on the CLI
  res_convert File format conversion
endef

define Package/asterisk14-xip-isdn
$(call Package/asterisk14-xip/Default)
  TITLE:=ISDN transfer capability
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-isdn/description
$(call Package/asterisk14-xip/Default/description)
ISDN transfer capability
  app_settransfercapability ISDN transfer capability
endef

define Package/asterisk14-xip-deprecated
$(call Package/asterisk14-xip/Default)
  TITLE:=Deprecated
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-deprecated/description
$(call Package/asterisk14-xip/Default/description)
Deprecated
  app_db Deprecated - use func_db instead
endef

define Package/asterisk14-xip-groups
$(call Package/asterisk14-xip/Default)
  TITLE:=Group Functions
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-groups/description
$(call Package/asterisk14-xip/Default/description)
Group Functions
  func_groupcount
endef

define Package/asterisk14-xip-language
$(call Package/asterisk14-xip/Default)
  TITLE:=Language support
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-language/description
$(call Package/asterisk14-xip/Default/description)
Language support
  func_language
endef

define Package/asterisk14-xip-spool
$(call Package/asterisk14-xip/Default)
  TITLE:=Spool Directory of Outgoing calls
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-spool/description
$(call Package/asterisk14-xip/Default/description)
Spool Directory of Outgoing calls
  pbx_spool Spool Directory of Outgoing calls
endef

define Package/asterisk14-xip-nbs
$(call Package/asterisk14-xip/Default)
  TITLE:=NBS stream support
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-nbs/description
$(call Package/asterisk14-xip/Default/description)
NBS stream support
  app_nbscat
endef

define Package/asterisk14-xip-alarmreceiver
$(call Package/asterisk14-xip/Default)
  TITLE:=SIA Contact ID Alarm receiver
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-alarmreceiver/description
$(call Package/asterisk14-xip/Default/description)
SIA Contact ID Alarm receiver
  app_alarmreceiver
endef

define Package/asterisk14-xip-cdr
$(call Package/asterisk14-xip/Default)
  TITLE:=CDR Support
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-cdr/description
$(call Package/asterisk14-xip/Default/description)
CDR Support
  app_cdr
  app_forkcdr
  app_setcdruserfield
  cdr_csv
  cdr_custom
  cdr_manager
  func_cdr
endef

define Package/asterisk14-xip-channel
$(call Package/asterisk14-xip/Default)
  TITLE:=Channel functions
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-channel/description
$(call Package/asterisk14-xip/Default/description)
Channel functions
  app_chanisavail
  app_channelredirect
  app_chanspy
  func_channel
  app_softhangup
  app_directed_pickup Pickup a (specific) ringing extensions
  app_pickup2  Extended pickup
endef

define Package/asterisk14-xip-debug
$(call Package/asterisk14-xip/Default)
  TITLE:=Debugging tools
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-debug/description
$(call Package/asterisk14-xip/Default/description)
Debugging tools
  app_echo
  pbx_loopback
  app_dumpchan Dump information about the calling channel
  app_verbose
  app_test AIX Server/client testing
endef

define Package/asterisk14-xip-menu-misc
$(call Package/asterisk14-xip/Default)
  TITLE:=Special menu applications
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-menu-misc/description
$(call Package/asterisk14-xip/Default/description)
Special menu applications
  app_controlplayback
  app_directory
  app_dictate
endef

define Package/asterisk14-xip-festival
$(call Package/asterisk14-xip/Default)
  TITLE:=Festival support
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-festival/description
$(call Package/asterisk14-xip/Default/description)
Festival support
  app_festival
endef

define Package/asterisk14-xip-send-app
$(call Package/asterisk14-xip/Default)
  TITLE:=Misc tone sending applications
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-send-app/description
$(call Package/asterisk14-xip/Default/description)
Misc tone sending applications
  app_flash Send a flash
  app_senddtmf Send dtmf
  app_milliwatt
  app_morsecode
  app_zapateller Generate tone to block telemarketers
endef

define Package/asterisk14-xip-followme
$(call Package/asterisk14-xip/Default)
  TITLE:=Followme - Call forwarding
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-followme/description
$(call Package/asterisk14-xip/Default/description)
Followme - Call forwarding
  app_followme
endef


define Package/asterisk14-xip-queues
$(call Package/asterisk14-xip/Default)
  TITLE:=Call queues
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-queues/description
$(call Package/asterisk14-xip/Default/description)
Call queues
  app_queue
endef

define Package/asterisk14-xip-record
$(call Package/asterisk14-xip/Default)
  TITLE:=Call recording
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-record/description
$(call Package/asterisk14-xip/Default/description)
Call recording
  app_record
  app_mixmonitor Records The audio on the current channel to the specified file. 
endef

define Package/asterisk14-xip-privacy
$(call Package/asterisk14-xip/Default)
  TITLE:=Call Privacy - Prompt for unknown numbers.
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-privacy/description
$(call Package/asterisk14-xip/Default/description)
Call Privacy - Prompt for unknown numbers.
  app_privacy Prompt for missing calling number
endef

define Package/asterisk14-xip-ivr-util
$(call Package/asterisk14-xip/Default)
  TITLE:=Utilities for creating IVR
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-ivr-util/description
$(call Package/asterisk14-xip/Default/description)
Utilities for creating IVR
  app_read Read a DTMF response
  app_authenticate Authenticate a user
  app_externalivr IVR Using an External process.
  app_disa Directed Inward Sysytem Access - Allow access to your internal dialplan with password
endef


define Package/asterisk14-xip-callerid
$(call Package/asterisk14-xip/Default)
  TITLE:=Callerid related functions.
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-callerid/description
$(call Package/asterisk14-xip/Default/description)
Callerid related functions.
  app_setcallerid
  func_callerid
  app_lookupblacklist
  app_lookupcidname
endef

define Package/asterisk14-xip-speech
$(call Package/asterisk14-xip/Default)
  TITLE:=Interface to Speech recognition programs
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-speech/description
$(call Package/asterisk14-xip/Default/description)
Interface to Speech recognition programs
  app_speech_utils
  res_speech
endef

define Package/asterisk14-xip-detect
$(call Package/asterisk14-xip/Default)
  TITLE:=Detect coditions
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-detect/description
$(call Package/asterisk14-xip/Default/description)
Detect coditions
  app_amd Answer machine detect
  app_talkdetect
  app_waitforring
  app_waitforsilence
endef

define Package/asterisk14-xip-controlflow
$(call Package/asterisk14-xip/Default)
  TITLE:=Advanced Control Flow
  DEPENDS:= +asterisk14-xip-core
endef

define Package/asterisk14-xip-controlflow/description
$(call Package/asterisk14-xip/Default/description)
Advanced Control Flow
  app_while
  app_macro Dialplan Macros
  app_stack Stack routines (Gosub, Return)
endef


CONFIGURE_ARGS+= \
	--without-curl \
	--without-curses \
	--with-gsm="$(STAGING_DIR)/usr" \
	--without-imap \
	--without-isdnnet \
	--without-kde \
	--without-misdn \
	--without-nbs \
	--with-ncurses="$(STAGING_DIR)/usr" \
	--without-netsnmp \
	--without-newt \
	--without-odbc \
	--without-ogg \
	--without-osptk \
	--with-popt="$(STAGING_DIR)/usr" \
	--without-pri \
	--without-qt \
	--without-radius \
	--without-spandsp \
	--without-suppserv \
	--without-tds \
	--without-termcap \
	--without-tinfo \
	--without-vorbis \
	--without-vpb \
	--with-z="$(STAGING_DIR)/usr" \

EXTRA_CFLAGS:= $(TARGET_CPPFLAGS)
EXTRA_LDFLAGS:= $(TARGET_LDFLAGS)

ifneq ($(SDK)$(CONFIG_PACKAGE_asterisk14-xip-app-meetme),)
  CONFIGURE_ARGS+= \
	--with-tonezone="$(STAGING_DIR)/usr" --with-zaptel="$(STAGING_DIR)/usr"
else
  CONFIGURE_ARGS+= \
	--without-tonezone --without-zaptel
endif

ifneq ($(SDK)$(CONFIG_PACKAGE_asterisk14-xip-chan-alsa),)
  CONFIGURE_ARGS+= \
        --with-asound="$(STAGING_DIR)/usr"
else
  CONFIGURE_ARGS+= \
        --without-asound
endif

ifneq ($(SDK)$(CONFIG_PACKAGE_asterisk14-xip-chan-oss),)
  CONFIGURE_ARGS+= \
        --with-oss
else
  CONFIGURE_ARGS+= \
        --without-oss
endif

ifneq ($(SDK)$(CONFIG_PACKAGE_asterisk14-xip-chan-gtalk),)
  CONFIGURE_ARGS+= \
	--with-gnutls="$(STAGING_DIR)/usr" \
	--with-iksemel="$(STAGING_DIR)/usr"
  SITE_VARS+= \
	ac_cv_lib_iksemel_iks_start_sasl=yes \
	ac_cv_lib_gnutls_gnutls_bye=yes
else
  CONFIGURE_ARGS+= \
	--without-gnutls \
	--without-iksemel
endif

ifneq ($(SDK)$(CONFIG_PACKAGE_asterisk14-xip-chan-h323),)
  CONFIGURE_ARGS+= \
	--with-h323="$(BUILD_DIR)/openh323" \
	--with-pwlib="$(BUILD_DIR)/pwlib"
  CONFIGURE_VARS+= \
	LIBS="$$$$LIBS -luClibc++ -ldl -lpthread"

  define Build/Compile/chan-h323
	$(MAKE) -C "$(PKG_BUILD_DIR)/channels/h323" \
		$(TARGET_CONFIGURE_OPTS) \
		CXXLIBS="-nodefaultlibs -luClibc++" \
		optnoshared
  endef
else
  CONFIGURE_ARGS+= \
	--without-h323 \
	--without-pwlib
endif

ifneq ($(SDK)$(CONFIG_PACKAGE_asterisk14-xip-codec-speex),)
  CONFIGURE_ARGS+= \
	--with-speex="$(STAGING_DIR)/usr"
  SITE_VARS+= \
	ac_cv_lib_speex_speex_encode=yes
  EXTRA_CFLAGS+= -I$(STAGING_DIR)/usr/include/speex
else
  CONFIGURE_ARGS+= \
	--without-speex
endif

ifneq ($(SDK)$(CONFIG_PACKAGE_asterisk14-xip-res-crypto),)
  CONFIGURE_ARGS+= \
	--with-ssl="$(STAGING_DIR)/usr"
else
  CONFIGURE_ARGS+= \
	--without-ssl
endif

ifneq ($(SDK)$(CONFIG_PACKAGE_asterisk14-xip-pgsql),)
  CONFIGURE_ARGS+= \
	--with-postgres="$(STAGING_DIR)/usr"
else
  CONFIGURE_ARGS+= \
	--without-postgres
endif

ifneq ($(SDK)$(CONFIG_PACKAGE_asterisk14-xip-sqlite),)
  CONFIGURE_ARGS+= \
	--with-sqlite="$(STAGING_DIR)/usr"
else
  CONFIGURE_ARGS+= \
	--without-sqlite
endif


define Build/Configure
	-rm $(PKG_BUILD_DIR)/menuselect.makeopts
	( cd $(PKG_BUILD_DIR); ./bootstrap.sh )
	$(call Build/Configure/Default,,$(SITE_VARS))
endef

define Build/Compile
	$(MAKE) -C "$(PKG_BUILD_DIR)" \
		include/asterisk/version.h \
		include/asterisk/buildopts.h defaults.h \
		makeopts.embed_rules
	$(call Build/Compile/chan-h323)
	ASTCFLAGS="$(EXTRA_CFLAGS) -DLOW_MEMORY $(TARGET_CFLAGS)" \
	ASTLDFLAGS="$(EXTRA_LDFLAGS)" \
	$(MAKE) -C "$(PKG_BUILD_DIR)" \
		ASTVARLIBDIR="/usr/lib/asterisk" \
		NOISY_BUILD="1" \
		DEBUG="" \
		OPTIMIZE="" \
		DESTDIR="$(PKG_INSTALL_DIR)" \
		all install samples
	$(SED) 's|/var/lib/asterisk|/usr/lib/asterisk|g' $(PKG_INSTALL_DIR)/etc/asterisk/musiconhold.conf

	$(TARGET_CC) -O2 $(PKG_BUILD_DIR)/contrib/utils/rawplayer.c -o $(PKG_BUILD_DIR)/rawplayer
endef

define Build/InstallDev
	mkdir -p $(1)/usr/include/asterisk/
	$(CP) $(PKG_INSTALL_DIR)/usr/include/asterisk/*.h $(1)/usr/include/asterisk/
	$(CP) $(PKG_INSTALL_DIR)/usr/include/asterisk.h $(1)/usr/include/
endef

define Package/asterisk14-xip-core/conffiles
/etc/asterisk/asterisk.conf
/etc/asterisk/codecs.conf
/etc/asterisk/dnsmgr.conf
/etc/asterisk/extconfig.conf
/etc/asterisk/extensions.conf
/etc/asterisk/http.conf
/etc/asterisk/indications.conf
/etc/asterisk/logger.conf
/etc/asterisk/manager.conf
/etc/asterisk/modules.conf
/etc/asterisk/say.conf
/etc/asterisk/sla.conf
/etc/asterisk/users.conf
endef

define Package/asterisk14-xip-core/install
	$(INSTALL_DIR) $(1)/etc/asterisk
	for f in users.conf extensions.conf say.conf asterisk.conf codecs.conf dnsmgr.conf extconfig.conf http.conf indications.conf logger.conf sla.conf manager.conf ; do \
	  $(CP) $(PKG_INSTALL_DIR)/etc/asterisk/$$$$f $(1)/etc/asterisk/ ; \
	done
	$(INSTALL_DATA) ./files/modules.conf $(1)/etc/asterisk/
	$(INSTALL_DIR) $(1)/usr/lib/asterisk
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/keys
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	for f in codec_gsm format_gsm pbx_config res_indications app_dial chan_local ; do \
	  $(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/$$$$f.so $(1)/usr/lib/asterisk/modules/ ; \
	done
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/moh
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/sounds
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/sbin/asterisk $(1)/usr/sbin/
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/sbin/safe_asterisk $(1)/usr/sbin/
	$(INSTALL_DIR) $(1)/etc/default
	$(INSTALL_DATA)  ./files/asterisk.default $(1)/etc/default/asterisk
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN)  ./files/asterisk.init $(1)/etc/init.d/asterisk
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/uci
	$(CP) ./files/uci/* $1/usr/lib/asterisk/uci
	$(INSTALL_DIR) $(1)/etc/asterisk/macros
	$(CP) ./files/macros/* $1/etc/asterisk/macros
endef

define Package/asterisk14-xip-core/postinst
#!/bin/sh
if [ -z "${IPKG_INSTROOT}" ] ; then
  ROOT=/
else
  ROOT=`echo $${PKG_ROOT} | sed 's:[\/]:\\\&:g' -`
fi
/bin/sed -i 's/\ \/etc/\ '$${ROOT}'etc/g' $${PKG_ROOT}/etc/asterisk/asterisk.conf
/bin/sed -i 's/\ \/var\/spool/\ '$${ROOT}'var\/spool/g' $${PKG_ROOT}/etc/asterisk/asterisk.conf
/bin/sed -i 's/\ \/var\/log/\ '$${ROOT}'var\/log/g' $${PKG_ROOT}/etc/asterisk/asterisk.conf
/bin/sed -i 's/\ \/usr/\ '$${ROOT}'usr/g' $${PKG_ROOT}/etc/asterisk/asterisk.conf
/bin/sed -i 's/^DEST=/DEST='$${ROOT}'/g' $${PKG_ROOT}/etc/init.d/asterisk
/bin/sed -i 's/OPTIONS=\"\"/OPTIONS=\"-C\ '$${ROOT}'etc\/asterisk\/asterisk.conf\"/g' $${PKG_ROOT}/etc/default/asterisk
mkdir -p $${PKG_ROOT}/etc/asterisk/conf.d
cd $${PKG_ROOT}/etc/asterisk/conf.d
ln -s ../../../usr/lib/asterisk/uci/voicemailconf 10-voicemail
ln -s ../../../usr/lib/asterisk/uci/mohconf       15-moh
ln -s ../../../usr/lib/asterisk/uci/featureconf   20-features
ln -s ../../../usr/lib/asterisk/uci/lastcall      25-lastcall
ln -s ../../../usr/lib/asterisk/uci/meetmeconf    30-meetme
ln -s ../../../usr/lib/asterisk/uci/sipiaxconf    35-sipiax
ln -s ../../../usr/lib/asterisk/uci/talkclock     40-talkclock
ln -s ../../../usr/lib/asterisk/uci/voicemenu     45-voicemenu
ln -s ../../../usr/lib/asterisk/uci/disaconf      50-disaconf
endef

define Package/asterisk14-xip/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk
endef

define Package/asterisk14-xip-mini/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk
endef

define Package/asterisk14-xip-app-meetme/conffiles
/etc/asterisk/meetme.conf
endef

define Package/asterisk14-xip-app-meetme/install
	$(INSTALL_DIR) $(1)/etc/asterisk
	$(INSTALL_DATA) $(PKG_INSTALL_DIR)/etc/asterisk/meetme.conf $(1)/etc/asterisk/
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	for f in app_meetme app_page ; do \
	  $(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/$$$$f.so $(1)/usr/lib/asterisk/modules/ ; \
	done
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/sounds
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/sounds/conf-* $(1)/usr/lib/asterisk/sounds/
endef


define Package/asterisk14-xip-chan-oss/conffiles
/etc/asterisk/oss.conf
endef

define Package/asterisk14-xip-chan-oss/install
	$(INSTALL_DIR) $(1)/etc/asterisk
	$(INSTALL_DATA) $(PKG_INSTALL_DIR)/etc/asterisk/oss.conf $(1)/etc/asterisk/
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/chan_oss.so $(1)/usr/lib/asterisk/modules/
endef


define Package/asterisk14-xip-app-meetme/conffiles
/etc/asterisk/meetme.conf
endef

define Package/asterisk14-xip-app-meetme/install
	$(INSTALL_DIR) $(1)/etc/asterisk
	$(INSTALL_DATA) $(PKG_INSTALL_DIR)/etc/asterisk/meetme.conf $(1)/etc/asterisk/
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/app_meetme.so $(1)/usr/lib/asterisk/modules/
endef


define Package/asterisk14-xip-chan-oss/conffiles
/etc/asterisk/oss.conf
endef

define Package/asterisk14-xip-chan-oss/install
	$(INSTALL_DIR) $(1)/etc/asterisk
	$(INSTALL_DATA) $(PKG_INSTALL_DIR)/etc/asterisk/oss.conf $(1)/etc/asterisk/
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/chan_oss.so $(1)/usr/lib/asterisk/modules/
endef


define Package/asterisk14-xip-chan-alsa/conffiles
/etc/asterisk/alsa.conf
endef

define Package/asterisk14-xip-chan-alsa/install
	$(INSTALL_DIR) $(1)/etc/asterisk
	$(INSTALL_DATA) $(PKG_INSTALL_DIR)/etc/asterisk/alsa.conf $(1)/etc/asterisk/
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/chan_alsa.so $(1)/usr/lib/asterisk/modules/
endef


define Package/asterisk14-xip-chan-gtalk/conffiles
/etc/asterisk/gtalk.conf
/etc/asterisk/jabber.conf
endef

define Package/asterisk14-xip-chan-gtalk/install
	$(INSTALL_DIR) $(1)/etc/asterisk
	$(INSTALL_DATA) $(PKG_INSTALL_DIR)/etc/asterisk/gtalk.conf $(1)/etc/asterisk/
	$(INSTALL_DATA) $(PKG_INSTALL_DIR)/etc/asterisk/jabber.conf $(1)/etc/asterisk/
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/chan_gtalk.so $(1)/usr/lib/asterisk/modules/
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/res_jabber.so $(1)/usr/lib/asterisk/modules/
endef


define Package/asterisk14-xip-chan-h323/conffiles
/etc/asterisk/h323.conf
endef

define Package/asterisk14-xip-chan-h323/install
	$(INSTALL_DIR) $(1)/etc/asterisk
	$(INSTALL_DATA) $(PKG_INSTALL_DIR)/etc/asterisk/h323.conf $(1)/etc/asterisk/
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/chan_h323.so $(1)/usr/lib/asterisk/modules/
endef


define Package/asterisk14-xip-chan-mgcp/install
/etc/asterisk/mgcp.conf
endef

define Package/asterisk14-xip-chan-mgcp/install
	$(INSTALL_DIR) $(1)/etc/asterisk
	$(INSTALL_DATA) $(PKG_INSTALL_DIR)/etc/asterisk/mgcp.conf $(1)/etc/asterisk/
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/chan_mgcp.so $(1)/usr/lib/asterisk/modules/
endef


define Package/asterisk14-xip-chan-skinny/conffiles
/etc/asterisk/skinny.conf
endef

define Package/asterisk14-xip-chan-skinny/install
	$(INSTALL_DIR) $(1)/etc/asterisk
	$(INSTALL_DATA) $(PKG_INSTALL_DIR)/etc/asterisk/skinny.conf $(1)/etc/asterisk/
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/chan_skinny.so $(1)/usr/lib/asterisk/modules/
endef


#define Package/asterisk14-xip-codec-ilbc/install
#	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
#	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/codec_ilbc.so $(1)/usr/lib/asterisk/modules/
#	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/format_ilbc.so $(1)/usr/lib/asterisk/modules/
#endef


define Package/asterisk14-xip-codec-lpc10/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/codec_lpc10.so $(1)/usr/lib/asterisk/modules/
endef


define Package/asterisk14-xip-codec-speex/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/codec_speex.so $(1)/usr/lib/asterisk/modules/
endef


define Package/asterisk14-xip-pbx-dundi/conffiles
/etc/asterisk/dundi.conf
endef

define Package/asterisk14-xip-pbx-dundi/install
	$(INSTALL_DIR) $(1)/etc/asterisk
	$(INSTALL_DATA) $(PKG_INSTALL_DIR)/etc/asterisk/dundi.conf $(1)/etc/asterisk/
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/pbx_dundi.so $(1)/usr/lib/asterisk/modules/
endef


define Package/asterisk14-xip-res-agi/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/agi-bin
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/res_agi.so $(1)/usr/lib/asterisk/modules/
endef


define Package/asterisk14-xip-res-crypto/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/res_crypto.so $(1)/usr/lib/asterisk/modules/
endef


define Package/asterisk14-xip-pgsql/conffiles
/etc/asterisk/cdr_pgsql.conf
/etc/asterisk/res_pgsql.conf
endef

define Package/asterisk14-xip-pgsql/install
	$(INSTALL_DIR) $(1)/etc/asterisk
	install -m0600 $(PKG_INSTALL_DIR)/etc/asterisk/cdr_pgsql.conf $(1)/etc/asterisk/
	install -m0600 $(PKG_INSTALL_DIR)/etc/asterisk/res_pgsql.conf $(1)/etc/asterisk/
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/cdr_pgsql.so $(1)/usr/lib/asterisk/modules/
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/res_config_pgsql.so $(1)/usr/lib/asterisk/modules/
endef


define Package/asterisk14-xip-sqlite/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/cdr_sqlite.so $(1)/usr/lib/asterisk/modules/
endef

define Package/asterisk14-xip-sounds/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/sounds
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/sounds/* $(1)/usr/lib/asterisk/sounds/
	rm -f $(1)/usr/lib/asterisk/sounds/vm-*
	rm -f $(1)/usr/lib/asterisk/sounds/x
	rm -f $(1)/usr/lib/asterisk/sounds/dir-*
	rm -f $(1)/usr/lib/asterisk/sounds/dictate/*
	rm -f $(1)/usr/lib/asterisk/sounds/followme/*
	rm -f $(1)/usr/lib/asterisk/sounds/conf-*
	rm -f $(1)/usr/lib/asterisk/sounds/queue-*
	rm -f $(1)/usr/lib/asterisk/sounds/priv*
	rm -f $(1)/usr/lib/asterisk/sounds/auth-*
	rm -f $(1)/usr/lib/asterisk/sounds/agent-*
	rm -f $(1)/usr/lib/asterisk/sounds/tt-*
	rm -f $(1)/usr/lib/asterisk/sounds/demo-*
endef

define Package/asterisk14-xip-voicemail/conffiles
/etc/asterisk/voicemail.conf
endef

define Package/asterisk14-xip-voicemail/install
	$(INSTALL_DIR) $(1)/etc/asterisk
	$(INSTALL_DATA) $(PKG_INSTALL_DIR)/etc/asterisk/voicemail.conf $(1)/etc/asterisk/
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/*voicemail.so $(1)/usr/lib/asterisk/modules/
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/sounds
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/sounds/vm-*.gsm $(1)/usr/lib/asterisk/sounds/
endef

define Package/asterisk14-xip-rawplayer/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN)	$(PKG_BUILD_DIR)/rawplayer \
			$(1)/usr/bin
endef

define Package/asterisk14-xip-agents/conffiles
/etc/asterisk/agents.conf
endef

define Package/asterisk14-xip-agents/install
	$(INSTALL_DIR) $(1)/etc/asterisk
	$(INSTALL_DATA) $(PKG_INSTALL_DIR)/etc/asterisk/agents.conf $(1)/etc/asterisk/
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/chan_agent.so $(1)/usr/lib/asterisk/modules/
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/sounds
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/sounds/agent-* $(1)/usr/lib/asterisk/sounds/
endef

define Package/asterisk14-xip-iax/conffiles
/etc/asterisk/iax.conf
/etc/asterisk/iaxprov.conf
endef

define Package/asterisk14-xip-iax/install
	$(INSTALL_DIR) $(1)/etc/asterisk
	for f in iax.conf iaxprov.conf ; do \
	  $(CP) $(PKG_INSTALL_DIR)/etc/asterisk/$$$$f $(1)/etc/asterisk/ ; \
	done
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/chan_iax2.so $(1)/usr/lib/asterisk/modules/
endef

define Package/asterisk14-xip-sip/conffiles
/etc/asterisk/sip.conf
/etc/asterisk/sip_notify.conf
/etc/asterisk/rtp.conf
/etc/asterisk/udptl.conf
endef

define Package/asterisk14-xip-sip/install
	$(INSTALL_DIR) $(1)/etc/asterisk
	for f in sip.conf sip_notify.conf rtp.conf udptl.conf ; do \
	  $(CP) $(PKG_INSTALL_DIR)/etc/asterisk/$$$$f $(1)/etc/asterisk/ ; \
	done
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/chan_sip.so $(1)/usr/lib/asterisk/modules/
endef

define Package/asterisk14-xip-codec-wav/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	for f in codec_adpcm format_pcm format_wav_gsm format_wav ; do \
	  $(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/$$$$f.so $(1)/usr/lib/asterisk/modules/ ; \
	done
endef

define Package/asterisk14-xip-codec-ualaw/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	for f in codec_alaw codec_a_mu codec_ulaw ; do \
	  $(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/$$$$f.so $(1)/usr/lib/asterisk/modules/ ; \
	done
endef

define Package/asterisk14-xip-format-misc/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	for f in format_sln format_vox format_ilbc ; do \
	  $(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/$$$$f.so $(1)/usr/lib/asterisk/modules/ ; \
	done
endef

define Package/asterisk14-xip-format-licensed/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	for f in format_g726 format_g723 format_g729 ; do \
	  $(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/$$$$f.so $(1)/usr/lib/asterisk/modules/ ; \
	done
endef

define Package/asterisk14-xip-codec-g726/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/codec_g726.so $(1)/usr/lib/asterisk/modules/
endef

define Package/asterisk14-xip-format-video/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	for f in format_h263 format_h264 ; do \
	  $(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/$$$$f.so $(1)/usr/lib/asterisk/modules/ ; \
	done
endef

define Package/asterisk14-xip-variables/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	for f in func_db func_global func_env func_timeout ; do \
	  $(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/$$$$f.so $(1)/usr/lib/asterisk/modules/ ; \
	done
endef

define Package/asterisk14-xip-enum/conffiles
/etc/asterisk/enum.conf
endef

define Package/asterisk14-xip-enum/install
	$(INSTALL_DIR) $(1)/etc/asterisk
	$(INSTALL_DATA) $(PKG_INSTALL_DIR)/etc/asterisk/enum.conf $(1)/etc/asterisk/
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/func_enum.so $(1)/usr/lib/asterisk/modules/
endef

define Package/asterisk14-xip-basic/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	for f in func_logic func_math func_strings func_rand func_cut ; do \
	  $(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/$$$$f.so $(1)/usr/lib/asterisk/modules/ ; \
	done
endef

define Package/asterisk14-xip-encode/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	for f in func_base64 func_md5 func_sha1 func_uri ; do \
	  $(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/$$$$f.so $(1)/usr/lib/asterisk/modules/ ; \
	done
endef

define Package/asterisk14-xip-realtime/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	for f in func_realtime pbx_realtime app_realtime ; do \
	  $(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/$$$$f.so $(1)/usr/lib/asterisk/modules/ ; \
	done
endef

define Package/asterisk14-xip-ael/conffiles
/etc/asterisk/extensions.ael
endef

define Package/asterisk14-xip-ael/install
	$(INSTALL_DIR) $(1)/etc/asterisk
	$(INSTALL_DATA) $(PKG_INSTALL_DIR)/etc/asterisk/extensions.ael $(1)/etc/asterisk/
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/pbx_ael.so $(1)/usr/lib/asterisk/modules/
	$(INSTALL_DIR) $(1)/usr/sbin
	$(CP) $(PKG_INSTALL_DIR)/usr/sbin/aelparse $(1)/usr/sbin/
endef

define Package/asterisk14-xip-adsi/conffiles
/etc/asterisk/adsi.conf
endef

define Package/asterisk14-xip-adsi/install
	$(INSTALL_DIR) $(1)/etc/asterisk
	$(INSTALL_DATA) $(PKG_INSTALL_DIR)/etc/asterisk/adsi.conf $(1)/etc/asterisk/
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	for f in res_adsi app_adsiprog ; do \
	  $(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/$$$$f.so $(1)/usr/lib/asterisk/modules/ ; \
	done
endef

define Package/asterisk14-xip-features/conffiles
/etc/asterisk/features.conf
endef

define Package/asterisk14-xip-features/install
	$(INSTALL_DIR) $(1)/etc/asterisk
	$(INSTALL_DATA) $(PKG_INSTALL_DIR)/etc/asterisk/features.conf $(1)/etc/asterisk/
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	for f in res_features app_transfer app_parkandannounce res_monitor ; do \
	  $(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/$$$$f.so $(1)/usr/lib/asterisk/modules/ ; \
	done
endef

define Package/asterisk14-xip-moh/conffiles
/etc/asterisk/musiconhold.conf
endef

define Package/asterisk14-xip-moh/install
	$(INSTALL_DIR) $(1)/etc/asterisk
	$(INSTALL_DATA) $(PKG_INSTALL_DIR)/etc/asterisk/musiconhold.conf $(1)/etc/asterisk/
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	for f in res_musiconhold func_moh ; do \
	  $(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/$$$$f.so $(1)/usr/lib/asterisk/modules/ ; \
	done
	$(INSTALL_DIR) $(1)/usr/sbin
	$(CP) $(PKG_INSTALL_DIR)/usr/sbin/streamplayer $(1)/usr/sbin/
endef

define Package/asterisk14-xip-smdi/conffiles
/etc/asterisk/smdi.conf
endef

define Package/asterisk14-xip-smdi/install
	$(INSTALL_DIR) $(1)/etc/asterisk
	$(INSTALL_DATA) $(PKG_INSTALL_DIR)/etc/asterisk/smdi.conf $(1)/etc/asterisk/
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/res_smdi.so $(1)/usr/lib/asterisk/modules/
endef

define Package/asterisk14-xip-sounds-tt/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/sounds
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/sounds/tt-* $(1)/usr/lib/asterisk/sounds/
endef

define Package/asterisk14-xip-sounds-demo/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/sounds
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/sounds/demo-* $(1)/usr/lib/asterisk/sounds/
endef

define Package/asterisk14-xip-linejack/conffiles
/etc/asterisk/phone.conf
endef

define Package/asterisk14-xip-linejack/install
	$(INSTALL_DIR) $(1)/etc/asterisk
	$(INSTALL_DATA) $(PKG_INSTALL_DIR)/etc/asterisk/phone.conf $(1)/etc/asterisk/
endef

define Package/asterisk14-xip-app-misc/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	for f in app_random app_sayunixtime app_sendtext app_url app_readfile app_system app_exec ; do \
	  $(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/$$$$f.so $(1)/usr/lib/asterisk/modules/ ; \
	done
endef

define Package/asterisk14-xip-image/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	for f in app_image format_jpeg ; do \
	  $(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/$$$$f.so $(1)/usr/lib/asterisk/modules/ ; \
	done
endef

define Package/asterisk14-xip-sms/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/app_sms.so $(1)/usr/lib/asterisk/modules/
	$(INSTALL_DIR) $(1)/usr/sbin
	$(CP) $(PKG_INSTALL_DIR)/usr/sbin/smsq $(1)/usr/sbin/
endef

define Package/asterisk14-xip-icecast/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/app_ices.so $(1)/usr/lib/asterisk/modules/
endef

define Package/asterisk14-xip-mp3/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/app_mp3.so $(1)/usr/lib/asterisk/modules/
endef

define Package/asterisk14-xip-cli/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	for f in app_userevent res_clioriginate res_convert ; do \
	  $(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/$$$$f.so $(1)/usr/lib/asterisk/modules/ ; \
	done
endef

define Package/asterisk14-xip-isdn/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/app_settransfercapability.so $(1)/usr/lib/asterisk/modules/
endef

define Package/asterisk14-xip-deprecated/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/app_db.so $(1)/usr/lib/asterisk/modules/
endef

define Package/asterisk14-xip-groups/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/func_groupcount.so $(1)/usr/lib/asterisk/modules/
endef

define Package/asterisk14-xip-language/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/func_language.so $(1)/usr/lib/asterisk/modules/
endef

define Package/asterisk14-xip-spool/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/pbx_spool.so $(1)/usr/lib/asterisk/modules/
endef

define Package/asterisk14-xip-nbs/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/app_nbscat.so $(1)/usr/lib/asterisk/modules/
endef

define Package/asterisk14-xip-alarmreceiver/conffiles
/etc/asterisk/alarmreceiver.conf
endef

define Package/asterisk14-xip-alarmreceiver/install
	$(INSTALL_DIR) $(1)/etc/asterisk
	$(INSTALL_DATA) $(PKG_INSTALL_DIR)/etc/asterisk/alarmreceiver.conf $(1)/etc/asterisk/
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/app_alarmreceiver.so $(1)/usr/lib/asterisk/modules/
endef

define Package/asterisk14-xip-cdr/conffiles
/etc/asterisk/cdr.conf
/etc/asterisk/cdr_custom.conf
/etc/asterisk/cdr_manager.conf
endef

define Package/asterisk14-xip-cdr/install
	$(INSTALL_DIR) $(1)/etc/asterisk
	for f in cdr.conf cdr_custom.conf cdr_manager.conf ; do \
	  $(CP) $(PKG_INSTALL_DIR)/etc/asterisk/$$$$f $(1)/etc/asterisk/ ; \
	done
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	for f in app_cdr app_forkcdr app_setcdruserfield cdr_csv cdr_custom cdr_manager func_cdr ; do \
	  $(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/$$$$f.so $(1)/usr/lib/asterisk/modules/ ; \
	done
endef

define Package/asterisk14-xip-channel/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	for f in app_chanisavail app_channelredirect app_chanspy func_channel app_softhangup app_directed_pickup app_pickup2 ; do \
	  $(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/$$$$f.so $(1)/usr/lib/asterisk/modules/ ; \
	done
endef

define Package/asterisk14-xip-debug/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	for f in app_echo pbx_loopback app_dumpchan app_verbose app_test ; do \
	  $(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/$$$$f.so $(1)/usr/lib/asterisk/modules/ ; \
	done
endef

define Package/asterisk14-xip-menu-misc/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	for f in app_controlplayback app_directory app_dictate ; do \
	  $(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/$$$$f.so $(1)/usr/lib/asterisk/modules/ ; \
	done
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/sounds
	for f in dir-* dictate/* ; do \
	  $(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/sounds/$$$$f $(1)/usr/lib/asterisk/sounds/ ; \
	done
endef

define Package/asterisk14-xip-festival/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/app_festival.so $(1)/usr/lib/asterisk/modules/
endef

define Package/asterisk14-xip-send-app/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	for f in app_flash app_senddtmf app_milliwatt app_morsecode app_zapateller ; do \
	  $(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/$$$$f.so $(1)/usr/lib/asterisk/modules/ ; \
	done
endef

define Package/asterisk14-xip-followme/conffiles
/etc/asterisk/followme.conf
endef

define Package/asterisk14-xip-followme/install
	$(INSTALL_DIR) $(1)/etc/asterisk
	$(INSTALL_DATA) $(PKG_INSTALL_DIR)/etc/asterisk/followme.conf $(1)/etc/asterisk/
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/app_followme.so $(1)/usr/lib/asterisk/modules/
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/sounds
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/sounds/followme/* $(1)/usr/lib/asterisk/sounds/
endef

define Package/asterisk14-xip-queues/conffiles
/etc/asterisk/queues.conf
endef

define Package/asterisk14-xip-queues/install
	$(INSTALL_DIR) $(1)/etc/asterisk
	$(INSTALL_DATA) $(PKG_INSTALL_DIR)/etc/asterisk/queues.conf $(1)/etc/asterisk/
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/app_queue.so $(1)/usr/lib/asterisk/modules/
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/sounds
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/sounds/queue-* $(1)/usr/lib/asterisk/sounds/
endef

define Package/asterisk14-xip-record/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	for f in app_record app_mixmonitor ; do \
	  $(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/$$$$f.so $(1)/usr/lib/asterisk/modules/ ; \
	done
endef

define Package/asterisk14-xip-privacy/conffiles
/etc/asterisk/privacy.conf
endef

define Package/asterisk14-xip-privacy/install
	$(INSTALL_DIR) $(1)/etc/asterisk
	$(INSTALL_DATA) $(PKG_INSTALL_DIR)/etc/asterisk/privacy.conf $(1)/etc/asterisk/
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/app_privacy.so $(1)/usr/lib/asterisk/modules/
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/sounds
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/sounds/priv* $(1)/usr/lib/asterisk/sounds/
endef

define Package/asterisk14-xip-ivr-util/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	for f in app_read app_authenticate app_externalivr app_disa ; do \
	  $(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/$$$$f.so $(1)/usr/lib/asterisk/modules/ ; \
	done
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/sounds
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/sounds/auth-* $(1)/usr/lib/asterisk/sounds/
endef

define Package/asterisk14-xip-callerid/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	for f in app_setcallerid func_callerid app_lookupblacklist app_lookupcidname ; do \
	  $(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/$$$$f.so $(1)/usr/lib/asterisk/modules/ ; \
	done
endef

define Package/asterisk14-xip-speech/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	for f in app_speech_utils res_speech ; do \
	  $(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/$$$$f.so $(1)/usr/lib/asterisk/modules/ ; \
	done
endef

define Package/asterisk14-xip-detect/conffiles
/etc/asterisk/amd.conf
endef

define Package/asterisk14-xip-detect/install
	$(INSTALL_DIR) $(1)/etc/asterisk
	$(INSTALL_DATA) $(PKG_INSTALL_DIR)/etc/asterisk/amd.conf $(1)/etc/asterisk/
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	for f in app_amd app_talkdetect app_waitforring app_waitforsilence ; do \
	  $(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/$$$$f.so $(1)/usr/lib/asterisk/modules/ ; \
	done
endef

define Package/asterisk14-xip-controlflow/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	for f in app_while app_macro app_stack ; do \
	  $(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/$$$$f.so $(1)/usr/lib/asterisk/modules/ ; \
	done
endef

define Package/asterisk14-xip-zaptel/install
	$(INSTALL_DIR) $(1)/usr/lib/asterisk/modules
	for f in chan_zap app_zapbarge app_zapscan codec_zap app_getcpeid app_zapras ; do \
	  $(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/modules/$$$$f.so $(1)/usr/lib/asterisk/modules/ ; \
	done
	$(INSTALL_DIR) $(1)/usr/lib/asterisk
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/asterisk/firmware $(1)/usr/lib/asterisk/
endef

$(eval $(call BuildPackage,asterisk14-xip-core))
$(eval $(call BuildPackage,asterisk14-xip))
$(eval $(call BuildPackage,asterisk14-xip-mini))
$(eval $(call BuildPackage,asterisk14-xip-app-meetme))
$(eval $(call BuildPackage,asterisk14-xip-chan-oss))
$(eval $(call BuildPackage,asterisk14-xip-chan-alsa))
$(eval $(call BuildPackage,asterisk14-xip-chan-gtalk))
$(eval $(call BuildPackage,asterisk14-xip-chan-h323))
$(eval $(call BuildPackage,asterisk14-xip-chan-mgcp))
$(eval $(call BuildPackage,asterisk14-xip-chan-skinny))
#$(eval $(call BuildPackage,asterisk14-xip-codec-ilbc))
$(eval $(call BuildPackage,asterisk14-xip-codec-lpc10))
$(eval $(call BuildPackage,asterisk14-xip-codec-speex))
$(eval $(call BuildPackage,asterisk14-xip-pbx-dundi))
$(eval $(call BuildPackage,asterisk14-xip-res-agi))
$(eval $(call BuildPackage,asterisk14-xip-res-crypto))
$(eval $(call BuildPackage,asterisk14-xip-pgsql))
$(eval $(call BuildPackage,asterisk14-xip-sqlite))
$(eval $(call BuildPackage,asterisk14-xip-voicemail))
$(eval $(call BuildPackage,asterisk14-xip-sounds))
$(eval $(call BuildPackage,asterisk14-xip-rawplayer))
$(eval $(call BuildPackage,asterisk14-xip-agents))
$(eval $(call BuildPackage,asterisk14-xip-iax))
$(eval $(call BuildPackage,asterisk14-xip-sip))
$(eval $(call BuildPackage,asterisk14-xip-codec-wav))
$(eval $(call BuildPackage,asterisk14-xip-codec-ualaw))
$(eval $(call BuildPackage,asterisk14-xip-format-misc))
$(eval $(call BuildPackage,asterisk14-xip-format-licensed))
$(eval $(call BuildPackage,asterisk14-xip-codec-g726))
$(eval $(call BuildPackage,asterisk14-xip-format-video))
$(eval $(call BuildPackage,asterisk14-xip-variables))
$(eval $(call BuildPackage,asterisk14-xip-enum))
$(eval $(call BuildPackage,asterisk14-xip-basic))
$(eval $(call BuildPackage,asterisk14-xip-encode))
$(eval $(call BuildPackage,asterisk14-xip-realtime))
$(eval $(call BuildPackage,asterisk14-xip-ael))
$(eval $(call BuildPackage,asterisk14-xip-adsi))
$(eval $(call BuildPackage,asterisk14-xip-features))
$(eval $(call BuildPackage,asterisk14-xip-moh))
$(eval $(call BuildPackage,asterisk14-xip-smdi))
$(eval $(call BuildPackage,asterisk14-xip-sounds-tt))
$(eval $(call BuildPackage,asterisk14-xip-sounds-demo))
$(eval $(call BuildPackage,asterisk14-xip-linejack))
$(eval $(call BuildPackage,asterisk14-xip-app-misc))
$(eval $(call BuildPackage,asterisk14-xip-image))
$(eval $(call BuildPackage,asterisk14-xip-sms))
$(eval $(call BuildPackage,asterisk14-xip-icecast))
$(eval $(call BuildPackage,asterisk14-xip-mp3))
$(eval $(call BuildPackage,asterisk14-xip-cli))
$(eval $(call BuildPackage,asterisk14-xip-isdn))
$(eval $(call BuildPackage,asterisk14-xip-deprecated))
$(eval $(call BuildPackage,asterisk14-xip-groups))
$(eval $(call BuildPackage,asterisk14-xip-language))
$(eval $(call BuildPackage,asterisk14-xip-spool))
$(eval $(call BuildPackage,asterisk14-xip-nbs))
$(eval $(call BuildPackage,asterisk14-xip-alarmreceiver))
$(eval $(call BuildPackage,asterisk14-xip-cdr))
$(eval $(call BuildPackage,asterisk14-xip-channel))
$(eval $(call BuildPackage,asterisk14-xip-debug))
$(eval $(call BuildPackage,asterisk14-xip-menu-misc))
$(eval $(call BuildPackage,asterisk14-xip-festival))
$(eval $(call BuildPackage,asterisk14-xip-send-app))
$(eval $(call BuildPackage,asterisk14-xip-followme))
$(eval $(call BuildPackage,asterisk14-xip-queues))
$(eval $(call BuildPackage,asterisk14-xip-record))
$(eval $(call BuildPackage,asterisk14-xip-privacy))
$(eval $(call BuildPackage,asterisk14-xip-ivr-util))
$(eval $(call BuildPackage,asterisk14-xip-callerid))
$(eval $(call BuildPackage,asterisk14-xip-speech))
$(eval $(call BuildPackage,asterisk14-xip-detect))
$(eval $(call BuildPackage,asterisk14-xip-controlflow))


#asterisk14-xip-core=codec_gsm format_gsm pbx_config res_indications app_dial chan_local
#asterisk14-xip-agents=chan_agent
#asterisk14-xip-iax=chan_iax2
#asterisk14-xip-sip=chan_sip
#asterisk14-xip-codec-wav=codec_adpcm format_pcm format_wav_gsm format_wav
#asterisk14-xip-codec-ualaw=codec_alaw codec_a_mu codec_ulaw
#asterisk14-xip-format-misc=format_sln format_vox format_ilbc
#asterisk14-xip-format-licensed=format_g726 format_g723 format_g729
#asterisk14-xip-codec-g726=codec_g726
#asterisk14-xip-format-video=format_h263 format_h264
#asterisk14-xip-variables=func_db func_global func_env func_timeout
#asterisk14-xip-enum=func_enum
#asterisk14-xip-pbx-dundi=pbx_dundi
#asterisk14-xip-basic=func_logic func_math func_strings func_rand func_cut
#asterisk14-xip-encode=func_base64 func_md5 func_sha1 func_uri
#asterisk14-xip-realtime=func_realtime pbx_realtime app_realtime
#asterisk14-xip-ael=pbx_ael
#asterisk14-xip-adsi=res_adsi app_adsiprog
#asterisk14-xip-features=res_features app_transfer app_parkandannounce res_monitor
#asterisk14-xip-moh=res_musiconhold func_moh
#asterisk14-xip-smdi=res_smdi
#asterisk14-xip-app-misc=app_random app_sayunixtime app_sendtext app_url app_readfile app_system app_exec
#asterisk14-xip-image=app_image format_jpeg
#asterisk14-xip-sms=app_sms
#asterisk14-xip-icecast=app_ices
#asterisk14-xip-mp3=app_mp3
#asterisk14-xip-cli=app_userevent res_clioriginate res_convert
#asterisk14-xip-isdn=app_settransfercapability
#asterisk14-xip-deprecated=app_db
#asterisk14-xip-groups=func_groupcount
#asterisk14-xip-language=func_language
#asterisk14-xip-spool=pbx_spool
#asterisk14-xip-nbs=app_nbscat
#asterisk14-xip-alarmreceiver=app_alarmreceiver
#asterisk14-xip-cdr=app_cdr app_forkcdr app_setcdruserfield cdr_csv cdr_custom cdr_manager func_cdr
#asterisk14-xip-channel=app_chanisavail app_channelredirect app_chanspy func_channel app_softhangup app_directed_pickup
#asterisk14-xip-debug=app_echo pbx_loopback app_dumpchan app_verbose app_test
#asterisk14-xip-menu-misc=app_controlplayback app_directory app_dictate
#asterisk14-xip-festival=app_festival
#asterisk14-xip-send-app=app_flash app_senddtmf app_milliwatt app_morsecode app_zapateller
#asterisk14-xip-followme=app_followme
#asterisk14-xip-app-meetme=app_meetme app_page
#asterisk14-xip-queues=app_queue
#asterisk14-xip-record=app_record app_mixmonitor
#asterisk14-xip-privacy=app_privacy
#asterisk14-xip-ivr-util=app_read app_authenticate app_externalivr app_disa
#asterisk14-xip-callerid=app_setcallerid func_callerid app_lookupblacklist app_lookupcidname
#asterisk14-xip-speech=app_speech_utils res_speech
#asterisk14-xip-detect=app_amd app_talkdetect app_waitforring app_waitforsilence
#asterisk14-xip-controlflow=app_while app_macro app_stack
#asterisk14-xip-zaptel=chan_zap app_zapbarge app_zapscan codec_zap app_getcpeid app_zapras
#asterisk14-xip-chan-oss=chan_oss
#asterisk14-xip-chan-alsa=chan_alsa
#asterisk14-xip-chan-gtalk=chan_gtalk res_jabber
#asterisk14-xip-chan-h323=chan_h323
#asterisk14-xip-chan-mgcp=chan_mgcp
#asterisk14-xip-chan-skinny=chan_skinny
#asterisk14-xip-chan-lpc10=chan_lpc10
#asterisk14-xip-codec-speex=codec_speex
#asterisk14-xip-res-agi=res_agi
#asterisk14-xip-res-crypto=res_crypto
#asterisk14-xip-pgsql=cdr_pgsql res_config_pgsql
#asterisk14-xip-sqlite=cdr_sqlite
#asterisk14-xip-voicemail=app_hasnewvoicemail app_voicemail
