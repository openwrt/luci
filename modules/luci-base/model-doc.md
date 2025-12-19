# luci-base 完整解读

> luci-base 是 LuCI 的基础库和工具包，提供前端 JavaScript 库、编译工具、菜单配置等基础设施。

------

## 一、luci-base 的三层结构

```
luci-base/
│
├── htdocs/               ⭐⭐⭐ 前端资源库（最重要）
├── root/                 ⭐⭐ 部署文件和配置
└── src/                  ⭐ 编译工具和 C 库
```

每一层都有明确的用途和受众。

------

## 二、htdocs/ - 前端 JavaScript 库（核心）

### 2.1 作用和定位

luci-base/htdocs/ 包含所有 LuCI 前端开发必需的 JavaScript 库。

**类比**：

- jQuery 对 JavaScript 开发的作用
- React/Vue 对前端框架的作用

所有 LuCI 前端代码都依赖这些库。

### 2.2 目录结构详解

```
htdocs/
└── luci-static/
    └── resources/                    # 核心资源库
        │
        ├── protocol/                 # 网络协议实现
        │   ├── dhcp.js              # DHCP 协议
        │   ├── none.js              # 空协议（无 IP）
        │   └── static.js            # 静态 IP 协议
        │
        ├── tools/                    # 工具函数库
        │   ├── prng.js              # 伪随机数生成器
        │   ├── views.js             # 视图相关工具
        │   └── widgets.js           # UI 组件库
        │
        ├── rpc.js                   ⭐⭐⭐ JSON-RPC 客户端
        ├── xhr.js                   ⭐⭐⭐ AJAX 客户端
        ├── luci.js                  ⭐⭐ LuCI 主库
        ├── ui.js                    ⭐⭐ UI 工具库
        ├── cbi.js                   ⭐ CBI 表单前端逻辑
        ├── form.js                  ⭐ 表单工具
        ├── uci.js                   ⭐ UCI 前端模型
        ├── network.js               # 网络工具库
        ├── firewall.js              # 防火墙工具
        ├── fs.js                    # 文件系统工具
        └── validation.js            # 表单验证规则
```

### 2.3 核心库深入讲解

#### 2.3.1 rpc.js - JSON-RPC 2.0 客户端 ⭐⭐⭐

**职责**：前端与后端 RPC 服务器通信

**工作原理**：

```javascript
// 声明 RPC 方法（告诉框架这个方法存在）
rpc.declare({
    object: 'luci.network',
    method: 'get_interfaces',
    params: ['namespace'],
    expect: { 'interfaces': [] }
});

// 调用 RPC 方法
rpc.call('luci.network', 'get_interfaces', {}, function(error, data) {
    if (error) {
        console.error('RPC 调用失败', error);
    } else {
        console.log('获取到接口列表', data.interfaces);
    }
});

// 实际发送的请求
// POST /rpc/luci HTTP/1.1
// Content-Type: application/json
// 
// {
//   "jsonrpc": "2.0",
//   "id": 1,
//   "method": "luci.network.get_interfaces",
//   "params": {}
// }

// 返回的响应
// {
//   "jsonrpc": "2.0",
//   "id": 1,
//   "result": {
//     "interfaces": [
//       { "name": "lan", "proto": "static", "ipaddr": "192.168.1.1" },
//       { "name": "wan", "proto": "dhcp" }
//     ]
//   }
// }
```

**关键函数**：

```javascript
rpc.declare(spec)              // 声明 RPC 方法
rpc.call(object, method, params, callback)  // 同步调用
rpc.callAsync(object, method, params)       // 异步调用
rpc.batch(calls)               // 批量调用
```

**使用场景**：

- 获取系统配置
- 执行系统操作
- 查询系统状态

#### 2.3.2 xhr.js - HTTP 请求库 ⭐⭐⭐

**职责**：发送 HTTP 请求（XMLHttpRequest 的封装）

**工作原理**：

```javascript
// 获取文件
xhr.get('/etc/config/network', function(data) {
    console.log(data);
});

// 获取 JSON
xhr.get('/api/config.json', { json: true }, function(error, data) {
    if (data) {
        console.log(data.config);
    }
});

// POST 请求
xhr.post('/api/action', 'key1=value1&key2=value2', function(error, response) {
    console.log(response);
});

// 自定义选项
xhr.request('/endpoint', {
    method: 'POST',
    headers: { 'Custom-Header': 'value' },
    content: 'body content',
    callback: function(error, data) {
        // 处理响应
    }
});
```

