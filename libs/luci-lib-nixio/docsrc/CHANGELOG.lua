--- Changes and improvements.
module "nixio.CHANGELOG"

--- Service Release.
-- <ul>
-- <li>Added getifaddrs() function.</li>
-- <li>Added getsockopt(), setsockopt(), getsockname() and getpeername()
-- directly to TLS-socket objects unifying the socket interface.</li>
-- <li>Added support for wolfSSL as cryptographical backend.</li>
-- <li>Added support for x509 certificates in DER format.</li>
-- <li>Added support for splice() in UnifiedIO.copyz().</li>
-- <li>Added interface to inject chunks into UnifiedIO.linesource() buffer.</li>
-- <li>Changed TLS behaviour to explicitly separate servers and clients.</li>
-- <li>Fixed usage of signed datatype breaking Base64 decoding.</li>
-- <li>Fixed namespace clashes for nixio.fs.</li>
-- <li>Fixed splice() support for some exotic C libraries.</li>
-- <li>Remove axTLS support.</li>
-- </ul>
-- @class table
-- @name 0.3
-- @return !

--- Initial Release.
-- <ul>
-- <li>Initial Release</li>  
-- </ul>
-- @class table
-- @name 0.2
-- @return !
