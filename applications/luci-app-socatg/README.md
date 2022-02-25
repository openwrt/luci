# luci-app-socatg [中文文档](./README-Chinese.md)  

**SocatG** (Socat GUI),about IPv6 port forwarding IPv4,SocatG supports all architectures(x86,Arm,MIPS),SocatG needs the support of `socat`👇  
```opkg install socat```
- Localtion：Network->SocatG  
- How to use(reviewing)：[smzdm/什么值得买](https://post.smzdm.com/detail_preview/anxr0w00/)  
- Install：  
1.We already commit a Pull Request to lean(Wait Merge)  
2.[GitHub Releases](https://github.com/big-tooth/luci-app-socatg/releases) has uploaded precompiled file with ipk suffix,Command:  
    ```bash
    wget -P /tmp https://github.com/big-tooth/luci-app-socatg/releases/download/v1.1/luci-app-socatg_1.1-1_all.ipk
    opkg install /tmp/luci-app-socatg_1.1-1_all.ipk
    ```  
![OpenWrt Configuration interface](./doc/openwrt)

***  
Thanks  
[Beginner-Go](https://github.com/Beginner-Go)