**关键函数**：

```javascript
xhr.get(url, options, callback)     // GET 请求
xhr.post(url, data, callback)       // POST 请求
xhr.request(url, options)           // 原始请求
```

**使用场景**：

- 读取配置文件
- 下载数据
- 与自定义 API 通信

#### 2.3.3 luci.js - LuCI 主库 ⭐⭐

**职责**：提供 LuCI 框架的核心功能

```javascript
// 获取当前用户权限
luci.aclAccess('admin', 'network')

// 获取 LuCI 配置
luci.env  // { protocol: 'http', host: '192.168.1.1', ... }

// 工作流程管理
luci.mainmenu     // 菜单对象
luci.page         // 当前页面
```

#### 2.3.4 ui.js - UI 工具库 ⭐⭐

**职责**：UI 交互和视觉反馈

```javascript
// 显示通知消息
ui.addNotification('Success', 'Operation completed', 'info');

// 显示模态框
ui.showModal('标题', '内容', '按钮');

// 确认对话框
ui.showConfirm('确定删除？', function(ok) {
    if (ok) {
        // 执行删除
    }
});

// 等待指示器
ui.showBusyIndicator();
ui.hideBusyIndicator();

// 切换部分可见性
ui.toggleSection('#mySection');
```

#### 2.3.5 uci.js - UCI 前端模型 ⭐

**职责**：在前端表示和操作 UCI 配置

```javascript
// 读取 UCI 配置（通过 RPC）
uci.load('network').done(function() {
    // 获取 network config 中 lan section 的 ipaddr option
    var ipaddr = uci.get('network', 'lan', 'ipaddr');
    console.log(ipaddr);  // "192.168.1.1"
});

// 修改配置
uci.set('network', 'lan', 'ipaddr', '192.168.2.1');

// 提交更改
uci.save().done(function() {
    console.log('配置已保存');
});

// 重置更改
uci.unload('network');
```

#### 2.3.6 cbi.js - CBI 表单前端逻辑 ⭐

**职责**：CBI 表单的前端交互逻辑

```javascript
// CBI 表单的动态行为
// - 字段间依赖（Show-If）
// - 动态验证
// - 实时预览
// - 与后端通信

// 通常不直接调用，由后端生成的 HTML 自动使用
```

#### 2.3.7 validation.js - 表单验证 ⭐

**职责**：提供通用的表单验证规则

```javascript
// IP 地址验证
validation.isIPv4(value)          // 检查是否为有效 IPv4
validation.isIPv6(value)          // 检查是否为有效 IPv6

// MAC 地址验证
validation.isMACaddr(value)

// 端口号验证
validation.isPort(value)          // 1-65535

// 邮箱验证
validation.isEmail(value)

// 自定义验证
validation.addValidator('custom', function(value) {
    return value.length > 5;
});
```

### 2.4 protocol/ - 网络协议实现

**作用**：定义不同网络协议的前端表示

```javascript
// protocol/static.js
// 定义静态 IP 需要的字段：ipaddr, netmask, gateway 等

// protocol/dhcp.js
// 定义 DHCP 需要的字段：hostname, clientid 等

// protocol/none.js
// 定义无 IP 配置
```

这些文件用于：

- 动态生成表单字段
- 根据协议类型显示不同的配置选项

### 2.5 tools/ - 工具库

| 文件         | 职责                                |
| ------------ | ----------------------------------- |
| `prng.js`    | 伪随机数生成（如生成随机 MAC 地址） |
| `views.js`   | 视图工具函数（列表、表格等）        |
| `widgets.js` | UI 小组件（按钮、输入框等）         |

------

## 三、root/ - 部署文件和配置

### 3.1 作用

定义 LuCI 的菜单结构和访问控制，指导如何组织和保护功能。

### 3.2 目录结构

```
root/
├── usr/share/
│   ├── acl.d/
│   │   └── luci-base.json        # Web 访问控制列表
│   ├── luci/menu.d/
│   │   └── luci-base.json        # 菜单定义
│   └── rpcd/acl.d/
│       └── luci-base.json        # RPC 访问控制列表
└── www/
    └── index.html                # 首页（重定向）
```

### 3.3 菜单定义：usr/share/luci/menu.d/luci-base.json

**职责**：定义 LuCI 的菜单结构

**示例内容**（推测）：

