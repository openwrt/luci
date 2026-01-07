#include <arpa/inet.h>
#include <errno.h>
#include <linux/rtnetlink.h>
#include <net/if.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <syslog.h>
#include <unistd.h>

#include <netinet/ether.h>

#include "neighbor.h"

#define NDA_RTA(r) ((struct rtattr*)(((char*)(r)) + NLMSG_ALIGN(sizeof(struct ndmsg))))
#define NDA_PAYLOAD(n) NLMSG_PAYLOAD(n, sizeof(struct ndmsg))

struct trees neighbors = { 0 };
bool is_cached = false;
char* module_name = "rrdns-neighbors:";
char* ethers_file = "/etc/ethers";

static int rrdns_cmp_lladdr(const void* k1, const void* k2, void* ptr)
{
    return memcmp(k1, k2, ETH_ALEN);
}

static int rrdns_cmp_ipaddr(const void* k1, const void* k2, void* ptr)
{
    return memcmp(k1, k2, sizeof(struct in6_addr));
}

void rrdns_neighbors_cache_init(void)
{
    static bool initialized;
    if (initialized)
        return;
    avl_init(&neighbors.ipaddr, rrdns_cmp_ipaddr, false, NULL);
    avl_init(&neighbors.lladdr, rrdns_cmp_lladdr, false, NULL);
    initialized = true;
}

static void clear_ipaddr_cache(void)
{
    struct ipaddr_name *ipaddr_element, *ipaddr_next;
    if (!neighbors.ipaddr.root)
        return;
    avl_remove_all_elements(&neighbors.ipaddr, ipaddr_element, node, ipaddr_next)
        free(ipaddr_element);
}

static void clear_lladdr_cache(void)
{
    struct lladdr_name *lladdr_element, *lladdr_next;
    if (!neighbors.lladdr.root)
        return;
    avl_remove_all_elements(&neighbors.lladdr, lladdr_element, node, lladdr_next)
        free(lladdr_element);
}

void rrdns_neighbors_cache_clear(void)
{
    if (!is_cached)
        return;
    clear_ipaddr_cache();
    clear_lladdr_cache();
    is_cached = false;
}

static void load_ethers_cache(void)
{
    struct stat st;
    time_t mtime = 0;
    static time_t ethers_mtime;

    if (stat(ethers_file, &st) == 0)
        mtime = st.st_mtime;

    if (is_cached && mtime && mtime == ethers_mtime)
        return;

    ethers_mtime = mtime;
    rrdns_neighbors_cache_clear();

    FILE* fp = fopen(ethers_file, "r");
    if (!fp)
        return;

    struct lladdr_name* element;
    char line[256];
    for (int count = 0; fgets(line, sizeof(line), fp); count++) {
        char *lladdr, *name, *saveptr = NULL;

        if (line[0] == '#' || line[0] == '\n')
            continue;

        lladdr = strtok_r(line, " \t\r\n", &saveptr);
        name = strtok_r(NULL, " \t\r\n", &saveptr);

        if (!lladdr || !name)
            continue;

        element = malloc(sizeof(*element));
        if (!element) {
            syslog(LOG_WARNING, "%s not enough memory to load %d's entry from %s", module_name, count, ethers_file);
            break;
        }

        if (sscanf(lladdr, "%hhx:%hhx:%hhx:%hhx:%hhx:%hhx",
                &element->lladdr[0], &element->lladdr[1], &element->lladdr[2],
                &element->lladdr[3], &element->lladdr[4], &element->lladdr[5])
            != 6)
            continue;
        element->name = malloc(strlen(name) + 1);
        if (element->name)
            strncpy(element->name, name, strlen(name) + 1);
        else {
            free(element);
            break;
        }
        element->node.key = element->lladdr;
        avl_insert(&neighbors.lladdr, &element->node);
    }
    is_cached = true;

    fclose(fp);
}

