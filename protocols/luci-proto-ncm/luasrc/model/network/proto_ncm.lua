-- Copyright 2016 Joerg Schueler-Maroldt <schueler.maroldt@gmail.com>
-- Licensed to the public under the Apache License 2.0.

local proto = luci.model.network:register_protocol("ncm")

function proto.get_i18n(self)
	return luci.i18n.translate("NCM Network")
end

function proto.is_installed(self)
	return nixio.fs.access("/lib/netifd/proto/ncm.sh")
end

function proto.opkg_package(self)
	return "comgt-ncm"
end