```json
{
  "admin": {
    "title": "Administration",
    "order": 10,
    "access": ["admin"],
    "children": {
      "system": {
        "title": "System",
        "order": 20
      },
      "network": {
        "title": "Network",
        "order": 30
      }
    }
  }
}
```

**使用方式**：

- 前端加载这个 JSON
- 动态生成菜单树
- 根据用户权限显示/隐藏菜单项

### 3.4 Web 访问控制：usr/share/acl.d/luci-base.json

**职责**：定义 Web 用户的访问权限

**示例内容**（推测）：

```json
{
  "admin": {
    "title": "Administrator",
    "description": "Full access",
    "read": {
      "uci": true,
      "system": true,
      "network": true
    },
    "write": {
      "uci": true,
      "system": true,
      "network": true
    }
  },
  "guest": {
    "title": "Guest",
    "description": "Limited access",
    "read": {
      "system": true
    },
    "write": {}
  }
}
```

**使用方式**：

- 用户登录时检查权限
- 前端根据权限显示功能
- 后端验证请求权限

### 3.5 RPC 访问控制：usr/share/rpcd/acl.d/luci-base.json

**职责**：限制哪些用户可以调用哪些 RPC 方法

**示例内容**（推测）：

```json
{
  "luci": {
    "description": "LuCI",
    "read": {
      "admin": [ "luci.status.getboardinfo", "luci.network.*" ],
      "user": [ "luci.status.*" ]
    },
    "write": {
      "admin": [ "luci.network.*", "luci.system.*" ]
    }
  }
}
```

**使用方式**：

- rpcd 服务器检查 RPC 调用的权限
- 没有权限的调用被拒绝

### 3.6 首页：www/index.html

**职责**：简单的首页，通常只包含重定向逻辑

```html
<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="refresh" content="0; url=/cgi-bin/luci/" />
    <title>Redirecting...</title>
</head>
<body>
    <p>Please wait...</p>
</body>
</html>
```

部署到 `/www/index.html`，用户访问首页时自动跳转。

------

## 四、src/ - 编译工具和 C 库

### 4.1 作用

提供编译 LuCI 所需的工具和性能关键的 C 实现。

### 4.2 目录结构

```
src/
├── Makefile              # 编译脚本
├── jsmin.c              # JavaScript 压缩工具
├── po2lmo.c             # 翻译文件转换工具
├── lib/
│   ├── luci.c           # LuCI C 库
│   ├── lmo.c/lmo.h      # LMO 格式库（翻译优化）
│   └── plural_formula.y # 复数公式处理
└── contrib/
    ├── lemon.c          # SQL 解析器生成工具
    └── lempar.c         # 解析器模板
```

### 4.3 各文件详解

#### 4.3.1 jsmin.c - JavaScript 压缩工具

**职责**：压缩 JavaScript 文件，减小体积

```bash
# 编译 jsmin.c 生成 jsmin 可执行文件
gcc jsmin.c -o jsmin

# 使用方式
jsmin < input.js > output.min.js

# 例如
jsmin < htdocs/luci-static/resources/rpc.js > rpc.min.js
```

**作用**：减小 JavaScript 文件大小，加快前端加载速度

#### 4.3.2 po2lmo.c - 翻译文件转换工具

**职责**：将 .po 翻译文件转换为 .lmo 格式

```bash
# 编译
gcc po2lmo.c -o po2lmo

# 使用
po2lmo zh_CN.po zh_CN.lmo

# 作用：加快翻译文件的加载速度
```

#### 4.3.3 lmo.c/lmo.h - LMO 库

**职责**：LMO 格式的读写实现

LMO 是 LuCI 的本地化文件格式，比 PO 文件更优化。

```c
// lmo.h 中定义的接口
struct lmo_catalog *lmo_open(const char *filename);
const char *lmo_lookup(struct lmo_catalog *cat, const char *msgid);
void lmo_close(struct lmo_catalog *cat);
```

#### 4.3.4 luci.c - LuCI C 库

**职责**：提供 C 级别的 LuCI 功能（如果有的话）

这可能包含：

- 与 OpenWrt 系统接口的 C 实现
- 性能关键的操作
- Lua 的 C 绑定

#### 4.3.5 plural_formula.y - 复数公式处理

**职责**：处理国际化中的复数规则

不同语言有不同的复数规则：

- 英文：1 item / 2 items
- 中文：1 个项目 / 2 个项目（实际上规则相同）
- 俄文：复杂的规则，取决于数字的尾数

### 4.4 编译流程

