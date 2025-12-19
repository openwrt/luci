# LuCI 24.10.2 整体架构详解

## 一、宏观架构：分层模型

```
┌─────────────────────────────────────────────────────────┐
│                    用户浏览器                            │
│              (Chrome/Firefox/Safari)                   │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP 请求
                       │ (HTML、JSON-RPC)
                       ▼
┌─────────────────────────────────────────────────────────┐
│                  LuCI Web 服务层                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │  uhttpd (HTTP 服务器，C 编写)                    │   │
│  │  运行在 :80 (HTTP) 或 :443 (HTTPS)              │   │
│  └─────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────┘
                       │ CGI 调用 Lua 脚本
                       │ 或 JSON-RPC 调用
                       ▼
┌─────────────────────────────────────────────────────────┐
│                   LuCI 应用层                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ dispatcher   │  │ controller   │  │ view/render  │  │
│  │ (路由分发)    │  │ (业务逻辑)    │  │ (模板渲染)    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ CBI 框架     │  │ JSON-RPC     │  │ ucode 脚本   │  │
│  │ (表单生成)    │  │ 处理器        │  │ (新式后端)    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │ 调用
                       ▼
┌─────────────────────────────────────────────────────────┐
│              OpenWrt 系统服务层                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  UCI 库    │  │  rpcd        │  │ 系统命令     │  │
│  │  (配置管理)   │  │  (RPC 守护)   │  │ (os.execute) │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              OpenWrt 底层（Linux 内核）                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ /etc/config/ │  │ /sys /proc   │  │ 网络接口等   │  │
│  │ (UCI 配置)    │  │ (系统状态)    │  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 二、核心组件详解

### 2.1 请求流程图：用户访问管理界面

```
用户访问 http://192.168.1.1/cgi-bin/luci/admin/network/config
           ↓
        uhttpd 接收 HTTP 请求
           ↓
    /cgi-bin/luci 指向 luci-base/www/cgi-bin/luci
    (这是一个 Lua 脚本入口)
           ↓
    dispatcher.lua 的 run() 函数启动
    - 解析 URL 路径：/admin/network/config
    - 查找路由表
           ↓
    调用对应的 controller 模块
    (luci/controller/admin/network.lua)
           ↓
    controller 中的 index() 函数定义路由
    - 找到匹配的 action
    - 执行对应的处理函数
           ↓
    执行业务逻辑：
    - 读取 UCI 配置（/etc/config/network）
    - 生成表单（CBI）或数据（JSON）
           ↓
    渲染响应：
    - 返回 HTML（传统模式）
    - 返回 JSON（JSON-RPC 模式）
           ↓
    用户浏览器显示页面
```

### 2.2 dispatcher.lua - 路由分发器

**职责**：将 URL 映射到具体的处理函数

**类比**：Spring 的 `DispatcherServlet` + `@RequestMapping`

**核心概念**：

```
luci-base/src/lua/luci/dispatcher.lua

核心数据结构：node（节点树）
- 节点代表 URL 的一段路径
- 例如：/admin/network/config
  对应节点树：admin → network → config

核心函数：
1. index() - 定义路由表
2. node() - 创建或查找节点
3. entry() - 添加路由项
4. call() - 直接调用函数
5. cbi() - 调用 CBI 表单
```

**示例代码** (`luci/controller/admin/network.lua`):

```lua
module("luci.controller.admin.network", package.seeall)

function index()
    -- 创建 /admin/network 节点
    local root = node("admin", "network")
    root.target = firstchild()
    
    -- 添加路由：/admin/network/config
    -- 指向 CBI 表单：luci/model/cbi/admin_network_config.lua
    entry({"admin", "network", "config"},
          cbi("admin_network_config"),
          "网络配置", 10)
    
    -- 添加路由：/admin/network/status
    -- 指向 action 函数：network_status()
    entry({"admin", "network", "status"},
          call("network_status"),
          "网络状态", 20)
end

-- action 函数
function network_status()
    local status = {
        wan_ip = "192.168.1.1",
        lan_devices = 5
    }
    luci.http.prepare_content("application/json")
    luci.http.write(require("luci.json").encode(status))
