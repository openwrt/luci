# Tabs only for indentation, spaces ok in comments.

# jq -f _device_json_transform.jq old.json
# Transform from the old schema:
# {
# 	"vendorName": "...",
# 	"deviceName": "...",
# 	"boardNames": ["..."],
# 	"partition1MTD": "mtdX",
# 	"partition2MTD": "mtdY",
# 	"labelOffset": 32,
# 	"bootEnv1": "boot_part",
# 	"bootEnv1Partition1Value": 1,
# 	"bootEnv1Partition2Value": 2,
# 	"bootEnv2": "bootcmd",
# 	"bootEnv2Partition1Value": "run nandboot",
# 	"bootEnv2Partition2Value": "run altnandboot",
# 	"opOffset": 0,
# 	"ubiVolume": 2
# }
#
# …to the new schema:
# {
# 	"device": { "vendor": "...", "model": "...", "board": ["..."] },
# 	"commands": { "params": [...], "get": "fw_printenv", "set": "fw_setenv", "save": null },
# 	"partitions": [
# 		{ "number": 1, "param_values": [...], "mtd": "mtdX", "labelOffsetBytes": <int|null>, "altMountOptions": {...|null} },
# 		{ "number": 2, "param_values": [...], "mtd": "mtdY", "labelOffsetBytes": <int|null>, "altMountOptions": {...|null} }
# 	]
# }

. as $in
| ([$in.bootEnv1, $in.bootEnv2] | map(select(. != null))) as $params
| {
	device: {
		vendor: $in.vendorName,
		model: $in.deviceName,
		board: (if ($in.boardNames | type) == "array" then $in.boardNames else [$in.boardNames] end)
	},
	commands: {
		params: $params,
		get: "fw_printenv",
		set: "fw_setenv",
		save: null
	},
	partitions: [
		(if $in.partition1MTD != null then
			{
				number: 1,
				param_values: (
					# Align to commands.params: value for param[0], param[1], ...
					# Only include entries that exist (skip nulls)
					[
						(if ($params | length) > 0 then $in.bootEnv1Partition1Value else empty end),
						(if ($params | length) > 1 then $in.bootEnv2Partition1Value else empty end)
					] | map(select(. != null))
				),
				mtd: $in.partition1MTD,
				labelOffsetBytes: ($in.labelOffset // null)
			} + (
				if ($in.opOffset != null or $in.ubiVolume != null) then
					{ altMountOptions: { mtdOffset: ($in.opOffset // null), ubiVolume: ($in.ubiVolume // null) } }
				else
					{}
				end
			)
		else empty end),
		(if $in.partition2MTD != null then
			{
				number: 2,
				param_values: (
					[
						(if ($params | length) > 0 then $in.bootEnv1Partition2Value else empty end),
						(if ($params | length) > 1 then $in.bootEnv2Partition2Value else empty end)
					] | map(select(. != null))
				),
				mtd: $in.partition2MTD,
				labelOffsetBytes: ($in.labelOffset // null)
			} + (
				if ($in.opOffset != null or $in.ubiVolume != null) then
					{ altMountOptions: { mtdOffset: ($in.opOffset // null), ubiVolume: ($in.ubiVolume // null) } }
				else
					{}
				end
			)
		else empty end)
	]
}
