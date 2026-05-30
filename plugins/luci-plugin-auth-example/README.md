# LuCI Authentication Plugin Example

This package demonstrates how to create authentication plugins for LuCI
that integrate with the plugin UI architecture (System > Plugins).

## Architecture

Authentication plugins consist of two components:

### 1. Backend Plugin (ucode)
**Location**: `/usr/share/ucode/luci/plugins/auth/login/<uuid>.uc`

The backend plugin implements the authentication logic. It must:
- Return a plugin object
- Provide a `check(http, user)` method to determine if auth is required
- Provide a `verify(http, user)` method to validate the auth response
- Use a 32-character hexadecimal UUID as the filename

**Example structure**:
```javascript
return {
    priority: 10,  // Optional: execution order (lower = first)
    
    check: function(http, user) {
        // Return { required: true/false, fields: [...], message: '...', html: '...', assets: [...] }
    },
    
    verify: function(http, user) {
        // Return { success: true/false, message: '...' }
    }
};
```

### 2. UI Plugin (JavaScript)
**Location**: `/www/luci-static/resources/view/plugins/<uuid>.js`

The UI plugin provides configuration interface in System > Plugins. It must:
- Extend `baseclass`
- Define `class: 'auth'` and `type: 'login'`
- Use the same UUID as the backend plugin (without .uc extension)
- Implement `addFormOptions(s)` to add configuration fields
- Optionally implement `configSummary(section)` to show current config

**Example structure**:
```javascript
return baseclass.extend({
    class: 'auth',
    class_i18n: _('Authentication'),
    type: 'login',
    type_i18n: _('Login'),
    
    id: 'd0ecde1b009d44ff82faa8b0ff219cef',
    name: 'My Auth Plugin',
    title: _('My Auth Plugin'),
    description: _('Description of what this plugin does'),
    
    addFormOptions(s) {
        // Add configuration options using form.*
    },
    
    configSummary(section) {
        // Return summary string to display in plugin list
    }
});
```

## Configuration

Plugins are configured through the `luci_plugins` UCI config:

```
config global 'global'
    option enabled '1'                    # Global plugin system
    option auth_login_enabled '1'         # Auth plugin class

config auth_login 'd0ecde1b009d44ff82faa8b0ff219cef'
    option name 'Example Auth Plugin'
    option enabled '1'
    option priority '10'
    option challenge_field 'verification_code'
    option help_text 'Enter your code'
    option test_code '123456'
```

## Integration with Login Flow

1. User enters username/password
2. If password is correct, `check()` is called on each enabled auth plugin
3. If any plugin returns `required: true`, the login form shows additional fields
   and optional raw HTML/JS assets
4. User submits the additional fields
5. `verify()` is called to validate the response
6. If verification succeeds, session is granted
7. If verification fails, user must try again

The dispatcher stores the required plugin UUID list in session state before
verification, then clears it by setting `pending_auth_plugins` to `null` after
successful verification.

Priority is configurable via `luci_plugins.<uuid>.priority` (lower values run first).
If changed at runtime, reload plugin cache or restart services to apply.

## Raw HTML + JS Assets

Plugins may return:

- `html`: raw HTML snippet inserted into the login form
- `assets`: script URLs for challenge UI behavior

Asset security rules:

- URLs must be under `/luci-static/plugins/<plugin-uuid>/`
- Invalid asset URLs are ignored by the framework
- Keep `html` static or generated from trusted values only

## Generating a UUID

Use one of these methods:
```bash
# Linux
cat /proc/sys/kernel/random/uuid | tr -d '-'

# macOS
uuidgen | tr -d '-' | tr '[:upper:]' '[:lower:]'

# Online
# Visit https://www.uuidgenerator.net/ and remove dashes
```

## Plugin Types

Common authentication plugin types:
- **TOTP/OTP**: Time-based one-time passwords (Google Authenticator, etc.)
- **SMS**: SMS verification codes
- **Email**: Email verification codes
- **WebAuthn**: FIDO2/WebAuthn hardware keys
- **Biometric**: Fingerprint, face recognition (mobile apps)
- **Push Notification**: Approve/deny on mobile device
- **Security Questions**: Additional security questions

## Testing

1. Install the plugin package
2. Navigate to System > Plugins
3. Enable "Global plugin system"
4. Enable "Authentication > Login"
5. Enable the specific auth plugin and configure it
6. Log out and try logging in
7. After entering correct password, you should see the auth challenge

## Real Implementation Examples

For production use, integrate with actual authentication systems:

- **TOTP**: Use `oathtool` command or liboath library
- **SMS**: Integrate with SMS gateway API
- **WebAuthn**: Use WebAuthn JavaScript API and verify on server
- **LDAP 2FA**: Query LDAP server for 2FA attributes

## See Also

- LuCI Plugin Architecture: commit 617f364
- HTTP Header Plugins: `plugins/luci-plugin-examples/`
- LuCI Dispatcher: `modules/luci-base/ucode/dispatcher.uc`