end
```

### 2.3 controller - 业务逻辑层

**职责**：处理用户请求，调用模型层，返回视图或数据

**类比**：Spring 的 `@RestController` 或 `@Controller`

**文件位置**：
```
luci-mod-admin-full/
├── luasrc/controller/admin/
│   ├── network.lua        # 网络管理
│   ├── system.lua         # 系统管理
│   ├── services.lua       # 服务管理
│   └── ...
```

**三种 action 类型**：

```lua
-- 类型 1：返回 CBI 表单（自动生成 HTML）
entry({...}, cbi("model_path"), "菜单名")

-- 类型 2：返回模板视图
entry({...}, template("view_path"), "菜单名")

-- 类型 3：调用函数（自定义处理）
entry({...}, call("function_name"), "菜单名")
```

### 2.4 CBI 框架 - 声明式表单系统

**职责**：声明式地定义表单，自动生成 HTML + UCI 读写逻辑

**类比**：Spring MVC 的 `@Valid` + Thymeleaf 表单标签 + Spring Data JPA

**工作流**：

```
1. 定义阶段（.lua 文件）
   ↓
local m = Map("network")  -- 对应 /etc/config/network
local s = m:section(...)  -- 定义一个 section
local o = s:option(...)   -- 添加一个字段
   ↓

2. 加载阶段（用户访问时）
   ↓
dispatcher 调用 cbi() 函数
↓ 加载 Lua 脚本
↓ 从 /etc/config/network 读取数据
↓ 绑定到表单
   ↓

3. 渲染阶段
   ↓
luci/view/cbi.htm（模板）
↓ 生成 HTML form
↓ 展示给用户
   ↓

4. 提交阶段
   ↓
用户填写表单并提交
↓ dispatcher 调用 m:handle()
↓ CBI 框架自动校验数据
↓ 自动写入 UCI 配置
↓ 执行自定义的 on_commit() 钩子
↓ 重定向回表单页面
```

**关键文件**：
```
luci-mod-admin-full/
├── luasrc/model/cbi/admin/
│   ├── network.lua
│   ├── system.lua
│   └── firewall.lua
└── luasrc/view/cbi.htm  # CBI 模板（生成 HTML 的核心）
```

**示例** (`luci/model/cbi/admin_network_config.lua`):

```lua
local m = Map("network", "网络设置")

-- 创建一个 section（对应 UCI 中的一个 config block）
local s = m:section(TypedSection, "interface", "接口配置")
s.addremove = true  -- 允许添加/删除 section

-- 字段定义
local o = s:option(Value, "ifname", "接口名")
o.default = "eth0"

local o = s:option(Value, "proto", "协议")
o:value("static", "静态")
o:value("dhcp", "DHCP")
o.default = "dhcp"

local o = s:option(Value, "ipaddr", "IP 地址")
o.datatype = "ip4addr"  -- 校验规则

-- 提交钩子
function m.on_commit()
    os.execute("service network restart")
end

return m
```

### 2.5 Model 层 - 数据操作

**职责**：读写系统配置、调用系统命令

**主要库**：

#### a) UCI 库 - 配置管理

```lua
local uci = require("luci.model.uci")
local cursor = uci.cursor()

-- 读取单个值
local value = cursor:get("network", "lan", "ipaddr")

-- 读取整个 section
local section = cursor:get_all("network", "lan")

-- 遍历所有 section
cursor:foreach("network", "interface", function(s)
    print(s[".name"])  -- 输出 section 名称
end)

-- 修改值
cursor:set("network", "lan", "ipaddr", "192.168.1.2")
cursor:commit("network")  -- 提交到文件

-- 删除值
cursor:delete("network", "lan", "ipaddr")
cursor:commit("network")
```

**文件位置**：
```
luci-base/src/lua/luci/model/uci.lua
```

#### b) 系统命令执行

```lua
-- 执行系统命令
local ret = os.execute("ifconfig eth0")

-- 执行并获取输出
local handle = io.popen("ip addr show")
local output = handle:read("*a")
handle:close()

-- 使用 luci.util
local util = require("luci.util")
local result = util.exec("cat /proc/version")
```

#### c) 文件操作

```lua
-- 读文件
local f = io.open("/etc/hostname", "r")
local content = f:read("*a")
f:close()