char* neighbor_name(int family, const void* addr)
{
    unsigned filter_state = 0xFF & ~(NUD_NOARP | NUD_FAILED);

    int fd;
    struct {
        struct nlmsghdr nlh;
        struct ndmsg ndm;
    } req = { 0 };

    req.nlh.nlmsg_len = NLMSG_LENGTH(sizeof(struct ndmsg));
    req.nlh.nlmsg_type = RTM_GETNEIGH;
    req.nlh.nlmsg_flags = NLM_F_REQUEST | NLM_F_DUMP;
    req.ndm.ndm_family = family;

    fd = socket(AF_NETLINK, SOCK_RAW, NETLINK_ROUTE);
    if (fd < 0)
        return NULL;

    if (send(fd, &req, req.nlh.nlmsg_len, 0) < 0) {
        close(fd);
        return NULL;
    }

    char buf[4096];
    char* name = NULL;

    while (1) {
        ssize_t msglen = recv(fd, buf, sizeof(buf), 0);
        if (msglen < 0) {
            if (errno == EINTR)
                continue;
            break;
        }
        if (msglen == 0)
            break;

        for (struct nlmsghdr* nlh = (struct nlmsghdr*)buf; NLMSG_OK(nlh, msglen); nlh = NLMSG_NEXT(nlh, msglen)) {
            if (nlh->nlmsg_type == NLMSG_DONE)
                goto out;
            if (nlh->nlmsg_type == NLMSG_ERROR)
                continue;

            struct ndmsg* ndm = NLMSG_DATA(nlh);
            if (ndm->ndm_family != family)
                continue;

            if (!(filter_state & ndm->ndm_state))
                continue;
            if (ndm->ndm_flags & NTF_PROXY)
                continue;
            if (ndm->ndm_flags & NTF_EXT_LEARNED)
                continue;

            int rtalen = NDA_PAYLOAD(nlh);
            struct in6_addr* ipaddr = NULL;
            uint8_t* lladdr = NULL;
            bool match = false;

            // Loop through fields
            for (struct rtattr* rta = NDA_RTA(ndm); RTA_OK(rta, rtalen); rta = RTA_NEXT(rta, rtalen)) {
                switch (rta->rta_type) {
                case NDA_DST:
                    ipaddr = RTA_DATA(rta);
                    match = ((family == AF_INET && !memcmp(ipaddr, addr, sizeof(struct in_addr))) || (family == AF_INET6 && !memcmp(ipaddr, addr, sizeof(struct in6_addr))));
                    break;
                case NDA_LLADDR:
                    lladdr = RTA_DATA(rta);
                    break;
                }
                // If dst matches and LLADDR exists break loop early
                if (match && lladdr)
                    break;
            }
            // If dst matches and LLADDR exists return lladdr (caller must cleanup)
            if (match && lladdr) {
                char ipaddr_str[INET6_ADDRSTRLEN];
                inet_ntop(family, addr, ipaddr_str, INET6_ADDRSTRLEN);
                void* found;
                found = avl_find(&neighbors.ipaddr, &ipaddr);
                if (found) {
                    name = ((struct ipaddr_name*)((char*)found - offsetof(struct ipaddr_name, node)))->name;
                    goto out;
                }
                load_ethers_cache();
                found = avl_find(&neighbors.lladdr, lladdr);
                if (found) {
                    struct ipaddr_name* ipaddr_element = malloc(sizeof(*ipaddr_element));
                    if (!ipaddr_element) {
                        syslog(LOG_WARNING, "%s not enough memory for struct ipaddr_name", module_name);
                        goto out;
                    }

                    char ifname[IFNAMSIZ];
                    if (if_indextoname(ndm->ndm_ifindex, ifname) == NULL)
                        snprintf(ifname, sizeof(ifname), "if%u", ndm->ndm_ifindex);

                    name = ((struct lladdr_name*)((char*)found - offsetof(struct lladdr_name, node)))->name;
                    size_t name_len = strlen(name) + strlen(ifname) + 4;
                    ipaddr_element->name = malloc(name_len);
                    if (ipaddr_element->name) {
                        snprintf(ipaddr_element->name, name_len, "%s (%s)", name, ifname);
                        memcpy(&ipaddr_element->ipaddr, ipaddr, sizeof(*ipaddr));
                        ipaddr_element->node.key = &ipaddr_element->ipaddr;
                        avl_insert(&neighbors.ipaddr, &ipaddr_element->node);
                        name = ipaddr_element->name;
                    } else {
                        free(ipaddr_element);
                        syslog(LOG_WARNING, "%s not enough memory for ipaddr_name->name", module_name);
                    }
                    goto out;
                }
            }
        }
    }

out:
    close(fd);
    return name;
}
