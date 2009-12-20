/*
 * fwd - OpenWrt firewall daemon - rtnetlink communication
 *
 *   Copyright (C) 2009 Jo-Philipp Wich <xm@subsignal.org>
 *
 * The fwd program is free software: you can redistribute it and/or
 * modify it under the terms of the GNU General Public License version 2
 * as published by the Free Software Foundation.
 *
 * The fwd program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with the fwd program. If not, see http://www.gnu.org/licenses/.
 */


#include "fwd.h"
#include "fwd_addr.h"
#include "fwd_utils.h"

struct fwd_addr * fwd_get_addrs(int fd, int family)
{
	struct {
		  struct nlmsghdr n;
		  struct ifaddrmsg r;
	} req;

	int offlen;
	int rtattrlen;
	int dump_done;
	char buf[16384];

	struct rtattr *rta;
	struct rtattr *rtatp;
	struct nlmsghdr *nlmp;
	struct ifaddrmsg *rtmp;

	struct fwd_addr *head, *entry;

	/* Build request */
	memset(&req, 0, sizeof(req));
	req.n.nlmsg_len   = NLMSG_LENGTH(sizeof(struct ifaddrmsg));
	req.n.nlmsg_flags = NLM_F_REQUEST | NLM_F_ROOT;
	req.n.nlmsg_type  = RTM_GETADDR;
	req.r.ifa_family  = family;

	rta = (struct rtattr *)(((char *)&req) + NLMSG_ALIGN(req.n.nlmsg_len));
	rta->rta_len = RTA_LENGTH(family == AF_INET ? 4 : 16);

	head = entry = NULL;

	/* Send request */
	if( send(fd, &req, sizeof(req), 0) <= 0 )
		goto error;

	/* Receive responses */
	for( dump_done = 0; !dump_done; )
	{
		if( (offlen = recv(fd, buf, sizeof(buf), 0)) <= 0 )
			goto error;

		/* Parse message */
		for(nlmp = (struct nlmsghdr *)buf; offlen > sizeof(*nlmp);)
		{
			/* Dump finished? */
			if( nlmp->nlmsg_type == NLMSG_DONE )
			{
				dump_done = 1;
				break;
			}

			int len = nlmp->nlmsg_len;
			int req_len = len - sizeof(*nlmp);

			if( req_len<0 || len>offlen )
				goto error;

			if( !NLMSG_OK(nlmp, offlen) )
				goto error;

			rtmp  = (struct ifaddrmsg *) NLMSG_DATA(nlmp);
			rtatp = (struct rtattr *) IFA_RTA(rtmp);

			if( !(entry = fwd_alloc_ptr(struct fwd_addr)) )
				goto error;

			entry->index = rtmp->ifa_index;
			if_indextoname(rtmp->ifa_index, (char *)&entry->ifname);

			rtattrlen = IFA_PAYLOAD(nlmp);

			for( ; RTA_OK(rtatp, rtattrlen); rtatp = RTA_NEXT(rtatp, rtattrlen) )
			{
				if( rtatp->rta_type == IFA_ADDRESS )
				{
					memcpy(&entry->ipaddr.addr, (char *) RTA_DATA(rtatp), rtatp->rta_len);
					entry->ipaddr.prefix = rtmp->ifa_prefixlen;
					entry->family = family;
				}
				else if( rtatp->rta_type == IFA_LABEL)
				{
					memcpy(&entry->label, (char *) RTA_DATA(rtatp), rtatp->rta_len);
				}
			}

			entry->next = head;
			head = entry;

			offlen -= NLMSG_ALIGN(len);
			nlmp = (struct nlmsghdr*)((char*)nlmp + NLMSG_ALIGN(len));
		}
	}

	return head;


	error:

	fwd_free_addrs(head);
	head = entry = NULL;

	return NULL;
}

struct fwd_cidr * fwd_lookup_addr(struct fwd_addr *head, const char *ifname)
{
	struct fwd_addr *entry;

	for( entry = head; entry; entry = entry->next )
		if( !strncmp(entry->ifname, ifname, IFNAMSIZ) )
			return &entry->ipaddr;

	return NULL;
}

void fwd_free_addrs(struct fwd_addr *head)
{
	struct fwd_addr *entry = head;

	while( entry != NULL )
	{
		head = entry->next;
		free(entry);
		entry = head;
	}

	head = entry = NULL;
}

struct fwd_addr * fwd_append_addrs(struct fwd_addr *head, struct fwd_addr *add)
{
	struct fwd_addr *entry = head;

	while( entry->next != NULL )
		entry = entry->next;

	return (entry->next = add);
}