-- 写文件
local f = io.open("/tmp/config.txt", "w")
f:write("test")
f:close()
```

### 2.6 View 层 - 前端渲染

**职责**：生成 HTML 或 JSON 响应

**两种模式**：

#### 模式 A：传统服务端渲染（HTML）

**文件位置**：
```
luci-mod-admin-full/luasrc/view/admin/
├── network.htm
├── system.htm
└── dashboard.htm
```

**模板引擎**：
- 基于 Lua，类似 Jinja2/Thymeleaf
- `<%+header%>` - 包含 header
- `<% code %>` - 执行 Lua 代码
- `<%=value%>` - 输出变量

**示例** (`luci/view/admin/network.htm`):

```html
<%+header%>

<h1><%:Network Configuration%></h1>

<%
    local uci = require("luci.model.uci")
    local cursor = uci.cursor()
    local wan_ip = cursor:get("network", "wan", "ipaddr")
%>

<p>WAN IP: <%= wan_ip %></p>

<form method="POST">
    <input type="text" name="ip" />
    <button type="submit">Save</button>
</form>

<%+footer%>
```

#### 模式 B：JSON-RPC（新式）

```lua
-- controller 中的 action
function get_network_info()
    local uci = require("luci.model.uci")
    local cursor = uci.cursor()
    
    luci.http.prepare_content("application/json")
    luci.http.write(require("luci.json").encode({
        wan_ip = cursor:get("network", "wan", "ipaddr"),
        wan_proto = cursor:get("network", "wan", "proto"),
        lan_devices = 5
    }))
end
```

前端调用：

```javascript
// JavaScript
fetch('/cgi-bin/luci/admin/network/info')
    .then(r => r.json())
    .then(data => {
        console.log(data.wan_ip);
    });
```

---

## 三、目录结构详解

```
luci/                                    # LuCI 根目录
│
├── luci-base/                           # 基础框架（核心）
│   ├── src/lua/luci/
│   │   ├── dispatcher.lua               ⭐ 路由分发（必学）
│   │   ├── http.lua                     # HTTP 请求/响应
│   │   ├── init.lua                     # 初始化
│   │   ├── cbi.lua                      # CBI 框架核心
│   │   │
│   │   ├── model/
│   │   │   ├── uci.lua                  ⭐ UCI 操作（必学）
│   │   │   ├── network.lua              # 网络信息
│   │   │   └── admin.lua                # 管理员信息
│   │   │
│   │   ├── controller/                  # 控制器基类
│   │   │   └── admin.lua
│   │   │
│   │   ├── view/
│   │   │   ├── cbi.htm                  ⭐ CBI 模板（必学）
│   │   │   ├── header.htm
│   │   │   ├── footer.htm
│   │   │   └── error.htm
│   │   │
│   │   └── util.lua                     # 工具函数
│   │
│   └── www/                             # Web 资源
│       ├── cgi-bin/luci                 # 入口脚本（重要）
│       ├── js/
│       │   ├── xhr.js                   # AJAX 库
│       │   ├── rpc.js                   # JSON-RPC 客户端
│       │   └── ui.js                    # UI 库
│       │
│       ├── css/
│       │   └── cascade.css              # 样式
│       │
│       └── luci-static/                 # 静态资源
│           └── ...
│
├── modules/
│   └── luci-mod-admin-full/             # 主管理界面（重要）
│       ├── luasrc/
│       │   ├── controller/admin/        ⭐ 后端控制器（必学）
│       │   │   ├── network.lua
│       │   │   ├── system.lua
│       │   │   ├── services.lua
│       │   │   └── firewall.lua
│       │   │
│       │   ├── model/cbi/admin/         ⭐ CBI 表单定义（必学）
│       │   │   ├── network.lua
│       │   │   ├── system.lua
│       │   │   ├── firewall.lua
│       │   │   └── ...
│       │   │
│       │   └── view/admin/              # 前端模板
│       │       ├── network.htm
│       │       ├── system.htm
│       │       └── ...
│       │
│       └── www/
│           └── css/admin.css
│
├── libs/
│   ├── rpcd/                            # JSON-RPC 后端（C + Lua）
│   │   └── lua/                         # RPC 处理器
│   │       └── ...
│   │
│   └── ucode/                           # ucode 脚本环境（新）
│       └── ...
│
└── Applications/                        # 应用模块
    ├── luci-app-firewall/
    ├── luci-app-ddns/
    ├── luci-app-openvpn/
    └── ...
