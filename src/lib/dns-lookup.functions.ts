import { createServerFn } from "@tanstack/react-start";
import { requireGate } from "./auth-middleware";
import { lookupDomainDnsRecords } from "./dns-lookup.server";

export type { DomainDnsLookup, DnsRecordSet } from "./dns-lookup.server";

export const lookupDomainDns = createServerFn({ method: "POST" })
  .middleware([requireGate])
  .validator((d: { domain: string }) => d)
  .handler(async ({ data }) => lookupDomainDnsRecords(data.domain));
