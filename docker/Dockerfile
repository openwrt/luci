FROM openwrtorg/rootfs:x86-64

MAINTAINER Zhao ZHANG <zo.zhang@gmail.com>

USER root

RUN mkdir /var/lock && \
    opkg update && \
    opkg install uhttpd luci-base luci-mod-admin-full luci-theme-bootstrap && \
    uci set luci.ccache.enable=0 && \
    uci commit luci

EXPOSE 80