```

---

## 四、通信协议详解

### 4.1 传统模式：HTML Form + 服务端渲染

```
用户交互
  ↓
form.submit()
  ↓
POST /cgi-bin/luci/admin/network/config
Content-Type: application/x-www-form-urlencoded
Body: ip=192.168.1.2&gateway=192.168.1.1
  ↓
dispatcher 路由到 controller
  ↓
CBI 框架：
  1. 验证数据
  2. 调用 uci.cursor:set()
  3. 调用 uci.cursor:commit()
  ↓
执行 on_commit() 钩子
  ↓
返回重定向或新的 HTML 页面
  ↓
浏览器刷新展示
```

**特点**：
- ✅ 简单，无需 JavaScript
- ✅ CBI 自动处理校验和提交
- ❌ 每次提交都是页面刷新
- ❌ 用户体验差

### 4.2 新模式：JSON-RPC

```
前端 JavaScript
  ↓
fetch('/rpc/luci', {
    method: 'POST',
    body: JSON.stringify({
        jsonrpc: "2.0",
        method: "custom.get_network_info",
        params: {},
        id: 1
    })
})
  ↓
uhttpd 路由到 rpcd 守护进程
  ↓
rpcd 查找 luci.custom 模块
  ↓
执行 get_network_info() 函数
  ↓
返回 JSON 响应：
{
    "jsonrpc": "2.0",
    "result": {
        "wan_ip": "192.168.1.1",
        "devices": 5
    },
    "id": 1
}
  ↓
前端 JavaScript 处理响应
  ↓
DOM 更新（无需刷新）
```

**特点**：
- ✅ 异步，响应快
- ✅ 前后端解耦
- ✅ 类似现代 REST API
- ❌ 需要写更多 JavaScript

---

## 五、配置文件与数据流

### 5.1 UCI 配置结构

```
/etc/config/network:

config interface 'lan'
    option ifname 'eth0'
    option proto 'static'
    option ipaddr '192.168.1.1'
    option netmask '255.255.255.0'

config interface 'wan'
    option ifname 'eth1'
    option proto 'dhcp'
```

**对应 Lua 操作**：

```lua
local uci = require("luci.model.uci")
local cursor = uci.cursor()

-- 读取 lan interface 的 ipaddr
local ip = cursor:get("network", "lan", "ipaddr")
-- 结果：192.168.1.1

-- 修改 ipaddr
cursor:set("network", "lan", "ipaddr", "192.168.1.2")
cursor:commit("network")

-- 读取整个 lan section
local lan = cursor:get_all("network", "lan")
-- 结果：{
--   [".type"] = "interface",
--   [".name"] = "lan",
--   ifname = "eth0",
--   proto = "static",
--   ipaddr = "192.168.1.1",
--   netmask = "255.255.255.0"
-- }
```

### 5.2 CBI 表单到 UCI 的映射

```
CBI 表单定义：
m = Map("network")                    ← 对应 /etc/config/network
s = m:section(NamedSection, "lan")    ← 对应 config interface 'lan'
o = s:option(Value, "ipaddr")         ← 对应 option ipaddr

用户输入：
form.ipaddr = "192.168.1.2"

CBI 框架自动：
cursor:set("network", "lan", "ipaddr", "192.168.1.2")
cursor:commit("network")

结果文件改变：
/etc/config/network 中的 ipaddr 值被更新
```

---

## 六、启动流程

### 6.1 LuCI 启动顺序

```
1. 系统启动
   ↓
2. /etc/init.d/uhttpd start
   ↓
3. uhttpd 监听 :80 和 :443
   ↓
4. 用户访问 http://192.168.1.1/
   ↓
5. uhttpd 处理请求，发现是 /cgi-bin/luci
   ↓
6. 执行 /www/cgi-bin/luci（Lua 脚本）
   ↓
7. 脚本加载 luci-base 框架：
   require("luci.dispatcher").run()
   ↓