```
源码文件（.c）
  ↓
编译成可执行文件或库
  ↓
这些工具用于处理其他 LuCI 组件的文件
  ↓
最终的编译产物（.ipk 包）
```

**例子**：

```bash
# 在 OpenWrt 编译环境中
make -C luci-base/src/              # 编译所有 C 代码

# 生成的工具被用于：
# 1. 压缩 JavaScript
#    jsmin < rpc.js > rpc.min.js
#
# 2. 处理翻译
#    po2lmo zh_CN.po zh_CN.lmo
#
# 3. 生成最终的 ipk 包
```

------

## 五、编译部署映射

### 5.1 从源码到部署

```
源码：luci-base/

├─ htdocs/luci-static/resources/
│  ├─ rpc.js                         → 编译（压缩）        → /www/luci-static/resources/rpc.js
│  ├─ xhr.js                         → 编译（压缩）        → /www/luci-static/resources/xhr.js
│  ├─ ui.js                          → 编译（压缩）        → /www/luci-static/resources/ui.js
│  └─ ...                            → 编译（压缩）        → /www/luci-static/resources/...
│
├─ root/
│  ├─ usr/share/luci/menu.d/         → 直接复制           → /usr/share/luci/menu.d/
│  ├─ usr/share/acl.d/               → 直接复制           → /usr/share/acl.d/
│  ├─ usr/share/rpcd/acl.d/          → 直接复制           → /usr/share/rpcd/acl.d/
│  └─ www/index.html                 → 直接复制           → /www/index.html
│
└─ src/
   ├─ jsmin.c                        → 编译               → jsmin（工具）
   ├─ po2lmo.c                       → 编译               → po2lmo（工具）
   ├─ lib/lmo.c                      → 编译成库           → libluci.so（库）
   └─ lib/luci.c                     → 编译成库           → libluci.so（库）
```

### 5.2 部署后的文件系统

```
设备文件系统（/）：

├─ /www/
│  ├─ index.html                     # 首页
│  ├─ luci-static/resources/
│  │  ├─ rpc.js                      # JSON-RPC 客户端
│  │  ├─ xhr.js                      # HTTP 客户端
│  │  ├─ ui.js                       # UI 工具
│  │  ├─ validation.js               # 验证规则
│  │  ├─ uci.js                      # UCI 前端模型
│  │  ├─ cbi.js                      # CBI 表单逻辑
│  │  ├─ protocol/                   # 网络协议
│  │  ├─ tools/                      # 工具库
│  │  └─ ...
│  └─ (其他静态资源)
│
├─ /usr/share/
│  ├─ luci/menu.d/
│  │  └─ luci-base.json              # 菜单定义
│  ├─ acl.d/
│  │  └─ luci-base.json              # Web 访问控制
│  └─ rpcd/acl.d/
│     └─ luci-base.json              # RPC 访问控制
│
└─ /usr/lib/
   └─ libluci.so                     # C 库
```

------

## 六、各库的使用关系

### 6.1 依赖关系图

```
用户浏览器（JavaScript 代码）
    ↓
加载 /www/luci-static/resources/ 中的 JS 库
    │
    ├─ rpc.js              ← 调用 RPC API（/rpc/luci）
    ├─ xhr.js              ← 发送 HTTP 请求
    ├─ uci.js              ← 操作 UCI 配置
    ├─ cbi.js              ← CBI 表单交互
    ├─ validation.js       ← 表单验证
    ├─ ui.js               ← UI 交互
    ├─ luci.js             ← LuCI 框架
    ├─ protocol/*          ← 网络协议定义
    └─ tools/*             ← 工具函数
    ↓
后端服务（rpcd + Lua/ucode）
    ↓
操作系统（网络、文件系统等）
```

### 6.2 具体流程示例：用户修改网络设置

```
1. 用户打开管理界面
   ↓
2. 前端 JavaScript 加载
   ├─ 加载 rpc.js
   └─ 调用 rpc.call('luci.network', 'get_interfaces', ...)
   ↓
3. rpc.js 发送 JSON-RPC 请求
   POST /rpc/luci
   {
     "jsonrpc": "2.0",
     "method": "luci.network.get_interfaces",
     ...
   }
   ↓
4. 后端 rpcd 处理请求
   ↓
5. rpcd 调用 Lua/ucode 脚本
   ↓
6. 脚本读取 UCI 配置
   ↓
7. 返回 JSON 响应
   ↓
8. 前端 rpc.js 接收响应
   ↓
9. JavaScript 更新页面 DOM
   ↓
10. 用户看到网络配置
    ↓
11. 用户修改配置，点击"保存"
    ↓
12. 前端调用 uci.js 和 rpc.js
    ↓
13. 发送 JSON-RPC 请求修改配置
    ↓
14. 后端保存 UCI 配置
    ↓
15. 前端显示"保存成功"通知（使用 ui.js）
```

