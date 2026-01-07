#include <libubox/avl.h>
#include <linux/if_ether.h>
#include <net/if.h>

struct trees {
    struct avl_tree ipaddr;
    struct avl_tree lladdr;
};

struct lladdr_name {
    struct avl_node node;
    uint8_t lladdr[ETH_ALEN];
    char* name;
};

struct ipaddr_name {
    struct avl_node node;
    struct in6_addr ipaddr;
    char* name;
};

char* neighbor_name(int family, const void* addr);
void rrdns_neighbors_cache_init();
void rrdns_neighbors_cache_clear();