8. dispatcher 初始化：
   - 加载所有 controller
   - 构建路由表
   - 查找匹配的路由
   ↓
9. 调用对应的 action
   ↓
10. 返回响应
```

### 6.2 Module 加载顺序

```
1. luci-base/src/lua/luci/ 是核心框架
   ↓
2. modules/luci-mod-admin-full/luasrc/ 是主管理界面
   ↓
3. Applications/ 目录下的模块是可选功能
   ↓
4. 初始化时通过 require() 动态加载
```

---

## 七、开发修改点速查表

| 需求 | 修改文件 | 文件类型 | 复杂度 |
|------|--------|--------|-------|
| 添加菜单项 | `luci/controller/admin/xxx.lua` | Lua | ⭐ |
| 新增配置页面 | `luci/model/cbi/admin_xxx.lua` | Lua | ⭐ |
| 修改表单字段 | `luci/model/cbi/admin_xxx.lua` | Lua | ⭐ |
| 读写 UCI 配置 | `luci/controller/xxx.lua` 中使用 uci 库 | Lua | ⭐ |
| 执行系统命令 | `luci/controller/xxx.lua` 中使用 os.execute() | Lua | ⭐⭐ |
| 自定义 JSON API | `luci/controller/xxx.lua` + `luci.http.write()` | Lua | ⭐⭐ |
| 修改前端界面 | `luci/view/admin/xxx.htm` | HTML/Lua 模板 | ⭐⭐ |
| 添加 JavaScript 功能 | `luci/www/js/xxx.js` | JavaScript | ⭐⭐ |
| 新增 RPC 处理器（新） | `rpcd/lua/xxx.lua` | Lua | ⭐⭐⭐ |
| 修改 CSS 样式 | `luci-mod-admin-full/www/css/*.css` | CSS | ⭐ |

---

## 八、快速定位文件

**问题：我想修改"网络设置"页面**

```
1. 访问 http://192.168.1.1/cgi-bin/luci/admin/network/config
   提取路径：/admin/network/config
   ↓
2. 查找 dispatcher 中的对应路由
   文件：luci-mod-admin-full/luasrc/controller/admin/network.lua
   ↓
3. 找到该路由指向的 CBI 文件
   entry({...}, cbi("admin_network_config"), ...)
   ↓
4. 打开 CBI 文件
   文件：luci-mod-admin-full/luasrc/model/cbi/admin_network_config.lua
   ↓
5. 修改表单定义
```

**问题：我想添加一个自定义的 REST API**

```
1. 创建 controller 文件
   luci-mod-admin-full/luasrc/controller/admin/custom.lua
   ↓
2. 定义 action 函数
   function get_data()
       ...
       luci.http.prepare_content("application/json")
       luci.http.write(...)
   end
   ↓
3. 在 index() 中注册路由
   entry({"admin", "custom", "get_data"}, call("get_data"))
   ↓
4. 前端访问
   http://192.168.1.1/cgi-bin/luci/admin/custom/get_data
```

---

## 九、24.10.2 的新增特性

### 9.1 ucode 语言

新增的脚本语言，比 Lua 更快，部分替代 Lua

```
luci/libs/ucode/ - ucode 脚本目录
```

### 9.2 JSON-RPC 标准化

24.10 推荐使用 JSON-RPC + ucode 而不是传统 CGI + Lua

```
rpcd 服务（C 编写）
↓ 调用
rpc 处理器（Lua/ucode）
↓ 返回
JSON 响应
```

### 9.3 前端现代化

- 引入更多 JavaScript 框架
- 逐步替换传统 Thymeleaf 式模板
- 支持更好的异步交互

---

## 十、学习路线建议

**第 1 周：理论基础**
1. 理解 UCI 配置格式
2. 学习 Lua 基础语法（2-3 小时）
3. 阅读 dispatcher.lua 的路由机制

**第 2 周：CBI 框架**
1. 学习 CBI 表单定义
2. 修改现有的 admin_network_config.lua
3. 添加自己的 CBI 表单

**第 3 周：Controller + Action**

1. 学习如何定义 controller
2. 编写简单的 JSON API
3. 理解前后端通信

**第 4 周：综合项目**
1. 完成一个完整的功能开发
2. 包括：新增菜单、CBI 表单、API、前端交互