------

## 七、总结：luci-base 是什么

### 7.1 一句话总结

**luci-base 是 LuCI 前端的基础库和工具包，提供与后端通信、UI 交互、表单处理等功能。**

### 7.2 三个核心职责

| 职责         | 位置      | 作用                         |
| ------------ | --------- | ---------------------------- |
| **前端库**   | `htdocs/` | 提供 JavaScript 库供前端使用 |
| **配置定义** | `root/`   | 定义菜单和权限               |
| **编译工具** | `src/`    | 提供编译和优化工具           |

### 7.3 不同角色的理解

**前端开发者**：

```
luci-base = 一套完整的 JavaScript 库
  - 如何调用 RPC API？→ 使用 rpc.js
  - 如何发送 HTTP 请求？→ 使用 xhr.js
  - 如何修改配置？→ 使用 uci.js
  - 如何做表单验证？→ 使用 validation.js
```

**后端开发者**：

```
luci-base = 菜单和权限的定义
  - 菜单结构？→ menu.d/luci-base.json
  - 用户权限？→ acl.d/luci-base.json
  - RPC 权限？→ rpcd/acl.d/luci-base.json
```

**系统集成者**：

```
luci-base = 编译工具和库
  - JavaScript 压缩 → jsmin
  - 翻译文件处理 → po2lmo
  - C 库支持 → libluci.so
```

### 7.4 关键库速查

| 库              | 用途          | 何时使用           |
| --------------- | ------------- | ------------------ |
| `rpc.js`        | JSON-RPC 通信 | 与后端交互         |
| `xhr.js`        | HTTP 请求     | 读写文件/API       |
| `uci.js`        | UCI 配置模型  | 前端操作配置       |
| `validation.js` | 表单验证      | 验证用户输入       |
| `ui.js`         | UI 交互       | 显示通知、对话框等 |
| `cbi.js`        | CBI 表单逻辑  | CBI 表单交互       |
| `protocol/*.js` | 网络协议      | 显示协议特定字段   |

------

## 八、如何使用 luci-base

### 8.1 前端开发

```javascript
// 1. 在 HTML 中引入库
<script src="/luci-static/resources/rpc.js"></script>
<script src="/luci-static/resources/xhr.js"></script>
<script src="/luci-static/resources/ui.js"></script>

// 2. 使用库
rpc.declare({
    object: 'my.api',
    method: 'get_data',
    expect: { result: {} }
});

rpc.call('my.api', 'get_data', {}, function(error, data) {
    if (!error) {
        ui.addNotification('Success', 'Data loaded');
        // 更新页面
    }
});

// 3. 表单验证
if (!validation.isIPv4(ipaddr)) {
    ui.showModal('Error', 'Invalid IP address');
}
```

### 8.2 了解菜单结构

```bash
# 查看菜单定义
cat root/usr/share/luci/menu.d/luci-base.json

# 查看权限定义
cat root/usr/share/acl.d/luci-base.json
```

### 8.3 贡献新库

```bash
# 添加新的 JavaScript 库
htdocs/luci-static/resources/mylib.js

# 添加新的工具
src/mytool.c

# 更新菜单或权限
root/usr/share/luci/menu.d/luci-base.json
```

------

## 九、与其他 LuCI 包的关系

### 9.1 包的分工

```
luci-base (基础库 - 这个包)
  ├─ 前端 JavaScript 库
  ├─ 菜单和权限定义
  └─ 编译工具

luci-mod-admin-full (主管理界面)
  ├─ 依赖 luci-base
  ├─ 提供 /www/cgi-bin/luci 入口
  ├─ 页面路由和渲染
  └─ CBI 表单定义

luci-app-* (应用模块)
  ├─ 依赖 luci-base
  ├─ 依赖 luci-mod-admin-full
  └─ 提供具体功能（防火墙、VPN 等）
```

### 9.2 luci-base 的地位

```
所有 LuCI 包都依赖 luci-base
    ↓
luci-base 是基础设施
    ↓
像 Spring Framework 对 Spring Boot 的作用一样
```

------

