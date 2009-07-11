--- Changes and improvements.
module "CHANGELOG"

--- Nixio 0.3
-- <ul>
-- <li>Added getifaddrs() function.</li>
-- <li>Added getsockopt(), setsockopt(), getsockname() and getpeername()
-- directly to TLS-socket objects unifying the socket interface.</li>
-- <li>Added support for CyaSSL as cryptographical backend.</li>
-- <li>Added support for x509 certificates in DER format.</li>
-- <li>Added support for splice() in UnifiedIO.copyz().</li>
-- <li>Added interface to inject chunks into UnifiedIO.linesource() buffer.</li>
-- <li>Changed TLS behaviour to explicitely separate servers and clients.</li>
-- <li>Fixed usage of signed datatype breaking Base64 decoding.</li>
-- <li>Fixed namespace clashes for nixio.fs.</li>
-- <li>Fixed splice() support for some exotic C libraries.</li>
-- <li>Reconfigure axTLS cryptographical provider.</li>
-- </ul>
-- @class table
-- @name 0.2
-- @return !

--- Nixio 0.2
-- <ul>
-- <li>Initial Release</li>  
-- </ul>
-- @class table
-- @name 0.2
-- @return !