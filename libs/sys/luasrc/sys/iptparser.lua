--[[

Iptables parser and query library
(c) 2008-2009 Jo-Philipp Wich <xm@leipzig.freifunk.net>
(c) 2008-2009 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

local luci  = {}
luci.util   = require "luci.util"
luci.sys    = require "luci.sys"
luci.ip     = require "luci.ip"

local tonumber, ipairs, table = tonumber, ipairs, table

--- LuCI iptables parser and query library
-- @cstyle	instance
module("luci.sys.iptparser")

--- Create a new iptables parser object.
-- @class	function
-- @name	IptParser
-- @param	family	Number specifying the address family. 4 for IPv4, 6 for IPv6
-- @return	IptParser instance
IptParser = luci.util.class()

function IptParser.__init__( self, family )
	self._family = (tonumber(family) == 6) and 6 or 4
	self._rules  = { }
	self._chains = { }

	if self._family == 4 then
		self._nulladdr = "0.0.0.0/0"
		self._tables   = { "filter", "nat", "mangle", "raw" }
		self._command  = "iptables -t %s --line-numbers -nxvL"
	else
		self._nulladdr = "::/0"
		self._tables   = { "filter", "mangle", "raw" }
		self._command  = "ip6tables -t %s --line-numbers -nxvL"
	end

	self:_parse_rules()
end

--- Find all firewall rules that match the given criteria. Expects a table with
-- search criteria as only argument. If args is nil or an empty table then all
-- rules will be returned.
--
-- The following keys in the args table are recognized:
-- <ul>
--  <li> table		 - Match rules that are located within the given table
--  <li> chain		 - Match rules that are located within the given chain
--  <li> target		 - Match rules with the given target
--  <li> protocol	 - Match rules that match the given protocol, rules with
-- 						protocol "all" are always matched
--  <li> source		 - Match rules with the given source, rules with source
-- 						"0.0.0.0/0" (::/0) are always matched
--  <li> destination - Match rules with the given destination, rules with
-- 						destination "0.0.0.0/0" (::/0) are always matched
--  <li> inputif	 - Match rules with the given input interface, rules
-- 						with input	interface "*" (=all) are always matched
--  <li> outputif	 - Match rules with the given output interface, rules
-- 						with output	interface "*" (=all) are always matched
--  <li> flags		 - Match rules that match the given flags, current
-- 						supported values are "-f" (--fragment)
--						and "!f" (! --fragment)
--  <li> options	 - Match rules containing all given options
-- </ul>
-- The return value is a list of tables representing the matched rules.
-- Each rule table contains the following fields:
-- <ul>
--  <li> index		 - The index number of the rule
--  <li> table		 - The table where the rule is located, can be one
--	 					of "filter", "nat" or "mangle"
--  <li> chain		 - The chain where the rule is located, e.g. "INPUT"
-- 						or "postrouting_wan"
--  <li> target		 - The rule target, e.g. "REJECT" or "DROP"
--  <li> protocol		The matching protocols, e.g. "all" or "tcp"
--  <li> flags		 - Special rule options ("--", "-f" or "!f")
--  <li> inputif	 - Input interface of the rule, e.g. "eth0.0"
-- 						or "*" for all interfaces
--  <li> outputif	 - Output interface of the rule,e.g. "eth0.0"
-- 						or "*" for all interfaces
--  <li> source		 - The source ip range, e.g. "0.0.0.0/0" (::/0)
--  <li> destination - The destination ip range, e.g. "0.0.0.0/0" (::/0)
--  <li> options	 - A list of specific options of the rule,
-- 						e.g. { "reject-with", "tcp-reset" }
--  <li> packets	 - The number of packets matched by the rule
--  <li> bytes		 - The number of total bytes matched by the rule
-- </ul>
-- Example:
-- <pre>
-- ip = luci.sys.iptparser.IptParser()
-- result = ip.find( {
-- 	target="REJECT",
-- 	protocol="tcp",
-- 	options={ "reject-with", "tcp-reset" }
-- } )
-- </pre>
-- This will match all rules with target "-j REJECT",
-- protocol "-p tcp" (or "-p all")
-- and the option "--reject-with tcp-reset".
-- @params args		Table containing the search arguments (optional)
-- @return			Table of matching rule tables
function IptParser.find( self, args )

	local args = args or { }
	local rv   = { }

	args.source      = args.source      and self:_parse_addr(args.source)
	args.destination = args.destination and self:_parse_addr(args.destination)

	for i, rule in ipairs(self._rules) do
		local match = true

		-- match table
		if not ( not args.table or args.table:lower() == rule.table ) then
			match = false
		end

		-- match chain
		if not ( match == true and (
			not args.chain or args.chain == rule.chain
		) ) then
			match = false
		end

		-- match target
		if not ( match == true and (
			not args.target or args.target == rule.target
		) ) then
			match = false
		end

		-- match protocol
		if not ( match == true and (
			not args.protocol or rule.protocol == "all" or
			args.protocol:lower() == rule.protocol
		) ) then
			match = false
		end

		-- match source
		if not ( match == true and (
			not args.source or rule.source == self._nulladdr or
			self:_parse_addr(rule.source):contains(args.source)
		) ) then
			match = false
		end

		-- match destination
		if not ( match == true and (
			not args.destination or rule.destination == self._nulladdr or
			self:_parse_addr(rule.destination):contains(args.destination)
		) ) then
			match = false
		end

		-- match input interface
		if not ( match == true and (
			not args.inputif or rule.inputif == "*" or
			args.inputif == rule.inputif
		) ) then
			match = false
		end

		-- match output interface
		if not ( match == true and (
			not args.outputif or rule.outputif == "*" or
			args.outputif == rule.outputif
		) ) then
			match = false
		end

		-- match flags (the "opt" column)
		if not ( match == true and (
			not args.flags or rule.flags == args.flags
		) ) then
			match = false
		end

		-- match specific options
		if not ( match == true and (
			not args.options or
			self:_match_options( rule.options, args.options )
		) ) then
			match = false
		end

		-- insert match
		if match == true then
			rv[#rv+1] = rule
		end
	end

	return rv
end


--- Rebuild the internal lookup table, for example when rules have changed
-- through external commands.
-- @return	nothing
function IptParser.resync( self )
	self._rules = { }
	self._chain = nil
	self:_parse_rules()
end


--- Find the names of all tables.
-- @return		Table of table names.
function IptParser.tables( self )
	return self._tables
end


--- Find the names of all chains within the given table name.
-- @param table	String containing the table name
-- @return		Table of chain names in the order they occur.
function IptParser.chains( self, table )
	local lookup = { }
	local chains = { }
	for _, r in ipairs(self:find({table=table})) do
		if not lookup[r.chain] then
			lookup[r.chain]   = true
			chains[#chains+1] = r.chain
		end
	end
	return chains
end


--- Return the given firewall chain within the given table name.
-- @param table	String containing the table name
-- @param chain	String containing the chain name
-- @return		Table containing the fields "policy", "packets", "bytes"
--				and "rules". The "rules" field is a table of rule tables.
function IptParser.chain( self, table, chain )
	return self._chains[table:lower()] and self._chains[table:lower()][chain]
end


--- Test whether the given target points to a custom chain.
-- @param target	String containing the target action
-- @return			Boolean indicating whether target is a custom chain.
function IptParser.is_custom_target( self, target )
	for _, r in ipairs(self._rules) do
		if r.chain == target then
			return true
		end
	end
	return false
end


-- [internal] Parse address according to family.
function IptParser._parse_addr( self, addr )
	if self._family == 4 then
		return luci.ip.IPv4(addr)
	else
		return luci.ip.IPv6(addr)
	end
end

-- [internal] Parse iptables output from all tables.
function IptParser._parse_rules( self )

	for i, tbl in ipairs(self._tables) do

		self._chains[tbl] = { }

		for i, rule in ipairs(luci.util.execl(self._command % tbl)) do

			if rule:find( "^Chain " ) == 1 then

				local crefs
				local cname, cpol, cpkt, cbytes = rule:match(
					"^Chain ([^%s]*) %(policy (%w+) " ..
					"(%d+) packets, (%d+) bytes%)"
				)

				if not cname then
					cname, crefs = rule:match(
						"^Chain ([^%s]*) %((%d+) references%)"
					)
				end

				self._chain = cname
				self._chains[tbl][cname] = {
					policy     = cpol,
					packets    = tonumber(cpkt or 0),
					bytes      = tonumber(cbytes or 0),
					references = tonumber(crefs or 0),
					rules      = { }
				}

			else
				if rule:find("%d") == 1 then

					local rule_parts   = luci.util.split( rule, "%s+", nil, true )
					local rule_details = { }

					-- cope with rules that have no target assigned
					if rule:match("^%d+%s+%d+%s+%d+%s%s") then
						table.insert(rule_parts, 4, nil)
					end

					-- ip6tables opt column is usually zero-width
					if self._family == 6 then
						table.insert(rule_parts, 6, "--")
					end

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

					self._rules[#self._rules+1] = rule_details

					self._chains[tbl][self._chain].rules[
						#self._chains[tbl][self._chain].rules + 1
					] = rule_details
				end
			end
		end
	end

	self._chain = nil
end


-- [internal] Return true if optlist1 contains all elements of optlist 2.
--            Return false in all other cases.
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
