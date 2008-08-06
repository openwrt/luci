--[[
LuCI - Iptables parser and query library

Copyright 2008 Jo-Philipp Wich <freifunk@wwsnet.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

$Id$

]]--

module("luci.sys.iptparser", package.seeall)
require("luci.util")


IptParser = luci.util.class()

--[[
IptParser.__init__( ... )

The class constructor, initializes the internal lookup table.
]]--

function IptParser.__init__( self, ... )
	self._rules = { }
	self._chain = nil
	self:_parse_rules()
end


--[[
IptParser.find( args )

Find all firewall rules that match the given criteria. Expects a table with search criteria as only argument.
If args is nil or an empty table then all rules will be returned.

The following keys in the args table are recognized:

 - table	Match rules that are located within the given table
 - chain	Match rules that are located within the given chain
 - target	Match rules with the given target
 - protocol	Match rules that match the given protocol, rules with protocol "all" are always matched
 - source	Match rules with the given source, rules with source "0.0.0.0/0" are always matched
 - destination	Match rules with the given destination, rules with destination "0.0.0.0/0" are always matched
 - inputif	Match rules with the given input interface, rules with input interface "*" (=all) are always matched
 - outputif	Match rules with the given output interface, rules with output interface "*" (=all) are always matched
 - flags	Match rules that match the given flags, current supported values are "-f" (--fragment) and "!f" (! --fragment)
 - options	Match rules containing all given options

The return value is a list of tables representing the matched rules.
Each rule table contains the following fields:

 - index	The index number of the rule
 - table	The table where the rule is located, can be one of "filter", "nat" or "mangle"
 - chain	The chain where the rule is located, e.g. "INPUT" or "postrouting_wan"
 - target	The rule target, e.g. "REJECT" or "DROP"
 - protocol	The matching protocols, e.g. "all" or "tcp"
 - flags	Special rule options ("--", "-f" or "!f")
 - inputif	Input interface of the rule, e.g. "eth0.0" or "*" for all interfaces
 - outputif	Output interface of the rule, e.g. "eth0.0" or "*" for all interfaces
 - source	The source ip range, e.g. "0.0.0.0/0"
 - destination	The destination ip range, e.g. "0.0.0.0/0"
 - options	A list of specific options of the rule, e.g. { "reject-with", "tcp-reset" }
 - packets	The number of packets matched by the rule
 - bytes	The number of total bytes matched by the rule

Example:

ip = luci.sys.iptparser.IptParser()
result = ip.find( {
	target="REJECT",
	protocol="tcp",
	options={ "reject-with", "tcp-reset" }
} )

This will match all rules with target "-j REJECT", protocol "-p tcp" (or "-p all") and the option "--reject-with tcp-reset".

]]--

function IptParser.find( self, args )

	local args = args or { }
	local rv   = { }

	for i, rule in ipairs(self._rules) do
		local match = true

		-- match table
		if not ( not args.table or args.table == rule.table ) then
			match = false
		end

		-- match chain
		if not ( match == true and ( not args.chain or args.chain == rule.chain ) ) then
			match = false
		end

		-- match target
		if not ( match == true and ( not args.target or args.target == rule.target ) ) then
			match = false
		end

		-- match protocol
		if not ( match == true and ( not args.protocol or rule.protocol == "all" or args.protocol == rule.protocol ) ) then
			match = false
		end
		
		-- match source (XXX: implement ipcalc stuff so that 192.168.1.0/24 matches 0.0.0.0/0 etc.)
		if not ( match == true and ( not args.source or rule.source == "0.0.0.0/0" or rule.source == args.source ) ) then
			match = false
		end

		-- match destination (XXX: implement ipcalc stuff so that 192.168.1.0/24 matches 0.0.0.0/0 etc.)
		if not ( match == true and ( not args.destination or rule.destination == "0.0.0.0/0" or rule.destination == args.destination ) ) then
			match = false
		end

		-- match input interface
		if not ( match == true and ( not args.inputif or rule.inputif == "*" or args.inputif == rule.inputif ) ) then
			match = false
		end

		-- match output interface
		if not ( match == true and ( not args.outputif or rule.outputif == "*" or args.outputif == rule.outputif ) ) then
			match = false
		end

		-- match flags (the "opt" column)
		if not ( match == true and ( not args.flags or rule.flags == args.flags ) ) then
			match = false
		end

		-- match specific options
		if not ( match == true and ( not args.options or self:_match_options( rule.options, args.options ) ) ) then
			match = false
		end


		-- insert match
		if match == true then
			table.insert( rv, rule )
		end
	end

	return rv
end


--[[
IptParser.resync()

Rebuild the internal lookup table, for example when rules have changed through external commands.
]]--

function IptParser.resync( self )
	self._rules = { }
	self._chain = nil
	self:_parse_rules()
end


--[[
IptParser._parse_rules()

[internal] Parse iptables output from all tables.
]]--

function IptParser._parse_rules( self )

	for i, tbl in ipairs({ "filter", "nat", "mangle" }) do

		for i, rule in ipairs(luci.util.execl("iptables -t " .. tbl .. " --line-numbers -nxvL")) do

			if rule:find( "Chain " ) == 1 then
		
				self._chain = rule:gsub("Chain ([^%s]*) .*", "%1")

			else
				if rule:find("%d") == 1 then

					local rule_parts   = luci.util.split( rule, "%s+", nil, true )
					local rule_details = { }

					rule_details["table"]       = tbl
					rule_details["chain"]       = self._chain
					rule_details["index"]       = tonumber(rule_parts[1])
					rule_details["packets"]     = tonumber(rule_parts[2])
					rule_details["bytes"]       = tonumber(rule_parts[3])
					rule_details["target"]      = rule_parts[4]
					rule_details["protocol"]    = rule_parts[5]
					rule_details["flags"]       = rule_parts[6]
					rule_details["inputif"]     = rule_parts[7]
					rule_details["outputif"]    = rule_parts[8]
					rule_details["source"]      = rule_parts[9]
					rule_details["destination"] = rule_parts[10]
					rule_details["options"]     = { }

					for i = 11, #rule_parts - 1 do 
						rule_details["options"][i-10] = rule_parts[i]
					end

					table.insert( self._rules, rule_details )
				end
			end
		end
	end

	self._chain = nil
end


--[[
IptParser._match_options( optlist1, optlist2 )

[internal] Return true if optlist1 contains all elements of optlist2. Return false in all other cases.
]]--

function IptParser._match_options( self, o1, o2 )

	-- construct a hashtable of first options list to speed up lookups
	local oh = { }
	for i, opt in ipairs( o1 ) do oh[opt] = true end

	-- iterate over second options list
	-- each string in o2 must be also present in o1
	-- if o2 contains a string which is not found in o1 then return false
	for i, opt in ipairs( o2 ) do
		if not oh[opt] then
			return false
		end
	end

	return true
end
