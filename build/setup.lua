            local SYSROOT = os.getenv("LUCI_SYSROOT")
            require "uci"
            require "luci.model.uci".cursor = function(config, save)
                    return uci.cursor(config or SYSROOT .. "/etc/config", save or SYSROOT .. "/tmp/.uci")
            end

            local x = require "luci.uvl".UVL.__init__
            require "luci.uvl".UVL.__init__ = function(self, schemedir)
                    x(self, schemedir or SYSROOT .. "/lib/uci/schema")
            end

